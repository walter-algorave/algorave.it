// Spring-damped image particle anchored to a base point — drives the media
// tiles inside the preview overlay (see mediaRenderers.js).

export class FloatingImage {
  // All physics / fade values must come pre-built from buildResponsivePreviewConfig() —
  // no fallback defaults; a missing key surfaces NaN immediately (same contract
  // as BloomingFlower / VectorField).
  constructor({
    p,
    image, // p5 Image, may be null until loaded
    baseX,
    baseY,
    size = 220,
    maxHeight = null, // fit-to-contain inside (size × maxHeight); null = width-driven
    stiffness,
    damping,
    maxSpeed,
    repulsionRadius,
    repulsionStrength,
    repulsionVelocityScale,
    rotationDeg = 0,
    appearDelay = 0, // ms before fade-in begins (staggered entry across tiles)
    fadeInDurationMs,
    fadeOutLerpRate,
  } = {}) {
    this.p = p;
    this.image = image;
    this.base = p.createVector(baseX, baseY);
    this.pos = p.createVector(baseX, baseY);
    this.vel = p.createVector(0, 0);

    this.stiffness = stiffness;
    this.damping = damping;
    this.maxSpeed = maxSpeed;
    this.repulsionRadius = repulsionRadius;
    this.repulsionStrength = repulsionStrength;
    this.repulsionVelocityScale = repulsionVelocityScale;

    this.size = size;
    this.maxHeight = maxHeight;
    this.rotation = p.radians(rotationDeg);
    this.appearDelay = appearDelay;
    this.fadeInDurationMs = fadeInDurationMs;
    this.fadeOutLerpRate = fadeOutLerpRate;
    this.appearStart = p.millis();
    this.alpha = 0;

    // reusable temp vector — avoids per-frame allocations in update()
    this._tmp = p.createVector(0, 0);
  }

  setImage(image) {
    this.image = image;
  }

  update(mouseVec) {
    this._tmp.set(this.base);
    this._tmp.sub(this.pos);
    this._tmp.mult(this.stiffness);
    this.vel.mult(this.damping);
    this.vel.add(this._tmp);

    // repulsionStrength is the push *budget*; repulsionVelocityScale turns it
    // into the gentle drift the tiles actually need — full strength would whip.
    if (mouseVec) {
      const dx = this.pos.x - mouseVec.x;
      const dy = this.pos.y - mouseVec.y;
      const d = Math.hypot(dx, dy);
      if (d < this.repulsionRadius && d > 1e-3) {
        const t = 1 - d / this.repulsionRadius;
        const push = t * t * this.repulsionStrength * this.repulsionRadius;
        this.vel.x += (dx / d) * push * this.repulsionVelocityScale;
        this.vel.y += (dy / d) * push * this.repulsionVelocityScale;
      }
    }

    if (this.vel.magSq() > this.maxSpeed * this.maxSpeed) {
      this.vel.setMag(this.maxSpeed);
    }

    this.pos.add(this.vel);

    // fade-out overrides fade-in once requested; rate tracks the field collapse
    // (sibling of CONFIG.preview.closingLerpRate)
    if (this._fadingOut) {
      this.alpha = this.p.lerp(this.alpha, 0, this.fadeOutLerpRate);
      if (this.alpha < 0.005) this.alpha = 0;
    } else {
      const elapsed = this.p.millis() - this.appearStart - this.appearDelay;
      const targetAlpha =
        elapsed > 0
          ? this.p.constrain(elapsed / this.fadeInDurationMs, 0, 1)
          : 0;
      this.alpha = targetAlpha;
    }
  }

  // controller sets the flag then polls isFullyHidden() before unmounting
  requestFadeOut() {
    this._fadingOut = true;
  }

  draw() {
    const p = this.p;
    if (this.alpha < 0.01) return;

    const a = this.alpha;

    p.push();
    p.translate(this.pos.x, this.pos.y);
    if (this.rotation) p.rotate(this.rotation);

    if (this.image && this.image.width > 0) {
      // recomputed each frame: image may finish loading after construction,
      // changing the aspect ratio used to fit inside the (size × maxHeight) slot
      const aspect = this.image.height / this.image.width;
      let w = this.size;
      let h = w * aspect;
      if (this.maxHeight && h > this.maxHeight) {
        h = this.maxHeight;
        w = aspect > 0 ? h / aspect : this.size;
      }
      p.imageMode(p.CENTER);
      p.tint(255, 255 * a);
      p.image(this.image, 0, 0, w, h);
      p.noTint();
    } else {
      // soft gray placeholder shown until the image loads (or if load fails)
      p.noStroke();
      p.fill(230, 255 * a);
      p.rectMode(p.CENTER);
      p.rect(0, 0, this.size, this.size * 0.75, 6);
    }

    p.pop();
  }

  isFullyHidden() {
    return this._fadingOut && this.alpha < 0.01;
  }
}
