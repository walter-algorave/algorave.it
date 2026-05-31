import { drawStyledText } from "./textUtils.js";

export class BloomingFlower {
  // ── CONSTRUCTOR ───────────────────────────────────────────────────────────
  // All numeric values must come pre-built from buildResponsiveFlowerConfig() —
  // no fallback defaults; a missing key crashes loudly in dev (config = single source of truth).
  constructor(
    p,
    {
      // geometry (resolved to px by buildResponsiveFlowerConfig)
      radius,
      revealRadius,
      initialHoleRadius,
      tapLockRadius,
      snapInRadius,
      snapOutRadius,
      holePadding,
      clearRadius,
      clearFeather,
      // interaction
      revealStart,
      snapLerpRate,
      magnetismLerpEngage,
      magnetismLerpHover,
      magnetismLerpLocked,
      // activation lerp
      activationLerpMinRate,
      activationLerpMaxRate,
      activationLerpDeltaWindow,
      activationLerpMinRateExit,
      activationLerpMaxRateExit,
      lockedActivationRate,
      // decoupled from lockedActivationRate: field collapses fast, sprite keeps cinematic close
      lockedFieldActivationRate,
      // visual
      fadeInExponent,
      frameHoldActivation,
      activationVisibilityThreshold,
      rotationMaxDegrees,
      rotationExponent,
      frameProgressExponent,
      glowBase,
      glowGain,
      bodyScaleBase,
      bodyScaleGain,
      // sprite sheet
      gridCols,
      gridRows,
      // instance
      x,
      y,
      label,
      labelConfig,
      idle,
      preview = null, // { url, … } — marks flower as clickable hotspot; consumed by PreviewManager
      link = null, // direct URL — click opens it (no preview); PreviewManager + an <a> overlay handle it
      action = null, // { type: 'close' | 'link' } — preview-scoped button; BloomingFlower doesn't interpret it
      springRelease = null,
      pressLerpRate,
      pressScaleGain,
    } = {},
    spriteImage,
  ) {
    this.p = p;
    this.radius = radius;
    this.revealRadius = revealRadius;
    this.initialHoleRadius = initialHoleRadius;
    this.tapLockRadius = tapLockRadius;
    this.snapInRadius = snapInRadius;
    this.snapOutRadius = snapOutRadius;
    this.holePadding = holePadding;
    this.clearRadius = clearRadius;
    this.clearFeather = clearFeather;
    this.revealStart = revealStart;
    this.activationLerpMinRate = activationLerpMinRate;
    this.activationLerpMaxRate = activationLerpMaxRate;
    this.activationLerpDeltaWindow = activationLerpDeltaWindow;
    this.activationLerpMinRateExit = activationLerpMinRateExit;
    this.activationLerpMaxRateExit = activationLerpMaxRateExit;
    this.fadeInExponent = fadeInExponent;
    this.frameHoldActivation = frameHoldActivation;
    this.activationVisibilityThreshold = activationVisibilityThreshold;
    this.rotationMaxDegrees = rotationMaxDegrees;
    this.rotationExponent = rotationExponent;
    this.frameProgressExponent = frameProgressExponent;
    this.rotationMaxRad = p.radians(rotationMaxDegrees);
    this.glowBase = glowBase;
    this.glowGain = glowGain;
    this.bodyScaleBase = bodyScaleBase;
    this.bodyScaleGain = bodyScaleGain;
    this.gridCols = gridCols;
    this.gridRows = gridRows ?? gridCols; // square unless gridRows is specified
    this.frameCount = this.gridCols * this.gridRows;
    this.snapLerpRate = snapLerpRate;
    this.magnetismLerpEngage = magnetismLerpEngage;
    this.magnetismLerpHover = magnetismLerpHover;
    this.magnetismLerpLocked = magnetismLerpLocked;

    this.magnetism = 0;

    this.label = label;
    this.labelConfig = labelConfig;
    this.labelActivation = 0;
    this.labelVisible = false;

    // idle
    this.idleConfig = idle;
    this.idleActivation = 0;
    this.isWinking = false;
    this.nextWinkTime = 0;
    this.winkStartTime = 0;

    this.spriteImage = spriteImage;

    this.center = p.createVector(x ?? p.width / 2, y ?? p.height / 2);

    this.proximity = 0;
    this.activation = 0;
    this.animActivation = 0;
    this.visible = false;
    this._hole = null;
    this._extraRepulsion = null;
    this._labelWidth = null; // cache reset on resize via applyResponsiveConfig
    this._labelHeight = null;

    this.preview = preview;
    this.link = link;
    this.action = action;

    // press: lerps 0→1 while pointer is held
    this.pressed = false;
    this.pressAmount = 0;
    this.pressLerpRate = pressLerpRate;
    this.pressScaleGain = pressScaleGain;

    // lock: when true, computeHole ignores proximity and lerps toward lockedActivationTarget
    this.interactionLocked = false;
    this.lockedActivationTarget = 0;
    this.lockedActivationRate = lockedActivationRate;
    this.lockedFieldActivationRate = lockedFieldActivationRate;

    // drives circular hole geometry; tracks activation when unlocked, collapses fast when locked
    this.fieldActivation = 0;

    // clicked then released outside — locked for close animation, self-unlocks once fully closed
    this._tapCancelled = false;

    // spring release: visual overshoot on pointer up (rise → hold → fall)
    this.springRelease = springRelease;
    this.springAmount = 0;
    this._springActive = false;
    this._springPeaked = false;
    this._springPeakFrames = 0;
  }

