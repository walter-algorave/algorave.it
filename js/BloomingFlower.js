export class BloomingFlower {
    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================
    constructor(p,
        {
            radius = 50,
            revealRadius = 220,
            holePadding = 30,
            clearRadius = 0,
            clearFeather = 0,
            revealStart = 0.25,
            revealVisibleOffset = 0.05,
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
            bodyScaleGain = 0.35
        } = {},
        spriteSheet,
        frameCount = 6
    ) {
        this.p = p;
        this.radius = radius;
        this.revealRadius = revealRadius;
        this.holePadding = holePadding;
        this.clearRadius = clearRadius;
        this.clearFeather = clearFeather;
        this.revealStart = revealStart;
        this.revealVisibleOffset = revealVisibleOffset;
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

        this.spriteSheet = spriteSheet;
        this.frameCount = frameCount;

        this.center = p.createVector(p.width / 2, p.height / 2);
        this.proximity = 0;
        this.activation = 0;
        this.visible = false;
        this._hole = null;
    }

    // =========================================================================
    // RESPONSIVE UPDATES
    // =========================================================================

    applyResponsiveConfig(config) {
        Object.assign(this, config);
        if (this.rotationMaxDegrees !== undefined) {
            this.rotationMaxRad = this.p.radians(this.rotationMaxDegrees);
        }
        this.handleResize();
        this._hole = null;
    }

    handleResize() {
        this.center.set(this.p.width / 2, this.p.height / 2);
    }

    // =========================================================================
    // LOGIC & CALCULATION
    // =========================================================================

    computeHole(mouseVec, baseRepel) {
        this.center.set(this.p.width / 2, this.p.height / 2);

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
        const radius = this.p.lerp(baseRepel, targetRadius, this.activation);
        const center = mouseVec.copy().lerp(this.center, this.activation);

        const clearRadius = this.clearRadius * this.activation;
        const clearFeather = this.clearFeather;

        this._hole = { center, radius, clearRadius, clearFeather };
        return this._hole;
    }

    _easeOutCubic(t) {
        const clamped = this.p.constrain(t, 0, 1);
        return 1 - this.p.pow(1 - clamped, 3);
    }

    // =========================================================================
    // RENDERING
    // =========================================================================

    draw() {
        if (!this.visible || !this.spriteSheet) {
            return;
        }

        this.p.push();
        this.p.translate(this.center.x, this.center.y);
        const rotation = this.rotationMaxRad
            ? this.rotationMaxRad * this.p.pow(this.activation, this.rotationExponent)
            : 0;
        this.p.rotate(rotation);
        this.p.imageMode(this.p.CENTER);

        const glow = this.glowBase + this.glowGain * this.activation;
        const scale = this.bodyScaleBase + this.bodyScaleGain * this.activation;
        const size = this.radius * 2 * scale;

        const fadeIn = this.p.pow(this.p.constrain(this.activation, 0, 1), this.fadeInExponent);

        const lastIndex = this.frameCount - 1;
        const frameT = this.activation <= this.frameHoldActivation
            ? 0
            : this.p.constrain(
                (this.activation - this.frameHoldActivation) / (1 - this.frameHoldActivation),
                0,
                1
            );
        const shapedFrameT = this.p.pow(frameT, this.frameProgressExponent ?? 1);
        const progress = shapedFrameT * lastIndex;
        const idx0 = this.p.floor(progress);
        const idx1 = this.p.min(idx0 + 1, lastIndex);
        const blend = progress - idx0;
        const alpha = 255 * glow * fadeIn;

        // Sprite sheet logic
        const frameWidth = this.spriteSheet.width / this.frameCount;
        const frameHeight = this.spriteSheet.height;

        // Draw frame 0
        this.p.tint(255, alpha * (1 - blend));
        this.p.image(
            this.spriteSheet,
            0, 0, size, size,
            idx0 * frameWidth, 0, frameWidth, frameHeight
        );

        if (idx1 !== idx0) {
            this.p.tint(255, alpha * blend);
            this.p.image(
                this.spriteSheet,
                0, 0, size, size,
                idx1 * frameWidth, 0, frameWidth, frameHeight
            );
        }

        this.p.noTint();
        this.p.pop();
    }
}
