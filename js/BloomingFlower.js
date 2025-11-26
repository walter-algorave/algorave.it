export class BloomingFlower {
    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================
    constructor(p,
        {
            radius = 50,
            revealRadius = 220,
            initialHoleRadius = 0,
            tapLockRadius = 0,
            holePadding = 30,
            clearRadius = 0,
            clearFeather = 0,
            revealStart = 0.25,
            activationLerpMinRate = 0.025,
            activationLerpMaxRate = 0.1,
            activationLerpDeltaWindow = 0.3,
            activationLerpMinRateExit = 0.06,
            activationLerpMaxRateExit = 0.18,
            fadeInExponent = 1.35,
            frameHoldActivation = 0.14,
            activationVisibilityThreshold = 0.02,
            rotationMaxDegrees = 10,
            rotationExponent = 1.2,
            frameProgressExponent = 1.0,
            glowBase = 0.35,
            glowGain = 0.65,
            bodyScaleBase = 0.55,
            bodyScaleGain = 0.35,
            gridCols = 5,
            x, // Absolute x position
            y,  // Absolute y position
            label,
            labelConfig
        } = {},
        spriteImage
    ) {
        this.p = p;
        this.radius = radius;
        this.revealRadius = revealRadius;
        this.initialHoleRadius = initialHoleRadius;
        this.tapLockRadius = tapLockRadius;
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
        this.frameCount = gridCols * gridCols;

        this.label = label;
        this.labelConfig = labelConfig;
        this.labelActivation = 0;
        this.labelVisible = false;

        this.spriteImage = spriteImage;

        // Use provided position or default to center
        this.initialX = x;
        this.initialY = y;
        this.center = p.createVector(x ?? p.width / 2, y ?? p.height / 2);

        this.proximity = 0;
        this.activation = 0;
        this.visible = false;
        this._hole = null;
        this._labelRepulsion = null;
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
        } else {
            this.handleResize();
        }
        this._hole = null;
    }

    handleResize() {
        // If no specific position is set, center it. 
        // But usually applyResponsiveConfig will handle this.
        if (this.initialX === undefined) {
            this.center.set(this.p.width / 2, this.p.height / 2);
        }
    }

    // =========================================================================
    // LOGIC & CALCULATION
    // =========================================================================

    computeHole(mouseVec) { // Removed baseRepel arg
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

        const visibilityThreshold = this.activationVisibilityThreshold ?? 1e-4;
        this.visible = this.activation > visibilityThreshold;

        if (!this.visible) {
            this._hole = null;
            return null;
        }

        const targetRadius = this.radius + this.holePadding;
        // Use this.initialHoleRadius as the starting point
        const radius = this.p.lerp(this.initialHoleRadius, targetRadius, this.activation);
        const center = mouseVec.copy().lerp(this.center, this.activation);

        const clearRadius = this.clearRadius * this.activation;
        const clearFeather = this.clearFeather;

        this._hole = { center, radius, clearRadius, clearFeather, activation: this.activation };

        // Update label state as part of the compute cycle
        if (this.label) {
            this.updateLabel();
        }

        return this._hole;
    }

    updateLabel() {
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
        this._labelRepulsion = null;

        if (this.labelVisible) {
            this.p.push();
            this.p.textSize(this.labelConfig.fontSize);
            this.p.textFont(this.labelConfig.fontFamily);
            const w = this.p.textWidth(this.label);
            const h = this.labelConfig.fontSize;
            this.p.pop();

            // Apply activation to the padding effects
            const clearPadding = this.labelConfig.clearPadding * this.labelActivation;
            const featherPadding = this.labelConfig.featherPadding;

            // Calculate label center position
            const labelY = this.center.y + this.labelConfig.offsetY;
            const labelCenter = this.p.createVector(this.center.x, labelY);

            this._labelRepulsion = {
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

    getLabelRepulsion() {
        return this._labelRepulsion;
    }

    _easeOutCubic(t) {
        const clamped = this.p.constrain(t, 0, 1);
        return 1 - this.p.pow(1 - clamped, 3);
    }

    // =========================================================================
    // RENDERING
    // =========================================================================

    draw() {
        if (!this.visible || !this.spriteImage) {
            return;
        }

        this.p.push();
        this.p.translate(this.center.x, this.center.y);
        const rotation = this.rotationMaxRad
            ? this.rotationMaxRad * (this.p.pow(this.activation, this.rotationExponent) - 1)
            : 0;
        this.p.rotate(rotation);
        this.p.imageMode(this.p.CENTER);

        const glow = this.glowBase + this.glowGain * this.activation;
        const scale = this.bodyScaleBase + this.bodyScaleGain * this.activation;
        const size = this.radius * 2 * scale;

        const fadeIn = this.p.pow(this.p.constrain(this.activation, 0, 1), this.fadeInExponent);
        const alpha = 255 * glow * fadeIn;

        // Frame calculation logic
        // Calculate target frame based on activation
        const frameProgress = this.activation <= this.frameHoldActivation
            ? 0
            : this.p.constrain(
                (this.activation - this.frameHoldActivation) / (1 - this.frameHoldActivation),
                0,
                1
            );

        const shapedProgress = this.p.pow(frameProgress, this.frameProgressExponent ?? 1);

        // Map 0-1 to 0-(frameCount-1)
        // Use floor to get integer index
        let frameIndex = Math.floor(shapedProgress * (this.frameCount - 1));
        frameIndex = this.p.constrain(frameIndex, 0, this.frameCount - 1);

        // Calculate source rectangle from sprite sheet
        const frameWidth = this.spriteImage.width / this.gridCols;
        const frameHeight = frameWidth; // Square frames

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

        // Fade in/out based on activation
        const alpha = 255 * this.labelActivation;
        this.p.fill(this.labelConfig.color, alpha);
        this.p.noStroke();

        const labelY = this.center.y + this.labelConfig.offsetY;
        this.p.text(this.label, this.center.x, labelY);
        this.p.pop();
    }
}