  // ── RESPONSIVE ────────────────────────────────────────────────────────────

  applyResponsiveConfig(config) {
    Object.assign(this, config);
    if (this.rotationMaxDegrees !== undefined) {
      this.rotationMaxRad = this.p.radians(this.rotationMaxDegrees);
    }

    if (config.x !== undefined && config.y !== undefined) {
      this.center.set(config.x, config.y);
    }
    this._hole = null;
    // font size may have changed — invalidate cached text measurements
    this._labelWidth = null;
    this._labelHeight = null;
  }

  // ── IDLE ──────────────────────────────────────────────────────────────────

  updateIdle(time, isIdle) {
    if (this.interactionLocked) {
      this.idleActivation = 0;
      this.isWinking = false;
      return;
    }
    if (!this.idleConfig) return;

    if (!isIdle || this.activation > 0.01) {
      this.idleActivation = 0;
      this.isWinking = false;
      this.nextWinkTime =
        time +
        this.p.random(
          this.idleConfig.winkIntervalMin,
          this.idleConfig.winkIntervalMax,
        );
      return;
    }

    if (!this.isWinking && time > this.nextWinkTime) {
      this.isWinking = true;
      this.winkStartTime = time;
    }

    if (this.isWinking) {
      const elapsed = time - this.winkStartTime;
      const duration = this.idleConfig.winkDuration;

      if (elapsed >= duration) {
        this.isWinking = false;
        this.idleActivation = 0;
        this.nextWinkTime =
          time +
          this.p.random(
            this.idleConfig.winkIntervalMin,
            this.idleConfig.winkIntervalMax,
          );
      } else {
        const progress = elapsed / duration;
        const sineValue = Math.sin(progress * Math.PI);
        this.idleActivation = sineValue * this.idleConfig.winkIntensity;
      }
    }
  }

  // ── HOLE / FIELD ──────────────────────────────────────────────────────────

