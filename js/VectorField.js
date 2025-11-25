export class VectorField {
    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================
    constructor(p, {
        spacing = 50,
        arrowLen = 16,
        // repelRadius = 110, // REMOVED: No longer used globally
        cursorClearRadius = 0,
        cursorClearFeather = 0,
        stiffness = 0.08,
        damping = 0.88,
        maxSpeed = 12,
        mouseLerp = 0.25,
        falloffMultiplier = 1.85,
        outerStrength = 0.15,
        innerExtraStrength = 0.08,
        innerEase = 2.8,
        outerFalloffExponent = 1.35,
        directionEpsilon = 1e-4,
        pushEpsilon = 1e-3,
        angleEpsilon = 1e-6,
        arrowShape = {},
        pointerPresence = {}
    } = {}) {
        this.p = p;
        this.spacing = spacing;
        this.arrowLen = arrowLen;
        // this.repelRadius = repelRadius; // REMOVED
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

        const {
            shaftRatio = 0.4,
            tipLengthRatio = 0.55,
            tipWidthRatio = 0.35
        } = arrowShape;
        this.arrowShape = { shaftRatio, tipLengthRatio, tipWidthRatio };

        const {
            enterRate = 0.35,
            exitRate = 0.08
        } = pointerPresence;
        this.pointerPresenceConfig = {
            enterRate: p.constrain(enterRate, 0, 1),
            exitRate: p.constrain(exitRate, 0, 1)
        };
        this.pointerPresenceValue = 0;
        this.pointerInCanvas = false;

        this.smoothedMouse = p.createVector(0, 0);
        this._mouseInit = false;

        // Reusable temporary vectors
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

    // =========================================================================
    // GRID GENERATION
    // =========================================================================

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

    applyResponsiveConfig(config) {
        this.spacing = config.spacing;
        this.arrowLen = config.arrowLen;
        // this.repelRadius = config.repelRadius; // REMOVED
        this.cursorClearRadius = config.cursorClearRadius ?? this.cursorClearRadius;
        this.cursorClearFeather = config.cursorClearFeather ?? this.cursorClearFeather;
        this.falloffMultiplier = config.falloffMultiplier;
        if (config.pointerPresence) {
            this.pointerPresenceConfig = {
                ...this.pointerPresenceConfig,
                ...config.pointerPresence
            };
            this.pointerPresenceConfig.enterRate = this.p.constrain(this.pointerPresenceConfig.enterRate, 0, 1);
            this.pointerPresenceConfig.exitRate = this.p.constrain(this.pointerPresenceConfig.exitRate, 0, 1);
        }
        this.rebuild();
    }

    // =========================================================================
    // PHYSICS & UPDATE
    // =========================================================================

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

        // 1. Compute hole data for all targets
        // We handle single target or array for backward compatibility, though we expect array now.
        const targets = Array.isArray(revealTargets) ? revealTargets : (revealTargets ? [revealTargets] : []);

        const activeHoles = [];
        for (const target of targets) {
            const data = target.computeHole(m.copy()); // Removed this.repelRadius
            if (data) {
                activeHoles.push(data);
            }
        }

        // Pre-calculate hole properties to avoid re-calc in loop
        const holes = activeHoles.map(h => {
            const holeCenter = h.center;
            const baseHoleRadius = h.radius;
            const holeRadius = baseHoleRadius * pointerPresence;
            const falloffRange = holeRadius * this.falloffMultiplier;
            const outerRadius = holeRadius + falloffRange;
            const boundaryPush = falloffRange * this.outerStrength;

            const holeClearRadius = h.clearRadius;
            const holeClearFeather = h.clearFeather;

            return {
                center: holeCenter,
                holeRadius,
                falloffRange,
                outerRadius,
                boundaryPush,
                holeClearRadius,
                holeClearFeather
            };
        });

        // Calculate the maximum activation to blend cursor repulsion
        let maxActivation = 0;
        for (const hole of activeHoles) {
            if (hole.activation > maxActivation) {
                maxActivation = hole.activation;
            }
        }

        // As maxActivation approaches 1 (fully bloomed/close), blendingFactor approaches 0 (no cursor repulsion)
        const blendingFactor = 1 - maxActivation;

        const cursorClearRadius = this.cursorClearRadius * pointerPresence * blendingFactor;
        const cursorClearFeather = this.cursorClearFeather * pointerPresence * blendingFactor;

        for (let i = 0; i < this.base.length; i++) {
            const base = this.base[i];
            const pos = this.pos[i];
            const vel = this.vel[i];

            this._tmpTarget.set(base);

            // Accumulate forces from all holes
            for (const hole of holes) {
                this._tmpDiff.set(base);
                this._tmpDiff.sub(hole.center);
                const d = this._tmpDiff.mag();

                if (d < hole.outerRadius) {
                    if (d > this.directionEpsilon) {
                        this._tmpDir.set(this._tmpDiff);
                        this._tmpDir.mult(1 / d);
                    } else {
                        this._tmpDir.set(1, 0);
                    }

                    if (d < hole.holeRadius) {
                        const insideNorm = this.p.constrain((hole.holeRadius - d) / hole.holeRadius, 0, 1);
                        const eased = 1 - Math.exp(-this.innerEase * insideNorm);
                        const push = hole.boundaryPush + hole.falloffRange * this.innerExtraStrength * eased;

                        this._tmpDir.mult(push);
                        this._tmpTarget.add(this._tmpDir);
                    } else {
                        const falloffNorm = this.p.constrain((hole.outerRadius - d) / hole.falloffRange, 0, 1);
                        const eased = this.p.pow(falloffNorm, this.outerFalloffExponent);
                        const push = hole.falloffRange * this.outerStrength * eased;

                        if (push > this.pushEpsilon) {
                            this._tmpDir.mult(push);
                            this._tmpTarget.add(this._tmpDir);
                        }
                    }
                }
            }

            // Apply clearing (max effect from any source)
            // We check against cursor clear and all hole clears
            // For simplicity and performance, we can just check if we are inside any clear zone
            // But we need to calculate the push.
            // Let's handle cursor clear first
            // 1. Cursor Clear
            if (cursorClearRadius > 0) {
                this._tmpDiff.set(base);
                this._tmpDiff.sub(m); // m is smoothedMouse
                const d = this._tmpDiff.mag();
                if (d < cursorClearRadius + cursorClearFeather) {
                    if (d > this.directionEpsilon) {
                        this._tmpDir.set(this._tmpDiff);
                        this._tmpDir.mult(1 / d);
                    } else {
                        this._tmpDir.set(1, 0);
                    }

                    let exclusionPush = 0;
                    if (d < cursorClearRadius) {
                        exclusionPush = (cursorClearRadius - d) + (cursorClearFeather * 0.25);
                    } else if (cursorClearFeather > 0) {
                        const t = 1 - (d - cursorClearRadius) / cursorClearFeather;
                        const eased = t * t;
                        exclusionPush = cursorClearFeather * eased * 0.25;
                    }

                    if (exclusionPush > 0) {
                        this._tmpDir.mult(exclusionPush);
                        this._tmpTarget.add(this._tmpDir);
                    }
                }
            }

            // 2. Hole Clears
            for (const hole of holes) {
                if (hole.holeClearRadius > 0) {
                    this._tmpDiff.set(base);
                    this._tmpDiff.sub(hole.center);
                    const d = this._tmpDiff.mag();

                    if (d < hole.holeClearRadius + hole.holeClearFeather) {
                        if (d > this.directionEpsilon) {
                            this._tmpDir.set(this._tmpDiff);
                            this._tmpDir.mult(1 / d);
                        } else {
                            this._tmpDir.set(1, 0);
                        }

                        let exclusionPush = 0;
                        if (d < hole.holeClearRadius) {
                            exclusionPush = (hole.holeClearRadius - d) + (hole.holeClearFeather * 0.25);
                        } else if (hole.holeClearFeather > 0) {
                            const t = 1 - (d - hole.holeClearRadius) / hole.holeClearFeather;
                            const eased = t * t;
                            exclusionPush = hole.holeClearFeather * eased * 0.25;
                        }

                        if (exclusionPush > 0) {
                            this._tmpDir.mult(exclusionPush);
                            this._tmpTarget.add(this._tmpDir);
                        }
                    }
                }
            }

            // Physics Integration
            this._tmpToTarget.set(this._tmpTarget);
            this._tmpToTarget.sub(pos);
            this._tmpToTarget.mult(this.stiffness);

            vel.mult(this.damping);
            vel.add(this._tmpToTarget);

            if (vel.magSq() > this.maxSpeed * this.maxSpeed) {
                vel.setMag(this.maxSpeed);
            }

            pos.add(vel);

            // Rotation Calculation
            this._tmpDirToMouse.set(m);
            this._tmpDirToMouse.sub(pos);

            const angle = this._tmpDirToMouse.magSq() > this.angleEpsilon
                ? this._tmpDirToMouse.heading()
                : 0;

            this.p.push();
            this.p.translate(pos.x, pos.y);
            this.p.rotate(angle);
            this._arrow(this.arrowLen);
            this.p.pop();
        }
    }

    // =========================================================================
    // RENDERING HELPERS
    // =========================================================================

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

    _updatePointerPresence() {
        const hasPointer = this._hasActivePointer();
        const target = hasPointer ? 1 : 0;
        const rate = hasPointer
            ? this.pointerPresenceConfig.enterRate
            : this.pointerPresenceConfig.exitRate;
        const clampedRate = this.p.constrain(rate, 0, 1);
        this.pointerPresenceValue = this.p.lerp(this.pointerPresenceValue, target, clampedRate);
        if (this.p.abs(this.pointerPresenceValue - target) < 1e-3) {
            this.pointerPresenceValue = target;
        }
        return this.pointerPresenceValue;
    }

    _hasActivePointer() {
        const hasTouch = typeof this.p.touches !== "undefined" && this.p.touches.length > 0;
        return hasTouch || this.pointerInCanvas;
    }

    setPointerInCanvas(state) {
        this.pointerInCanvas = !!state;
    }

    resetPointerState() {
        this.pointerInCanvas = false;
        this.pointerPresenceValue = 0;
        this._mouseInit = false;
    }
}
