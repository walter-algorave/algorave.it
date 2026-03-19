export class BloomingFlower {
    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================
    // NOTE: Defaults here are fallbacks only — in normal usage all values arrive
    // pre-built from buildResponsiveFlowerConfig(). Keep them in sync with CONFIG.flower.
    constructor(p,
        {
            // Geometry (resolved to px by buildResponsiveFlowerConfig)
            radius = 50,
            revealRadius = 220,
            initialHoleRadius = 0,
            tapLockRadius = 0,
            snapRadius = 0,
            arrowSnapRadius = 0,
            holePadding = 30,
            clearRadius = 0,
            clearFeather = 0,
            // Interaction
            revealStart = 0.20,
            snapLerpRate = 0.3,
            // Activation lerp rates
            activationLerpMinRate = 0.025,
            activationLerpMaxRate = 0.1,
            activationLerpDeltaWindow = 0.3,
            activationLerpMinRateExit = 0.06,
            activationLerpMaxRateExit = 0.48,
            // Visual — keep aligned with CONFIG.flower
            fadeInExponent = 1.05,
            frameHoldActivation = 0.24,
            activationVisibilityThreshold = 0.05,
            rotationMaxDegrees = 60,
            rotationExponent = 1.4,
            frameProgressExponent = 0.8,
            glowBase = 0.45,
            glowGain = 0.65,
            bodyScaleBase = 0.45,
            bodyScaleGain = 0.35,
            // Sprite sheet layout
            gridCols = 6,
            gridRows,  // defaults to gridCols (square sprite sheet)
            // Instance-specific
            x,
            y,
            label,
            labelConfig,
            idle
        } = {},
        spriteImage
    ) {
        this.p = p;
        this.radius = radius;
        this.revealRadius = revealRadius;
        this.initialHoleRadius = initialHoleRadius;
        this.tapLockRadius = tapLockRadius;
        this.snapRadius = snapRadius;
        this.arrowSnapRadius = arrowSnapRadius;
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
        this.gridRows = gridRows ?? gridCols; // Assumption: square sprite sheet unless gridRows is specified
        this.frameCount = this.gridCols * this.gridRows;
        this.snapLerpRate = snapLerpRate;

        this.label = label;
        this.labelConfig = labelConfig;
        this.labelActivation = 0;
        this.labelVisible = false;

        // Idle state initialization
        this.idleConfig = idle;
        this.idleActivation = 0;
        this.isWinking = false;
        this.nextWinkTime = 0;
        this.winkStartTime = 0;

        this.spriteImage = spriteImage;

        // Use provided position or default to center
        this.initialX = x;
        this.initialY = y;
        this.center = p.createVector(x ?? p.width / 2, y ?? p.height / 2);

        this.proximity = 0;
        this.activation = 0;
        this.visible = false;
        this._hole = null;
        this._extraRepulsion = null;
        // Cache for label text measurements — invalidated on resize via applyResponsiveConfig.
        this._labelWidth  = null;
        this._labelHeight = null;
    }

    // =========================================================================
    // RESPONSIVE UPDATES
    // =========================================================================

    applyResponsiveConfig(config) {
        Object.assign(this, config);
        if (this.rotationMaxDegrees !== undefined) {
            this.rotationMaxRad = this.p.radians(this.rotationMaxDegrees);
        }
        // Update position from config if provided (responsive recalculation)
        if (config.x !== undefined && config.y !== undefined) {
            this.center.set(config.x, config.y);
        }
        this._hole = null;
        // Font size may have changed — invalidate cached text measurements.
        this._labelWidth  = null;
        this._labelHeight = null;
    }

    updateIdle(time, isIdle) {
        if (!this.idleConfig) return;

        // If not idle or if the flower is being interacted with, reset everything
        if (!isIdle || this.activation > 0.01) {
            this.idleActivation = 0;
            this.isWinking = false;
            this.nextWinkTime = time + this.p.random(this.idleConfig.winkIntervalMin, this.idleConfig.winkIntervalMax);
            return;
        }

        // Check if it's time to start a wink
        if (!this.isWinking && time > this.nextWinkTime) {
            this.isWinking = true;
            this.winkStartTime = time;
        }

        if (this.isWinking) {
            const elapsed = time - this.winkStartTime;
            const duration = this.idleConfig.winkDuration;

            if (elapsed >= duration) {
                // Wink finished
                this.isWinking = false;
                this.idleActivation = 0;
                this.nextWinkTime = time + this.p.random(this.idleConfig.winkIntervalMin, this.idleConfig.winkIntervalMax);
            } else {
                // Calculate wink activation (sine wave)
                const progress = elapsed / duration;
                // Sine wave from 0 to PI (0 -> 1 -> 0)
                const sineValue = Math.sin(progress * Math.PI);
                this.idleActivation = sineValue * this.idleConfig.winkIntensity;
            }
        }
    }

    // =========================================================================
    // LOGIC & CALCULATION
    // =========================================================================

    /**
     * Updates proximity, activation, and visibility based on cursor position.
     * Side-effects:
     *   - this.proximity, this.activation (physics state)
     *   - this.visible (render gate)
     *   - this._hole (consumed by VectorField via getExtraRepulsion pipeline)
     *
     * Note: label state (labelActivation, _extraRepulsion) is updated separately
     * by calling updateLabel(field) from sketch.js before each updateAndDraw call.
     *
     * Returns the hole descriptor, or null if not visible.
     */
    computeHole(mouseVec) {
        const dist = this.p.dist(mouseVec.x, mouseVec.y, this.center.x, this.center.y);
        this.proximity = this.p.constrain(1 - dist / this.revealRadius, 0, 1);

        const normalized = this.p.constrain(
            (this.proximity - this.revealStart) / (1 - this.revealStart),
            0,
            1
        );
        const targetActivation = this._easeOutCubic(normalized);

        const delta = this.p.abs(targetActivation - this.activation);
        const exiting = targetActivation < this.activation;
        const minRate = exiting && this.activationLerpMinRateExit !== undefined
            ? this.activationLerpMinRateExit
            : this.activationLerpMinRate;
        const maxRate = exiting && this.activationLerpMaxRateExit !== undefined
            ? this.activationLerpMaxRateExit
            : this.activationLerpMaxRate;
        const rate = this.p.constrain(
            this.p.map(delta, 0, this.activationLerpDeltaWindow, minRate, maxRate),
            minRate,
            maxRate
        );

        this.activation = this.p.lerp(this.activation, targetActivation, rate);
        if (this.p.abs(this.activation - targetActivation) < 1e-4) {
            this.activation = targetActivation;
        }

        // Snap to full bloom if the cursor is very close.
        // snapLerpRate comes from CONFIG.flower.snapLerpRate (default 0.3).
        if (this.snapRadius && dist < this.snapRadius) {
            this.activation = this.p.lerp(this.activation, 1.0, this.snapLerpRate);
        }

        // Calculate idle hole activation
        const idleHoleActivation = this.idleActivation * (this.idleConfig?.holeIntensity ?? 0.3);

        // Use the stronger of the two activations for physics, but keep track of source
        let effectiveActivation = this.activation;
        let useIdleCenter = false;

        if (idleHoleActivation > this.activation) {
            effectiveActivation = idleHoleActivation;
            useIdleCenter = true;
        }

        const visibilityThreshold = this.activationVisibilityThreshold ?? 1e-4;
        this.visible = effectiveActivation > visibilityThreshold;

        if (!this.visible) {
            this._hole = null;
            // Ensure label is also deactivated immediately
            this.labelActivation = 0;
            this.labelVisible = false;
            this._extraRepulsion = null;
            return null;
        }

        const targetRadius = this.radius + this.holePadding;
        // Use this.initialHoleRadius as the starting point
        const radius = this.p.lerp(this.initialHoleRadius, targetRadius, effectiveActivation);

        // If using idle activation, center the hole on the flower.
        // If using mouse activation, interpolate between mouse and flower center.
        const center = useIdleCenter
            ? this.center.copy()
            : mouseVec.copy().lerp(this.center, effectiveActivation);

        const clearRadius = this.clearRadius * effectiveActivation;
        const clearFeather = this.clearFeather;

        let snapCenter = null;
        if (this.arrowSnapRadius && dist < this.arrowSnapRadius) {
            snapCenter = this.center;
        }

        this._hole = { center, radius, clearRadius, clearFeather, activation: effectiveActivation, snapCenter };
        return this._hole;
    }

    updateLabel(field) {
        if (!this.label || !this.labelConfig) return;

        // Label appears when flower is significantly activated (bloomed) or hovered
        // We use a threshold on the main activation to trigger the label
        const targetLabelActivation = this.activation > 0.8 ? 1 : 0;

        const rate = targetLabelActivation > this.labelActivation
            ? this.labelConfig.activationRate
            : this.labelConfig.deactivationRate;

        this.labelActivation = this.p.lerp(this.labelActivation, targetLabelActivation, rate);

        if (this.p.abs(this.labelActivation - targetLabelActivation) < 1e-3) {
            this.labelActivation = targetLabelActivation;
        }

        this.labelVisible = this.labelActivation > 0.01;
        this._extraRepulsion = null;

        if (this.labelVisible) {
            // Measure text only once — cache is reset by applyResponsiveConfig on resize.
            if (this._labelWidth === null) {
                this.p.push();
                this.p.textSize(this.labelConfig.fontSize);
                this.p.textFont(this.labelConfig.fontFamily);
                this._labelWidth  = this.p.textWidth(this.label);
                this._labelHeight = this.labelConfig.fontSize;
                this.p.pop();
            }
            const w = this._labelWidth;
            const h = this._labelHeight;

            const clearPadding = this.labelConfig.clearPadding * this.labelActivation;
            const featherPadding = this.labelConfig.featherPadding;

            // The label is currently always positioned at the screen center (snapped to grid).
            // This is intentional: the label acts as a global caption for the whole canvas,
            // not as a tooltip near the individual flower.
            const snapped = field.getNearestGridCenter(this.p.width / 2, this.p.height / 2);
            const labelCenter = this.p.createVector(snapped.x, snapped.y);

            // Store for drawing
            this.currentLabelCenter = labelCenter;

            this._extraRepulsion = {
                type: 'rect',
                center: labelCenter,
                width: w,
                height: h,
                clearPadding: clearPadding,
                featherPadding: featherPadding,
                strength: this.labelActivation
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

    // =========================================================================
    // RENDERING
    // =========================================================================

    draw() {
        // this.visible is driven by computeHole() (physics + idle hole activation).
        // isIdleVisible is an additional check for the visual-only wink (no physics hole).
        const isIdleVisible = this.idleActivation > (this.activationVisibilityThreshold ?? 1e-4);
        if ((!this.visible && !isIdleVisible) || !this.spriteImage) {
            return;
        }

        this.p.push();
        this.p.translate(this.center.x, this.center.y);
        const rotation = this.rotationMaxRad
            ? this.rotationMaxRad * (this.p.pow(this.activation, this.rotationExponent) - 1)
            : 0;
        this.p.rotate(rotation);
        this.p.imageMode(this.p.CENTER);

        // Use the maximum of user activation and idle activation for visual effects
        const effectiveActivation = Math.max(this.activation, this.idleActivation);

        const glow = this.glowBase + this.glowGain * effectiveActivation;
        const scale = this.bodyScaleBase + this.bodyScaleGain * effectiveActivation;
        const size = this.radius * 2 * scale;

        const fadeIn = this.p.pow(this.p.constrain(effectiveActivation, 0, 1), this.fadeInExponent);
        const alpha = 255 * glow * fadeIn;

        // Frame calculation logic
        const frameProgress = effectiveActivation <= this.frameHoldActivation
            ? 0
            : this.p.constrain(
                (effectiveActivation - this.frameHoldActivation) / (1 - this.frameHoldActivation),
                0,
                1
            );

        const shapedProgress = this.p.pow(frameProgress, this.frameProgressExponent ?? 1);

        // Map 0-1 to 0-(frameCount-1)
        let frameIndex = Math.floor(shapedProgress * (this.frameCount - 1));
        frameIndex = this.p.constrain(frameIndex, 0, this.frameCount - 1);

        // Calculate source rectangle from sprite sheet
        const frameWidth  = this.spriteImage.width  / this.gridCols;
        const frameHeight = this.spriteImage.height / this.gridRows;

        const col = frameIndex % this.gridCols;
        const row = Math.floor(frameIndex / this.gridCols);

        const sx = col * frameWidth;
        const sy = row * frameHeight;

        this.p.tint(255, alpha);
        // Draw the frame from the sprite sheet
        this.p.image(
            this.spriteImage,
            0, 0,
            size, size,
            sx, sy,
            frameWidth, frameHeight
        );
        this.p.noTint();

        this.p.pop();
    }
    drawLabel() {
        if (!this.labelVisible || !this.label || !this.labelConfig) return;

        this.p.push();
        this.p.textAlign(this.p.CENTER, this.p.CENTER);
        this.p.textSize(this.labelConfig.fontSize);
        this.p.textFont(this.labelConfig.fontFamily);

        // Apply font weight if specified
        if (this.labelConfig.fontWeight) {
            this.p.textStyle(this.p.NORMAL); // Reset style first
            this.p.drawingContext.font = `${this.labelConfig.fontWeight} ${this.labelConfig.fontSize}px "${this.labelConfig.fontFamily}"`;
        }

        // Fade in/out based on activation
        const alpha = 255 * this.labelActivation;
        this.p.fill(this.labelConfig.color, alpha);
        this.p.noStroke();

        // Draw relative to SCREEN center (or snapped center if available)
        const pos = this.currentLabelCenter || this.p.createVector(this.p.width / 2, this.p.height / 2);
        this.p.text(this.label, pos.x, pos.y);
        this.p.pop();
    }
}
