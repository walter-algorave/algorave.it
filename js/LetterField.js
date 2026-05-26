// One spring-damped particle per glyph in a single line of preview text.
// Mirrors the FloatingImage physics (spring → base + cursor repulsion +
// per-frame velocity clamp) so the letters drift the same way as the
// media tiles, just much subtler. Stateless when not mounted.
//
// Per-character base positions are computed from cumulative measureText
// on substrings, which preserves pair kerning up to each char's left
// edge. Each glyph is then drawn with textAlign(CENTER, CENTER) at its
// own (posX, posY) — visually centered inside its advance box.

export class LetterField {
  constructor({
    p,
    text,
    baseX,
    baseY,
    size,
    weight,
    family = "Nunito",
    physics,
  }) {
    this.p = p;
    this.text = text;
    this.size = size;
    this.weight = weight;
    this.family = family;
    this.physics = physics;
    this.chars = [];
    this._buildChars(baseX, baseY);
  }

  // Internal: rebuild char list with bases from current (baseX, baseY).
  _buildChars(baseX, baseY) {
    const p = this.p;
    p.drawingContext.save();
    p.drawingContext.font = this._fontString();
    const totalW = p.drawingContext.measureText(this.text).width;
    const leftX = baseX - totalW / 2;
    const chars = [];
    let prevW = 0;
    for (let i = 0; i < this.text.length; i++) {
      const nextW = p.drawingContext.measureText(
        this.text.slice(0, i + 1),
      ).width;
      const cx = leftX + (prevW + nextW) / 2;
      chars.push({
        ch: this.text[i],
        baseX: cx,
        baseY,
        posX: cx,
        posY: baseY,
        velX: 0,
        velY: 0,
      });
      prevW = nextW;
    }
    p.drawingContext.restore();
    this.chars = chars;
  }

  _fontString() {
    return `${this.weight} ${this.size}px "${this.family}", system-ui, sans-serif`;
  }

  // Move bases without resetting velocities — same contract as
  // FloatingImage.setPosition, so resize doesn't snap the letters.
  relocate(baseX, baseY) {
    const p = this.p;
    p.drawingContext.save();
    p.drawingContext.font = this._fontString();
    const totalW = p.drawingContext.measureText(this.text).width;
    const leftX = baseX - totalW / 2;
    let prevW = 0;
    for (let i = 0; i < this.text.length; i++) {
      const nextW = p.drawingContext.measureText(
        this.text.slice(0, i + 1),
      ).width;
      const cx = leftX + (prevW + nextW) / 2;
      this.chars[i].baseX = cx;
      this.chars[i].baseY = baseY;
      prevW = nextW;
    }
    p.drawingContext.restore();
  }

  applyPhysicsConfig(physics) {
    if (physics) this.physics = physics;
  }

  update(mouseVec) {
    const ph = this.physics;
    if (!ph) return;
    const k = ph.stiffness;
    const d = ph.damping;
    const r = ph.repulsionRadius;
    const s = ph.repulsionStrength;
    const vs = ph.repulsionVelocityScale;
    const maxSpeed = ph.maxSpeed;
    const maxOffset = this.size * ph.maxOffsetSizeRatio;
    const maxSpeedSq = maxSpeed * maxSpeed;

    for (const c of this.chars) {
      // spring toward base
      c.velX = c.velX * d + (c.baseX - c.posX) * k;
      c.velY = c.velY * d + (c.baseY - c.posY) * k;

      // cursor repulsion (same quadratic falloff as FloatingImage)
      if (mouseVec && r > 0) {
        const dx = c.posX - mouseVec.x;
        const dy = c.posY - mouseVec.y;
        const dist = Math.hypot(dx, dy);
        if (dist < r && dist > 1e-3) {
          const t = 1 - dist / r;
          const push = t * t * s * r;
          c.velX += (dx / dist) * push * vs;
          c.velY += (dy / dist) * push * vs;
        }
      }

      // clamp speed
      const vmagSq = c.velX * c.velX + c.velY * c.velY;
      if (vmagSq > maxSpeedSq) {
        const k2 = maxSpeed / Math.sqrt(vmagSq);
        c.velX *= k2;
        c.velY *= k2;
      }

      c.posX += c.velX;
      c.posY += c.velY;

      // clamp absolute offset from base so fast cursor sweeps can't fling
      // a letter past the bbox the repulsor was sized for
      const ox = c.posX - c.baseX;
      const oy = c.posY - c.baseY;
      const omagSq = ox * ox + oy * oy;
      if (omagSq > maxOffset * maxOffset) {
        const k2 = maxOffset / Math.sqrt(omagSq);
        c.posX = c.baseX + ox * k2;
        c.posY = c.baseY + oy * k2;
      }
    }
  }

  // Caller is responsible for push/pop, textAlign(CENTER, CENTER), noStroke.
  // Font is set on drawingContext directly so the numeric weight survives
  // p5's text() pipeline (same trick as drawStyledText in textUtils.js).
  draw({ fill, alpha }) {
    const p = this.p;
    p.drawingContext.font = this._fontString();
    p.fill(fill, alpha);
    for (const c of this.chars) {
      if (c.ch === " ") continue;
      p.text(c.ch, c.posX, c.posY);
    }
  }
}
