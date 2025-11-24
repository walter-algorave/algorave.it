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
            chromakeyColor = [2 / 255, 0.0, 1.0],
            chromakeyThreshold = 0.80,
            chromakeySmoothness = 0.1,
            offscreenBufferSize = 1024
        } = {},
        video,
        shader
    ) {
        this.p = p;
        this.radius = radius;
        this.revealRadius = revealRadius;
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
        this.chromakeyColor = chromakeyColor;
        this.chromakeyThreshold = chromakeyThreshold;
        this.chromakeySmoothness = chromakeySmoothness;
        this.offscreenBufferSize = offscreenBufferSize;

        this.video = video;
        this.shader = shader;
        this.isVideoReady = false;
        this.pg = null;

        // Check if video metadata is already loaded
        if (this.video.elt.readyState >= 2) {
            this.isVideoReady = true;
        } else {
            this.video.elt.onloadedmetadata = () => {
                this.isVideoReady = true;
            };
        }

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
        if (!this.visible || !this.video || !this.isVideoReady) {
            return;
        }

        // Initialize offscreen buffer if needed
        if (!this.pg && this.video.width > 0) {
            const s = Math.max(this.video.width, this.video.height) || this.offscreenBufferSize;
            this.pg = this.p.createGraphics(s, s, this.p.WEBGL);
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
        const alpha = 255 * glow * fadeIn;

        // Video scrubbing logic
        const duration = this.video.duration();

        // Calculate target time based on activation
        const videoProgress = this.activation <= this.frameHoldActivation
            ? 0
            : this.p.constrain(
                (this.activation - this.frameHoldActivation) / (1 - this.frameHoldActivation),
                0,
                1
            );

        const shapedProgress = this.p.pow(videoProgress, this.frameProgressExponent ?? 1);
        const targetTime = shapedProgress * duration;

        try {
            const safeTime = this.p.constrain(targetTime, 0, duration - 0.01);
            this.video.time(safeTime);
        } catch (e) {
            console.warn("Video seek failed", e);
        }

        // Apply shader
        if (this.pg && this.shader) {
            this.pg.clear();
            this.pg.shader(this.shader);

            this.shader.setUniform('tex0', this.video);
            this.shader.setUniform('keyColor', this.chromakeyColor);
            this.shader.setUniform('threshold', this.chromakeyThreshold);
            this.shader.setUniform('smoothness', this.chromakeySmoothness);

            this.pg.rect(-this.pg.width / 2, -this.pg.height / 2, this.pg.width, this.pg.height);

            this.p.tint(255, alpha);
            this.p.image(this.pg, 0, 0, size, size);
            this.p.noTint();
        } else {
            // Fallback if shader/pg not ready
            this.p.tint(255, alpha);
            this.p.image(this.video, 0, 0, size, size);
            this.p.noTint();
        }

        this.p.pop();
    }
}