  computeHole(mouseVec) {
    const dist = this.p.dist(
      mouseVec.x,
      mouseVec.y,
      this.center.x,
      this.center.y,
    );
    this.proximity = this.p.constrain(1 - dist / this.revealRadius, 0, 1);

    let targetActivation;
    if (this.interactionLocked) {
      targetActivation = this.lockedActivationTarget;
      this.activation = this.p.lerp(
        this.activation,
        targetActivation,
        this.lockedActivationRate,
      );
    } else {
      const normalized = this.p.constrain(
        (this.proximity - this.revealStart) / (1 - this.revealStart),
        0,
        1,
      );
      targetActivation = this._easeOutCubic(normalized);

      const delta = this.p.abs(targetActivation - this.activation);
      const exiting = targetActivation < this.activation;
      const minRate =
        exiting && this.activationLerpMinRateExit !== undefined
          ? this.activationLerpMinRateExit
          : this.activationLerpMinRate;
      const maxRate =
        exiting && this.activationLerpMaxRateExit !== undefined
          ? this.activationLerpMaxRateExit
          : this.activationLerpMaxRate;
      const rate = this.p.constrain(
        this.p.map(delta, 0, this.activationLerpDeltaWindow, minRate, maxRate),
        minRate,
        maxRate,
      );

      this.activation = this.p.lerp(this.activation, targetActivation, rate);
    }
    if (this.p.abs(this.activation - targetActivation) < 1e-4) {
      this.activation = targetActivation;
    }

    // hysteresis: smaller radius snaps in, larger snaps out — prevents flicker at boundary
    const currentSnapRadius = this.isFullyBloomed
      ? this.snapOutRadius
      : this.snapInRadius;

    // single source of truth: instant activation + label display + vector snap
    this.isFullyBloomed =
      !this.interactionLocked && currentSnapRadius && dist < currentSnapRadius;

    if (this.isFullyBloomed) {
      this.activation = 1.0;
    }

    // when locked, isFullyBloomed is false → targetMagnetism = 0 → decays at magnetismLerpLocked
    const targetMagnetism = this.isFullyBloomed ? 1.0 : 0.0;
    const magRate =
      targetMagnetism > this.magnetism
        ? this.magnetismLerpEngage
        : this.interactionLocked
          ? this.magnetismLerpLocked
          : this.magnetismLerpHover;

    this.magnetism = this.p.lerp(this.magnetism, targetMagnetism, magRate);
    if (this.p.abs(this.magnetism - targetMagnetism) < 1e-3) {
      this.magnetism = targetMagnetism;
    }

    // when locked: collapses at lockedFieldActivationRate so the circular repulsor fades out
    // as the preview rect repulsor ramps up — the two overlap briefly, no velocity snap
    if (this.interactionLocked) {
      this.fieldActivation = this.p.lerp(
        this.fieldActivation,
        0,
        this.lockedFieldActivationRate,
      );
      if (this.fieldActivation < 1e-3) this.fieldActivation = 0;
    } else {
      this.fieldActivation = this.activation;
    }

    // tap-cancel: re-enables proximity once both sprite and field have finished closing
    if (
      this._tapCancelled &&
      this.activation < 0.02 &&
      this.fieldActivation < 0.02
    ) {
      this.interactionLocked = false;
      this._tapCancelled = false;
    }

    const idleHoleActivation =
      this.idleActivation *
      (this.idleConfig ? this.idleConfig.holeIntensity : 0);

    let spriteActivation = this.activation;
    let useIdleCenter = false;
    if (idleHoleActivation > spriteActivation) {
      spriteActivation = idleHoleActivation;
      useIdleCenter = true;
    }

    this.visible = spriteActivation > this.activationVisibilityThreshold;

    if (!this.visible) {
      this._hole = null;
      this.labelActivation = 0;
      this.labelVisible = false;
      this._extraRepulsion = null;
      return null;
    }

    const fieldEffectiveActivation = Math.max(
      this.fieldActivation,
      idleHoleActivation,
    );

    // field has collapsed: sprite finishes its cinematic close while arrows have already settled
    if (fieldEffectiveActivation <= this.activationVisibilityThreshold) {
      this._hole = null;
      return null;
    }

    const targetRadius = this.radius + this.holePadding;
    // floor collapses to 0 before visibility culling — eliminates pop on cull
    const radiusFloor =
      this.initialHoleRadius *
      this.p.constrain(
        fieldEffectiveActivation / (this.activationVisibilityThreshold * 2),
        0,
        1,
      );
    const radius = this.p.lerp(
      radiusFloor,
      targetRadius,
      fieldEffectiveActivation,
    );

    // idle: hole centered on flower; hover: interpolates mouse → flower center
    const center = useIdleCenter
      ? this.center.copy()
      : mouseVec.copy().lerp(this.center, fieldEffectiveActivation);

    const clearRadius = this.clearRadius * fieldEffectiveActivation;
    const clearFeather = this.clearFeather;

    let snapCenter = null;
    if (this.magnetism > 0) {
      snapCenter = this.center;
    }

    // explicit type avoids ambiguity with rect repulsors from label / preview
    this._hole = {
      type: "circle",
      center,
      radius,
      clearRadius,
      clearFeather,
      activation: fieldEffectiveActivation,
      snapCenter,
      magnetism: this.magnetism,
    };
    return this._hole;
  }

  // ── LABEL ─────────────────────────────────────────────────────────────────

