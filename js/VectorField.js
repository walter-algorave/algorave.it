export class VectorField {
    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================
    constructor(p, {
        spacing = 50,
        arrowLen = 16,
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

    updateAndDraw(mx, my, revealTargets = [], extraRepulsors = []) {
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
        const targets = Array.isArray(revealTargets) ? revealTargets : (revealTargets ? [revealTargets] : []);

        const activeHoles = [];
        for (const target of targets) {
            const data = target.computeHole(m.copy(), this);
            if (data) {
                data.type = 'circle';
                activeHoles.push(data);
            }
            if (typeof target.getExtraRepulsion === 'function') {
                const extraRepulsor = target.getExtraRepulsion();
                if (extraRepulsor) {
                    activeHoles.push(extraRepulsor);
                }
            }
        }

        // Add extra repulsors (like labels passed manually, though we prefer automatic now)
        for (const repulsor of extraRepulsors) {
            if (repulsor) {
                activeHoles.push(repulsor);
            }
        }

        // Pre-calculate properties
        const repulsors = activeHoles.map(h => {
            if (h.type === 'rect') {
                // Rectangular repulsion setup
                const halfWidth = h.width / 2;
                const halfHeight = h.height / 2;
                return {
                    type: 'rect',
                    center: h.center,
                    halfWidth,
                    halfHeight,
                    clearPadding: h.clearPadding,
                    featherPadding: h.featherPadding,
                    strength: h.strength || 1
                };
            } else {
                // Circular repulsion setup (existing logic)
                const holeCenter = h.center;
                const baseHoleRadius = h.radius;
                const holeRadius = baseHoleRadius * pointerPresence;
                const falloffRange = holeRadius * this.falloffMultiplier;
                const outerRadius = holeRadius + falloffRange;
                const boundaryPush = falloffRange * this.outerStrength;

                const holeClearRadius = h.clearRadius;
                const holeClearFeather = h.clearFeather;

                return {
                    type: 'circle',
                    center: holeCenter,
                    holeRadius,
                    falloffRange,
                    outerRadius,
                    boundaryPush,
                    holeClearRadius,
                    holeClearFeather,
                    activation: h.activation
                };
            }
        });

        // Calculate the maximum activation to blend cursor repulsion (only for flowers)
        let maxActivation = 0;
        for (const h of activeHoles) {
            if (h.type === 'circle' && h.activation > maxActivation) {
                maxActivation = h.activation;
            }
        }

        const blendingFactor = 1 - maxActivation;
        const cursorClearRadius = this.cursorClearRadius * pointerPresence * blendingFactor;
        const cursorClearFeather = this.cursorClearFeather * pointerPresence * blendingFactor;

        for (let i = 0; i < this.base.length; i++) {
            const base = this.base[i];
            const pos = this.pos[i];
            const vel = this.vel[i];

            this._tmpTarget.set(base);

            // Accumulate forces from all repulsors
            for (const repulsor of repulsors) {
                this._tmpDiff.set(base);
                this._tmpDiff.sub(repulsor.center);

                if (repulsor.type === 'rect') {
                    // RECTANGULAR -> ELLIPTICAL REPULSION
                    // transform the rectangular bounding box into a circumscribed ellipse.

                    const scale = repulsor.strength;
                    if (scale < 1e-4) continue;

                    // Calculate base dimensions including padding
                    const boxW = repulsor.halfWidth + (repulsor.clearPadding || 0);
                    const boxH = repulsor.halfHeight + (repulsor.clearPadding || 0);

                    // Apply strength scaling for animation
                    const Rx = boxW * Math.SQRT2 * scale;
                    const Ry = boxH * Math.SQRT2 * scale;

                    const feather = repulsor.featherPadding || 0;

                    // Calculate normalized distance to ellipse center
                    const dx = Math.abs(this._tmpDiff.x);
                    const dy = Math.abs(this._tmpDiff.y);

                    // Avoid division by zero
                    if (Rx < 1e-4 || Ry < 1e-4) continue;

                    const nx = dx / Rx;
                    const ny = dy / Ry;
                    const distSq = nx * nx + ny * ny;
                    const dist = Math.sqrt(distSq);

                    if (dist < 1) {
                        // INSIDE HARD EXCLUSION ZONE
                        if (dist > 1e-4) {
                            this._tmpTarget.x = repulsor.center.x + this._tmpDiff.x / dist;
                            this._tmpTarget.y = repulsor.center.y + this._tmpDiff.y / dist;

                            // Add the constant feather push
                            if (feather > 0) {
                                const extraPush = feather * 0.25 * scale;
                                const len = Math.hypot(this._tmpDiff.x, this._tmpDiff.y);
                                if (len > 1e-4) {
                                    this._tmpTarget.x += (this._tmpDiff.x / len) * extraPush;
                                    this._tmpTarget.y += (this._tmpDiff.y / len) * extraPush;
                                }
                            }
                        } else {
                            const extraPush = feather > 0 ? feather * 0.25 * scale : 0;
                            this._tmpTarget.x = repulsor.center.x + Rx + extraPush;
                            this._tmpTarget.y = repulsor.center.y;
                        }

                    } else {
                        // OUTSIDE HARD ZONE - CHECK FEATHER
                        if (feather > 0) {
                            const RxOuter = Rx + feather;
                            const RyOuter = Ry + feather;

                            const nxOuter = dx / RxOuter;
                            const nyOuter = dy / RyOuter;
                            const distSqOuter = nxOuter * nxOuter + nyOuter * nyOuter;

                            if (distSqOuter < 1) {
                                // INSIDE FEATHER ZONE

                                const u_in = 1 / dist;
                                const u_out = 1 / Math.sqrt(distSqOuter);

                                const denom = u_out - u_in;
                                if (denom > 1e-6) {
                                    const t = (1 - u_in) / denom;

                                    const pushFactor = (1 - t) * (1 - t);
                                    const push = feather * pushFactor * 0.25 * scale;

                                    const len = Math.hypot(this._tmpDiff.x, this._tmpDiff.y) || 1;
                                    const dirX = this._tmpDiff.x / len;
                                    const dirY = this._tmpDiff.y / len;

                                    this._tmpTarget.x += dirX * push;
                                    this._tmpTarget.y += dirY * push;
                                }
                            }
                        }
                    }
                } else {
                    // Circular Repulsion
                    const d = this._tmpDiff.mag();

                    if (d < repulsor.outerRadius) {
                        if (d > this.directionEpsilon) {
                            this._tmpDir.set(this._tmpDiff);
                            this._tmpDir.mult(1 / d);
                        } else {
                            this._tmpDir.set(1, 0);
                        }

                        if (d < repulsor.holeRadius) {
                            const insideNorm = this.p.constrain((repulsor.holeRadius - d) / repulsor.holeRadius, 0, 1);
                            const eased = 1 - Math.exp(-this.innerEase * insideNorm);
                            const push = repulsor.boundaryPush + repulsor.falloffRange * this.innerExtraStrength * eased;

                            this._tmpDir.mult(push);
                            this._tmpTarget.add(this._tmpDir);
                        } else {
                            const falloffNorm = this.p.constrain((repulsor.outerRadius - d) / repulsor.falloffRange, 0, 1);
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

            if (cursorClearRadius > 0) {
                this._tmpDiff.set(base);
                this._tmpDiff.sub(m);
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

            for (const repulsor of repulsors) {
                if (repulsor.type === 'circle' && repulsor.holeClearRadius > 0) {
                    this._tmpDiff.set(base);
                    this._tmpDiff.sub(repulsor.center);
                    const d = this._tmpDiff.mag();

                    if (d < repulsor.holeClearRadius + repulsor.holeClearFeather) {
                        if (d > this.directionEpsilon) {
                            this._tmpDir.set(this._tmpDiff);
                            this._tmpDir.mult(1 / d);
                        } else {
                            this._tmpDir.set(1, 0);
                        }

                        let exclusionPush = 0;
                        if (d < repulsor.holeClearRadius) {
                            exclusionPush = (repulsor.holeClearRadius - d) + (repulsor.holeClearFeather * 0.25);
                        } else if (repulsor.holeClearFeather > 0) {
                            const t = 1 - (d - repulsor.holeClearRadius) / repulsor.holeClearFeather;
                            const eased = t * t;
                            exclusionPush = repulsor.holeClearFeather * eased * 0.25;
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
