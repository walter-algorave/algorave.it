export class VectorField {
  // ── CONSTRUCTOR ───────────────────────────────────────────────────────────
  // All numeric values must come pre-built from buildResponsiveFieldConfig() /
  // CONFIG.field — no fallback defaults; a missing key surfaces NaN immediately
  // (config = single source of truth, same contract as BloomingFlower).
  constructor(
    p,
    {
      spacing,
      arrowLen,
      strokeColor,
      cursorClearRadius,
      cursorClearFeather,
      stiffness,
      damping,
      maxSpeed,
      mouseLerp,
      falloffMultiplier,
      outerStrength,
      innerExtraStrength,
      innerEase,
      outerFalloffExponent,
      directionEpsilon,
      pushEpsilon,
      angleEpsilon,
      arrowShape,
      pointerPresence,
      arrowCulling,
      featherPushStrength,
    } = {},
  ) {
    this.p = p;
    this.spacing = spacing;
    this.arrowLen = arrowLen;
    this.strokeColor = strokeColor;
    this.cursorClearRadius = cursorClearRadius;
    this.cursorClearFeather = cursorClearFeather;

    this.stiffness = stiffness;
    this.damping = damping;
    this.maxSpeed = maxSpeed;

    this.mouseLerp = p.constrain(mouseLerp, 0, 1);
    this.falloffMultiplier = falloffMultiplier;
    this.outerStrength = outerStrength;
    this.innerExtraStrength = innerExtraStrength;
    this.innerEase = innerEase;
    this.outerFalloffExponent = outerFalloffExponent;
    this.directionEpsilon = directionEpsilon;
    this.pushEpsilon = pushEpsilon;
    this.angleEpsilon = angleEpsilon;

    this.arrowShape = { ...arrowShape };
    this.arrowCulling = { ...arrowCulling };
    this.featherPushStrength = featherPushStrength;
    this.pointerPresenceConfig = {
      enterRate: p.constrain(pointerPresence.enterRate, 0, 1),
      exitRate: p.constrain(pointerPresence.exitRate, 0, 1),
    };
    this.pointerPresenceValue = 0;
    this.pointerInCanvas = false;

    this.smoothedMouse = p.createVector(0, 0);

    // Normally tracks smoothedMouse, but switches to a flower's center while that
    // flower is fully bloomed (BloomingFlower.isFullyBloomed owns the hysteresis).
    // Arrows then orient toward the flower rather than the raw cursor, reinforcing
    // the "pulled inward" feel. Lerps at the same rate as the mouse.
    this.smoothedRotationTarget = p.createVector(0, 0);
    this._rotationInit = false;
    this._mouseInit = false;

    // reusable temp vectors — avoid per-frame allocations in the hot loop
    this._tmpDiff = p.createVector(0, 0);
    this._tmpDir = p.createVector(0, 0);
    this._tmpTarget = p.createVector(0, 0);
    this._tmpToTarget = p.createVector(0, 0);
    this._tmpDirToMouse = p.createVector(0, 0);

    this.base = [];
    this.pos = [];
    this.vel = [];
    this.rebuild();
  }

  // ── GRID ──────────────────────────────────────────────────────────────────

  rebuild() {
    this.base.length = 0;
    this.pos.length = 0;
    this.vel.length = 0;

    const paddingX = Math.min(this.arrowLen, this.p.width / 2);
    const paddingY = Math.min(this.arrowLen, this.p.height / 2);
    const availableWidth = Math.max(this.p.width - paddingX * 2, 0);
    const availableHeight = Math.max(this.p.height - paddingY * 2, 0);

    const cols = Math.floor(availableWidth / this.spacing) + 1;
    const rows = Math.floor(availableHeight / this.spacing) + 1;
    const totalWidth = (cols - 1) * this.spacing;
    const totalHeight = (rows - 1) * this.spacing;
    const x0 = (this.p.width - totalWidth) / 2;
    const y0 = (this.p.height - totalHeight) / 2;

    this.gridX0 = x0;
    this.gridY0 = y0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = x0 + c * this.spacing;
        const py = y0 + r * this.spacing;
        const pVec = this.p.createVector(px, py);
        this.base.push(pVec);
        this.pos.push(pVec.copy());
        this.vel.push(this.p.createVector(0, 0));
      }
    }
  }

  // Snaps an arbitrary point to the center of the grid cell that contains it.
  // Cell centers sit halfway between vertices: the -0.5 shift before rounding
  // picks the cell index, +0.5 recovers its center. Used to align flowers and
  // labels to a stable sub-grid position.
  getNearestGridCenter(x, y) {
    const col = Math.round((x - this.gridX0) / this.spacing - 0.5);
    const row = Math.round((y - this.gridY0) / this.spacing - 0.5);

    const centerX = this.gridX0 + (col + 0.5) * this.spacing;
    const centerY = this.gridY0 + (row + 0.5) * this.spacing;

    return { x: centerX, y: centerY };
  }

  applyResponsiveConfig(config) {
    this.spacing = config.spacing;
    this.arrowLen = config.arrowLen;
    this.strokeColor = config.strokeColor ?? this.strokeColor;
    this.cursorClearRadius = config.cursorClearRadius ?? this.cursorClearRadius;
    this.cursorClearFeather =
      config.cursorClearFeather ?? this.cursorClearFeather;
    this.falloffMultiplier = config.falloffMultiplier;
    if (config.arrowCulling) {
      this.arrowCulling = { ...this.arrowCulling, ...config.arrowCulling };
    }
    if (config.pointerPresence) {
      this.pointerPresenceConfig = {
        ...this.pointerPresenceConfig,
        ...config.pointerPresence,
      };
      this.pointerPresenceConfig.enterRate = this.p.constrain(
        this.pointerPresenceConfig.enterRate,
        0,
        1,
      );
      this.pointerPresenceConfig.exitRate = this.p.constrain(
        this.pointerPresenceConfig.exitRate,
        0,
        1,
      );
    }
    if (config.featherPushStrength !== undefined) {
      this.featherPushStrength = config.featherPushStrength;
    }
    this.rebuild();
  }

  // ── PHYSICS & UPDATE ──────────────────────────────────────────────────────

  updateAndDraw(mx, my, revealTargets = []) {
    const curMouse = this.p.createVector(mx, my);
    if (!this._mouseInit) {
      this.smoothedMouse.set(curMouse);
      this._mouseInit = true;
    } else {
      this.smoothedMouse.lerp(curMouse, this.mouseLerp);
    }
    const m = this.smoothedMouse;
    const pointerPresence = this._updatePointerPresence();

    const targets = Array.isArray(revealTargets)
      ? revealTargets
      : revealTargets
        ? [revealTargets]
        : [];

    const activeHoles = [];
    for (const target of targets) {
      const data = target.computeHole(m.copy());
      if (data) {
        activeHoles.push(data);
      }
      if (typeof target.getExtraRepulsion === "function") {
        const extraRepulsor = target.getExtraRepulsion();
        if (extraRepulsor) {
          // providers may emit one repulsor or several (e.g. FlowerPreview emits
          // one per content block) — flatten so the physics loop stays uniform
          if (Array.isArray(extraRepulsor)) {
            for (const r of extraRepulsor) if (r) activeHoles.push(r);
          } else {
            activeHoles.push(extraRepulsor);
          }
        }
      }
    }

    const repulsors = activeHoles.map((h) => {
      if (h.type === "rect") {
        const halfWidth = h.width / 2;
        const halfHeight = h.height / 2;
        return {
          type: "rect",
          center: h.center,
          halfWidth,
          halfHeight,
          clearPadding: h.clearPadding,
          featherPadding: h.featherPadding,
          cornerRadius: h.cornerRadius || 0,
          strength: h.strength || 1,
        };
      } else {
        const holeCenter = h.center;
        const baseHoleRadius = h.radius;
        const holeRadius = baseHoleRadius * pointerPresence;
        const falloffRange = holeRadius * this.falloffMultiplier;
        const outerRadius = holeRadius + falloffRange;
        const boundaryPush = falloffRange * this.outerStrength;

        const holeClearRadius = h.clearRadius;
        const holeClearFeather = h.clearFeather;

        return {
          type: "circle",
          center: holeCenter,
          holeRadius,
          falloffRange,
          outerRadius,
          boundaryPush,
          holeClearRadius,
          holeClearFeather,
          activation: h.activation,
        };
      }
    });

    let maxActivation = 0;
    for (const r of repulsors) {
      if (r.type === "circle" && r.activation > maxActivation) {
        maxActivation = r.activation;
      }
    }

    // Cursor repulsion blends out smoothly as any visible flower reaches full
    // bloom (its hole activation → 1). Applies to main flowers and preview-scoped
    // action flowers alike — same code path keeps the hover feel consistent
    // across both, and the cursor returns naturally as activations decay.
    const blendingFactor = 1 - maxActivation;
    const cursorClearRadius =
      this.cursorClearRadius * pointerPresence * blendingFactor;
    const cursorClearFeather =
      this.cursorClearFeather * pointerPresence * blendingFactor;

    let maxMagnetism = 0;
    let activeSnapCenter = null;
    for (const h of activeHoles) {
      if (h.snapCenter && (h.magnetism || 0) > maxMagnetism) {
        maxMagnetism = h.magnetism;
        activeSnapCenter = h.snapCenter;
      }
    }

    // magnetism=1 → arrows point exactly at the flower; as magnetism lerps back
    // to 0 the target returns smoothly to the cursor
    let rotationTarget = m;
    if (activeSnapCenter && maxMagnetism > 0) {
      rotationTarget = p5.Vector.lerp(m, activeSnapCenter, maxMagnetism);
    }

    if (!this._rotationInit) {
      this.smoothedRotationTarget.set(rotationTarget);
      this._rotationInit = true;
    } else {
      this.smoothedRotationTarget.lerp(rotationTarget, this.mouseLerp);
    }

    for (let i = 0; i < this.base.length; i++) {
      const base = this.base[i];
      const pos = this.pos[i];
      const vel = this.vel[i];

      // ── arrow culling ── compute presence BEFORE displacement.
      // Arrows whose grid-base sits deep inside a repulsor get presence → 0:
      // neither displaced nor drawn. Prevents the rim pile-up where displaced
      // arrows would otherwise stack against the hole boundary.
      let presence = 1;
      let renderAlpha = 1;
      const ccf = this.arrowCulling.circleCoreFraction;
      const rcf = this.arrowCulling.rectCoreFraction;

      for (const repulsor of repulsors) {
        if (presence < 0.01) break;
        if (repulsor.type === "circle") {
          if (repulsor.holeRadius < 1e-3) continue;
          const act = repulsor.activation ?? 0;
          if (act < 1e-3) continue;
          this._tmpDiff.set(base);
          this._tmpDiff.sub(repulsor.center);
          const d = this._tmpDiff.mag();
          const coreR = repulsor.holeRadius * ccf;
          let finalLp = 1;
          if (d < coreR) finalLp = 0;
          else if (d < repulsor.holeRadius)
            finalLp = (d - coreR) / (repulsor.holeRadius - coreR);

          let curPresence = 1 - act * (1 - finalLp);
          if (curPresence < presence) presence = curPresence;

          if (finalLp === 0) {
            if (curPresence < renderAlpha) renderAlpha = curPresence;
          }
        } else if (repulsor.type === "rect") {
          const scale = repulsor.strength ?? 0;
          if (scale < 1e-3) continue;

          const bW_final = repulsor.halfWidth + (repulsor.clearPadding || 0);
          const bH_final = repulsor.halfHeight + (repulsor.clearPadding || 0);
          const r_final = Math.min(
            repulsor.cornerRadius || 0,
            bW_final,
            bH_final,
          );

          this._tmpDiff.set(base);
          this._tmpDiff.sub(repulsor.center);
          const dx_final = Math.abs(this._tmpDiff.x) - (bW_final - r_final);
          const dy_final = Math.abs(this._tmpDiff.y) - (bH_final - r_final);
          const dist_final =
            Math.sqrt(Math.max(dx_final, 0) ** 2 + Math.max(dy_final, 0) ** 2) +
            Math.min(Math.max(dx_final, dy_final), 0) -
            r_final;

          let lp = 1;
          if (dist_final <= 0) {
            lp = 1 - scale;
            if (lp < renderAlpha) renderAlpha = lp;
          }

          if (lp < presence) presence = lp;
        }
      }

      if (presence < 0.01) {
        pos.set(base);
        vel.set(0, 0);
        continue;
      }

      this._tmpTarget.set(base);

      // Accumulate forces from every active repulsor.
      // Asymmetry: circles scale the inside push by `presence` so culling arrows
      // ease out, while rects push the exact SDF distance to the boundary
      // (the geometry already guarantees the arrow exits the cavity in one step).
      for (const repulsor of repulsors) {
        this._tmpDiff.set(base);
        this._tmpDiff.sub(repulsor.center);

        if (repulsor.type === "rect") {
          // Rounded-rect SDF: sdRoundBox(p, b, r) = sdBox(p, b - r) - r.
          // Compute the box SDF against the shrunk box (bW-r, bH-r), then
          // subtract r. Gradient direction matches the raw box SDF — only the
          // distance shifts.
          const scale = repulsor.strength;
          if (scale < 1e-4) continue;

          const bW =
            (repulsor.halfWidth + (repulsor.clearPadding || 0)) * scale;
          const bH =
            (repulsor.halfHeight + (repulsor.clearPadding || 0)) * scale;
          const feather = (repulsor.featherPadding || 0) * scale;
          const cornerR = Math.min(
            (repulsor.cornerRadius || 0) * scale,
            bW,
            bH,
          );

          if (bW < 1e-4 || bH < 1e-4) continue;

          const bSW = bW - cornerR;
          const bSH = bH - cornerR;
          const dx = Math.abs(this._tmpDiff.x) - bSW;
          const dy = Math.abs(this._tmpDiff.y) - bSH;
          const rawDist =
            Math.sqrt(Math.max(dx, 0) ** 2 + Math.max(dy, 0) ** 2) +
            Math.min(Math.max(dx, dy), 0);
          const dist = rawDist - cornerR;

          if (dist > feather) continue;

          let nx = 0,
            ny = 0;
          if (rawDist > 0) {
            const vecX = Math.max(dx, 0) * Math.sign(this._tmpDiff.x);
            const vecY = Math.max(dy, 0) * Math.sign(this._tmpDiff.y);
            const len = Math.sqrt(vecX * vecX + vecY * vecY);
            if (len > 1e-4) {
              nx = vecX / len;
              ny = vecY / len;
            }
          } else {
            if (dx > dy) {
              nx = Math.sign(this._tmpDiff.x) || 1;
              ny = 0;
            } else {
              nx = 0;
              ny = Math.sign(this._tmpDiff.y) || 1;
            }
          }

          if (dist < 0) {
            // inside hard zone: push exactly to the boundary, plus a constant
            // feather offset so the arrow settles just outside
            const extraPush =
              feather > 0 ? feather * this.featherPushStrength : 0;
            this._tmpTarget.x += nx * (-dist + extraPush);
            this._tmpTarget.y += ny * (-dist + extraPush);
          } else {
            // outside hard zone, inside feather: quadratic ease-out push
            if (feather > 0) {
              const t = dist / feather;
              const pushFactor = (1 - t) * (1 - t);
              const push = feather * pushFactor * this.featherPushStrength;

              this._tmpTarget.x += nx * push;
              this._tmpTarget.y += ny * push;
            }
          }
        } else {
          const d = this._tmpDiff.mag();

          if (d < repulsor.outerRadius) {
            if (d > this.directionEpsilon) {
              this._tmpDir.set(this._tmpDiff);
              this._tmpDir.mult(1 / d);
            } else {
              this._tmpDir.set(1, 0);
            }

            if (d < repulsor.holeRadius) {
              const insideNorm = this.p.constrain(
                (repulsor.holeRadius - d) / repulsor.holeRadius,
                0,
                1,
              );
              const eased = 1 - Math.exp(-this.innerEase * insideNorm);
              const push =
                repulsor.boundaryPush +
                repulsor.falloffRange * this.innerExtraStrength * eased;

              this._tmpDir.mult(push * presence);
              this._tmpTarget.add(this._tmpDir);
            } else {
              const falloffNorm = this.p.constrain(
                (repulsor.outerRadius - d) / repulsor.falloffRange,
                0,
                1,
              );
              const eased = this.p.pow(falloffNorm, this.outerFalloffExponent);
              const push = repulsor.falloffRange * this.outerStrength * eased;

              if (push > this.pushEpsilon) {
                this._tmpDir.mult(push);
                this._tmpTarget.add(this._tmpDir);
              }
            }
          }
        }
      }

      this._applyClearPush(base, m, cursorClearRadius, cursorClearFeather);

      for (const repulsor of repulsors) {
        if (repulsor.type === "circle" && repulsor.holeClearRadius > 0) {
          this._applyClearPush(
            base,
            repulsor.center,
            repulsor.holeClearRadius,
            repulsor.holeClearFeather,
          );
        }
      }

      this._tmpToTarget.set(this._tmpTarget);
      this._tmpToTarget.sub(pos);
      this._tmpToTarget.mult(this.stiffness);

      vel.mult(this.damping);
      vel.add(this._tmpToTarget);

      if (vel.magSq() > this.maxSpeed * this.maxSpeed) {
        vel.setMag(this.maxSpeed);
      }

      pos.add(vel);

      this._tmpDirToMouse.set(this.smoothedRotationTarget);
      this._tmpDirToMouse.sub(pos);

      const angle =
        this._tmpDirToMouse.magSq() > this.angleEpsilon
          ? this._tmpDirToMouse.heading()
          : 0;

      this.p.push();
      this.p.translate(pos.x, pos.y);
      this.p.rotate(angle);
      if (renderAlpha < 1) {
        this.p.drawingContext.globalAlpha = renderAlpha;
      }
      this._arrow(this.arrowLen);
      this.p.pop();
    }
  }

  // ── RENDERING & HELPERS ───────────────────────────────────────────────────

  // Soft circular exclusion push around `center`: arrows inside `clearRadius`
  // get a firm outward push; arrows in the feather band fall off quadratically.
  _applyClearPush(base, center, clearRadius, clearFeather) {
    if (clearRadius <= 0 && clearFeather <= 0) return;

    this._tmpDiff.set(base);
    this._tmpDiff.sub(center);
    const d = this._tmpDiff.mag();

    if (d >= clearRadius + clearFeather) return;

    if (d > this.directionEpsilon) {
      this._tmpDir.set(this._tmpDiff);
      this._tmpDir.mult(1 / d);
    } else {
      this._tmpDir.set(1, 0);
    }

    let push = 0;
    if (d < clearRadius) {
      push = clearRadius - d + clearFeather * this.featherPushStrength;
    } else if (clearFeather > 0) {
      const t = 1 - (d - clearRadius) / clearFeather;
      push = clearFeather * (t * t) * this.featherPushStrength;
    }

    if (push > 0) {
      this._tmpDir.mult(push);
      this._tmpTarget.add(this._tmpDir);
    }
  }

  _arrow(len) {
    const { shaftRatio, tipLengthRatio, tipWidthRatio } = this.arrowShape;
    const shaftHalf = len * shaftRatio;
    const tipLength = len * tipLengthRatio;
    const tipWidth = len * tipWidthRatio;

    const tipStart = shaftHalf;
    const tipEnd = tipStart + tipLength;

    this.p.line(-shaftHalf, 0, tipEnd, 0);
    this.p.line(tipEnd, 0, tipStart, tipWidth);
    this.p.line(tipEnd, 0, tipStart, -tipWidth);
  }

  // ── POINTER STATE ─────────────────────────────────────────────────────────

  _updatePointerPresence() {
    const hasPointer = this._hasActivePointer();
    const target = hasPointer ? 1 : 0;
    const rate = hasPointer
      ? this.pointerPresenceConfig.enterRate
      : this.pointerPresenceConfig.exitRate;
    const clampedRate = this.p.constrain(rate, 0, 1);
    this.pointerPresenceValue = this.p.lerp(
      this.pointerPresenceValue,
      target,
      clampedRate,
    );
    if (this.p.abs(this.pointerPresenceValue - target) < 1e-3) {
      this.pointerPresenceValue = target;
    }
    return this.pointerPresenceValue;
  }

  _hasActivePointer() {
    return this.pointerInCanvas;
  }

  setPointerInCanvas(state) {
    this.pointerInCanvas = !!state;
  }

  resetPointerState() {
    this.pointerInCanvas = false;
    this.pointerPresenceValue = 0;
    this._mouseInit = false;
    this._rotationInit = false;
  }
}