  updateLabel(field) {
    if (!this.label || !this.labelConfig) return;

    const targetLabelActivation = this.isFullyBloomed ? 1 : 0;

    const rate =
      targetLabelActivation > this.labelActivation
        ? this.labelConfig.activationRate
        : this.labelConfig.deactivationRate;

    this.labelActivation = this.p.lerp(
      this.labelActivation,
      targetLabelActivation,
      rate,
    );

    if (this.p.abs(this.labelActivation - targetLabelActivation) < 1e-3) {
      this.labelActivation = targetLabelActivation;
    }

    this.labelVisible = this.labelActivation > 0.01;
    this._extraRepulsion = null;

    if (this.labelVisible) {
      // measured once per font size; cache reset on resize via applyResponsiveConfig
      if (this._labelWidth === null) {
        this.p.push();
        this.p.textSize(this.labelConfig.fontSize);
        this.p.textFont(this.labelConfig.fontFamily);
        this._labelWidth = this.p.textWidth(this.label);
        this._labelHeight = this.labelConfig.fontSize;
        this.p.pop();
      }
      const w = this._labelWidth;
      const h = this._labelHeight;

      // always at screen center — global canvas caption, not a tooltip near the flower
      const snapped = field.getNearestGridCenter(
        this.p.width / 2,
        this.p.height / 2,
      );
      const labelCenter = this.p.createVector(snapped.x, snapped.y);

      this.currentLabelCenter = labelCenter;

      // curve strength rather than geometry so the bbox stays stable during fade
      const exp = this.labelConfig.fadeInExponent;
      const strength = this.p.pow(
        this.p.constrain(this.labelActivation, 0, 1),
        exp,
      );

      this._extraRepulsion = {
        type: "rect",
        center: labelCenter,
        width: w,
        height: h,
        clearPadding: this.labelConfig.clearPadding,
        featherPadding: this.labelConfig.featherPadding,
        cornerRadius: this.labelConfig.cornerRadius ?? 0,
        strength,
      };
    }
  }

  getExtraRepulsion() {
    return this._extraRepulsion;
  }

  _easeOutCubic(t) {
    const clamped = this.p.constrain(t, 0, 1);
    return 1 - this.p.pow(1 - clamped, 3);
  }

  // ── DRAW ──────────────────────────────────────────────────────────────────

  draw() {
    // always advance — recovery animation must complete even while flower is fading
    const pressTarget = this.pressed ? 1 : 0;
    this.pressAmount = this.p.lerp(
      this.pressAmount,
      pressTarget,
      this.pressLerpRate,
    );
    if (this.p.abs(this.pressAmount - pressTarget) < 1e-3)
      this.pressAmount = pressTarget;

    // spring: rise → hold → fall; fall overlaps the lock close animation
    const sr = this.springRelease;
    if (this._springActive && sr?.enabled) {
      const rate = sr.riseRate;
      if (!this._springPeaked) {
        this.springAmount = this.p.lerp(this.springAmount, 1, rate);
        if (this.springAmount >= 0.85) {
          this._springPeaked = true;
          this._springPeakFrames = 0;
        }
      } else if (this._springPeakFrames < sr.peakHoldFrames) {
        this._springPeakFrames++;
        this.springAmount = this.p.lerp(this.springAmount, 1, rate);
      } else {
        this.springAmount = this.p.lerp(this.springAmount, 0, rate);
        if (this.springAmount < 0.02) {
          this.springAmount = 0;
          this._springActive = false;
        }
      }
    }

    // idle wink is visual-only (no physics hole) — needs its own visibility check
    const isIdleVisible =
      this.idleActivation > this.activationVisibilityThreshold;
    if ((!this.visible && !isIdleVisible) || !this.spriteImage) {
      return;
    }

    // smooth only on final snap to prevent pop when activation jumps to 1
    if (this.isFullyBloomed && !this.interactionLocked) {
      this.animActivation = this.p.lerp(
        this.animActivation,
        this.activation,
        this.snapLerpRate,
      );
      if (this.p.abs(this.animActivation - this.activation) < 1e-3)
        this.animActivation = this.activation;
    } else {
      this.animActivation = this.activation;
    }

    this.p.push();
    this.p.translate(this.center.x, this.center.y);
    const rotation = this.rotationMaxRad
      ? this.rotationMaxRad *
        (this.p.pow(this.animActivation, this.rotationExponent) - 1)
      : 0;
    this.p.rotate(rotation);
    this.p.imageMode(this.p.CENTER);

    const effectiveActivation = Math.max(
      this.animActivation,
      this.idleActivation,
    );

    const glow = this.glowBase + this.glowGain * effectiveActivation;

    const pressScale = 1 - this.pressScaleGain * this.pressAmount;
    const springMult =
      this._springActive && sr?.enabled
        ? 1 + sr.scaleGain * this.springAmount
        : 1;
    const scale =
      (this.bodyScaleBase + this.bodyScaleGain * effectiveActivation) *
      pressScale *
      springMult;
    const size = this.radius * 2 * scale;

    const fadeIn = this.p.pow(
      this.p.constrain(effectiveActivation, 0, 1),
      this.fadeInExponent,
    );
    const alpha = 255 * glow * fadeIn;

    // during spring, push frame selection toward the last (fully-bloomed) frame
    const frameActivation =
      this._springActive && sr?.enabled
        ? Math.max(effectiveActivation, this.springAmount)
        : effectiveActivation;

    const frameProgress =
      frameActivation <= this.frameHoldActivation
        ? 0
        : this.p.constrain(
            (frameActivation - this.frameHoldActivation) /
              (1 - this.frameHoldActivation),
            0,
            1,
          );

    const shapedProgress = this.p.pow(
      frameProgress,
      this.frameProgressExponent ?? 1,
    );

    let frameIndex = Math.floor(shapedProgress * (this.frameCount - 1));
    frameIndex = this.p.constrain(frameIndex, 0, this.frameCount - 1);

    const frameWidth = this.spriteImage.width / this.gridCols;
    const frameHeight = this.spriteImage.height / this.gridRows;

    const col = frameIndex % this.gridCols;
    const row = Math.floor(frameIndex / this.gridCols);

    const sx = col * frameWidth;
    const sy = row * frameHeight;

    this.p.tint(255, alpha);
    this.p.image(
      this.spriteImage,
      0,
      0,
      size,
      size,
      sx,
      sy,
      frameWidth,
      frameHeight,
    );
    this.p.noTint();

    this.p.pop();
  }

