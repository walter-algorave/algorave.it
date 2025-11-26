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
        if (this.gridX0 === undefined || this.gridY0 === undefined) {
            return { x, y };
        }

        // The center of 4 arrows (a cell) is at ((col + 0.5) * spacing, (row + 0.5) * spacing).

        const relativeX = x - this.gridX0;
        const relativeY = y - this.gridY0;

        // A cell i,j has center at (i + 0.5) * spacing, (j + 0.5) * spacing
        const col = Math.round((relativeX / this.spacing) - 0.5);
        const row = Math.round((relativeY / this.spacing) - 0.5);

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
            const data = target.computeHole(m.copy());
            if (data) {
                // Ensure type is set for existing circular holes
                data.type = 'circle';
                activeHoles.push(data);
            }
            // Automatically check for label repulsion
            if (typeof target.getLabelRepulsion === 'function') {
                const labelRepulsor = target.getLabelRepulsion();
                if (labelRepulsor) {
                    activeHoles.push(labelRepulsor);
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
                // falloff not strictly used in hard exclusion but kept for potential soft outer effects
                const falloff = h.falloff || 40;
                return {
                    type: 'rect',
                    center: h.center,
                    halfWidth,
                    halfHeight,
                    falloff,
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
                    // Rectangular Repulsion (Hard Exclusion)
                    // We want to push the arrow OUT of the box defined by (halfWidth + clearPadding)
                    // featherPadding adds a soft transition zone outside that.

                    // Scale the hard exclusion box by strength to allow the hole to close
                    // This ensures that when strength is 0, the hole is 0.
                    const scale = repulsor.strength;
                    const scaledHalfWidth = repulsor.halfWidth * scale;
                    const scaledHalfHeight = repulsor.halfHeight * scale;

                    const clearW = scaledHalfWidth + (repulsor.clearPadding || 0);
                    const clearH = scaledHalfHeight + (repulsor.clearPadding || 0);
                    const feather = repulsor.featherPadding || 0;

                    const dx = Math.abs(this._tmpDiff.x);
                    const dy = Math.abs(this._tmpDiff.y);

                    // Check if inside the total influence zone (clear + feather)
                    if (dx < clearW + feather && dy < clearH + feather) {

                        // Calculate penetration depth into the clear zone
                        // We project the point to the nearest edge of the clear box

                        // Determine which axis is closer to the edge
                        // Distance to vertical edge: clearW - dx
                        // Distance to horizontal edge: clearH - dy

                        const distX = clearW - dx;
                        const distY = clearH - dy;

                        // We only care if we are actually inside the clear box or the feather zone
                        // Logic:
                        // 1. If inside clear box (dx < clearW && dy < clearH):
                        //    Push out to the nearest edge.
                        // 2. If in feather zone (one or both coords outside clear but inside feather):
                        //    Apply soft push.

                        if (dx < clearW && dy < clearH) {
                            // INSIDE CLEAR ZONE: HARD PUSH
                            // Find nearest edge
                            if (distX < distY) {
                                // Closer to vertical edge
                                const signX = Math.sign(this._tmpDiff.x) || 1;
                                // Move target x to the edge
                                this._tmpTarget.x = repulsor.center.x + (signX * clearW);
                                // Add a bit of feather push if needed, but hard snap is usually enough
                                if (feather > 0) {
                                    this._tmpTarget.x += signX * feather * 0.25;
                                }
                            } else {
                                // Closer to horizontal edge
                                const signY = Math.sign(this._tmpDiff.y) || 1;
                                // Move target y to the edge
                                this._tmpTarget.y = repulsor.center.y + (signY * clearH);
                                if (feather > 0) {
                                    this._tmpTarget.y += signY * feather * 0.25;
                                }
                            }
                        } else {
                            // IN FEATHER ZONE
                            // We are outside the clear box but inside the feather box.
                            // Calculate distance to the clear box boundary.
                            // SDF to the clear box:
                            const dOuterX = Math.max(dx - clearW, 0);
                            const dOuterY = Math.max(dy - clearH, 0);
                            const distToClear = Math.hypot(dOuterX, dOuterY);

                            if (distToClear < feather) {
                                // Linear falloff or eased push
                                const t = 1 - (distToClear / feather);
                                const eased = t * t;
                                const push = feather * eased * 0.25 * repulsor.strength;

                                // Direction away from the box
                                // If we are in the corner, push diagonally.
                                // If we are on the side, push axially.
                                let pushDirX = 0;
                                let pushDirY = 0;

                                if (distToClear > 1e-4) {
                                    pushDirX = dOuterX * Math.sign(this._tmpDiff.x);
                                    pushDirY = dOuterY * Math.sign(this._tmpDiff.y);
                                    // Normalize
                                    const len = Math.hypot(pushDirX, pushDirY);
                                    pushDirX /= len;
                                    pushDirY /= len;
                                } else {
                                    // Should be covered by inside check, but just in case
                                    pushDirX = Math.sign(this._tmpDiff.x) || 1;
                                    pushDirY = 0;
                                }

                                this._tmpTarget.x += pushDirX * push;
                                this._tmpTarget.y += pushDirY * push;
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