  drawLabel() {
    if (!this.labelVisible || !this.label || !this.labelConfig) return;

    const {
      fontSize,
      fontFamily,
      fontWeight = 400,
      color = 20,
    } = this.labelConfig;
    const pos =
      this.currentLabelCenter ||
      this.p.createVector(this.p.width / 2, this.p.height / 2);

    this.p.push();
    this.p.textAlign(this.p.CENTER, this.p.CENTER);
    this.p.noStroke();
    drawStyledText(this.p, this.label, pos.x, pos.y, {
      weight: fontWeight,
      size: fontSize,
      family: fontFamily,
      fill: color,
      alpha: 255 * this.labelActivation,
    });
    this.p.pop();
  }

  // ── PUBLIC API ────────────────────────────────────────────────────────────

  hasPreview() {
    return this.preview != null;
  }

  // Direct-link flower: clicking opens this.link (no preview). PreviewManager
  // gives it press/spring feedback and an invisible <a> overlay for the click.
  hasLink() {
    return !!this.link;
  }

  hasSpringEnabled() {
    return !!this.springRelease?.enabled;
  }

  isLocked() {
    return this.interactionLocked;
  }

  isTappable() {
    return this.isFullyBloomed;
  }

  setPressed(pressed) {
    this.pressed = !!pressed;
  }

  setLocked(locked) {
    this.interactionLocked = locked;
    this.lockedActivationTarget = 0;
    // clears _tapCancelled so external lock takes ownership (e.g. preview opens mid-close)
    this._tapCancelled = false;
  }

  // pointer released outside: lock for close animation, then self-unlock via computeHole
  cancelTap() {
    this.interactionLocked = true;
    this.lockedActivationTarget = 0;
    this._tapCancelled = true;
  }

  startSpringRelease() {
    this.springAmount = 0;
    this._springActive = true;
    this._springPeaked = false;
    this._springPeakFrames = 0;
  }

  // hold phase complete — PreviewManager fires _openPreview() here so fall and close overlap
  isSpringPeakDone() {
    return (
      this._springPeaked &&
      this._springPeakFrames >= this.springRelease.peakHoldFrames
    );
  }

  // activation near 0: sprite has finished its reverse-bloom close
  isFullyClosed() {
    return this.interactionLocked && this.activation < 0.02;
  }
}
