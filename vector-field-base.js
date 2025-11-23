/* 

FONT DA USARE: "SF PRO DISPLAY MEDIUM"

CONFIGURAZIONE
   CANVAS (CONFIG.canvas)
     - pixelDensity: risoluzione di rendering (1 = default retina off).
     - strokeColor: colore del contorno delle frecce.
     - strokeWeight: spessore delle frecce.
     - background: colore di sfondo.

   CAMPO (CONFIG.field)
     - spacingRatio: frazione della larghezza di riferimento usata per la griglia.
     - arrowLenSpacingRatio: lunghezza della freccia rispetto allo spacing.
     - repelRadiusSpacingRatio: raggio del "buco" rispetto allo spacing (fallback generico).
     - cursorRepelRadiusSpacingRatio: raggio del buco generato dal puntatore, separato dal fiore.
     - cursorClearSpacingRatio: raggio del disco di esclusione totale per il puntatore (0 = disattivo).
     - cursorClearFeatherSpacingRatio: fascia di sfumatura in cui le frecce riappaiono gradualmente.
     - stiffness: elasticita del ritorno verso la posizione target.
     - damping: smorzamento della velocita accumulata.
     - maxSpeed: limite alla velocita del movimento.
     - mouseLerp: smoothing del tracciamento del mouse (0-1).
     - falloffMultiplier: fattore che estende il gradiente oltre il buco.
     - outerStrength: forza di repulsione fuori dal raggio principale.
     - innerExtraStrength: spinta aggiuntiva quando il cursore e sopra.
     - innerEase: curva di easing per la spinta interna.
     - outerFalloffExponent: esponente del decadimento esterno.
     - directionEpsilon: soglia per calcolare direzioni stabili.
     - pushEpsilon: spinta minima da applicare.
     - angleEpsilon: soglia per evitare divisioni per zero sull'angolo.
     - arrowShape.*: proporzioni della freccia.
     - densityCompensation: controlla come la densita del pattern si alleggerisce su viewport piccole.
     - pointerPresence.enterRate/exitRate: velocita con cui il buco del cursore appare/scompare.

   FIORE (CONFIG.flower)
     - radiusRatio: percentuale del lato corto per il raggio base dello sprite del fiore.
     - revealRadiusDiagonalRatio: raggio (in frazione della diagonale) entro cui inizia a crescere l'attivazione.
     - holePaddingRatio: padding aggiuntivo del buco quando il fiore e pienamente attivo.
     - clearRadiusRatio: raggio del disco di esclusione totale attorno al fiore (0 = disattivo, scala col bloom).
     - clearFeatherRatio: fascia di sfumatura per reintrodurre gradualmente le frecce oltre il disco di esclusione.
     - revealStart: soglia di prossimita (0-1) a cui parte l'animazione/bloom.
     - revealVisibleOffset: offset extra per rendere il fiore visibile dopo l'inizio del bloom.
     - activationLerpMinRate/activationLerpMaxRate: limiti del lerp sull'attivazione per ingressi lenti/rapidi.
     - activationLerpDeltaWindow: delta di attivazione entro cui il lerp scala da min a max (smorza scatti).
     - activationLerpMinRateExit/activationLerpMaxRateExit: velocita di uscita (rilascio) verso 0.
     - fadeInExponent: curva dell'alpha rispetto all'attivazione (1 = lineare, >1 parte piu lenta).
     - frameHoldActivation: soglia di attivazione fino a cui viene mantenuto il frame 0 (bocciolo).
     - activationVisibilityThreshold: sotto questa attivazione il fiore smette di disegnarsi (coda piu corta).
     - rotationMaxDegrees/rotationExponent: ampiezza massima e curva di crescita della rotazione durante il bloom.
     - frameProgressExponent: curva con cui si avanza tra i frame dello sprite (1 = lineare, >1 accelera verso la fine).
      - glowBase/glowGain: intensita di tint/alpha applicata ai frame in funzione dell'attivazione.
      - bodyScaleBase/bodyScaleGain: scala dello sprite rispetto al raggio base lungo la curva di attivazione.
      - frames: sequenza definita in FLOWER_FRAME_FILES, blendata in base all'attivazione (lerp tra frame adiacenti).
 */

const BASE_VIEWPORT = { width: 2560, height: 1440 };
const BASE_DIAGONAL = Math.hypot(BASE_VIEWPORT.width, BASE_VIEWPORT.height);
const BASE_SHORT_SIDE = Math.min(BASE_VIEWPORT.width, BASE_VIEWPORT.height);

const FLOWER_SPRITE_FILE = "assets/flower_sprite.webp";
const FLOWER_FRAME_COUNT = 6;

const CONFIG = {
  canvas: {
    pixelDensity: 1,
    strokeColor: 10,
    strokeWeight: 2.25,
    background: 250
  },
  field: {
    spacingRatio: 45 / BASE_VIEWPORT.width,
    arrowLenSpacingRatio: 16 / 45,
    repelRadiusSpacingRatio: 50 / 45,
    cursorRepelRadiusSpacingRatio: 50 / 45,
    cursorClearSpacingRatio: 30.8 / 45,
    cursorClearFeatherSpacingRatio: 20 / 45,
    stiffness: 0.075,
    damping: 0.86,
    maxSpeed: 12,
    mouseLerp: 0.4,
    falloffMultiplier: 2.1,
    outerStrength: 0.15,
    innerExtraStrength: 0.11,
    innerEase: 2.8,
    outerFalloffExponent: 1.35,
    directionEpsilon: 1e-4,
    pushEpsilon: 1e-3,
    angleEpsilon: 1e-6,
    arrowShape: {
      shaftRatio: 0.4,
      tipLengthRatio: 0.55,
      tipWidthRatio: 0.35
    },
    densityCompensation: {
      minShortSide: 420,
      maxShortSide: 1280,
      boost: 1.6
    },
    pointerPresence: {
      enterRate: 0.4,
      exitRate: 0.08
    }
  },
  flower: {
    radiusRatio: 122 / BASE_SHORT_SIDE,
    revealRadiusDiagonalRatio: 180 / BASE_DIAGONAL,
    holePaddingRatio: 120 / BASE_SHORT_SIDE,
    clearRadiusRatio: 40 / BASE_SHORT_SIDE,
    clearFeatherRatio: 70 / BASE_SHORT_SIDE,
    revealStart: 0.25,
    revealVisibleOffset: 0.04,
    activationLerpMinRate: 0.025,
    activationLerpMaxRate: 0.1,
    activationLerpDeltaWindow: 0.3,
    activationLerpMinRateExit: 0.06,
    activationLerpMaxRateExit: 0.58,
    fadeInExponent: 1.15,
    frameHoldActivation: 0.24,
    activationVisibilityThreshold: 0.05,
    rotationMaxDegrees: 60,
    rotationExponent: 1.4,
    frameProgressExponent: 0.7,
    glowBase: 0.45,
    glowGain: 0.65,
    bodyScaleBase: 0.45,
    bodyScaleGain: 0.35
  }
};

function computeViewportMetrics() {
  const widthRatio = windowWidth / BASE_VIEWPORT.width;
  const heightRatio = windowHeight / BASE_VIEWPORT.height;
  const layoutScale = constrain(Math.min(widthRatio, heightRatio), 0.45, 1.6);
  const diagonal = Math.hypot(windowWidth, windowHeight);
  const reachScale = constrain(diagonal / BASE_DIAGONAL, 0.5, 1.8);
  return { layoutScale, reachScale };
}

function computeDensityCompensation({
  minShortSide = 420,
  maxShortSide = 1280,
  boost = 1.3
} = {}) {
  if (maxShortSide <= minShortSide) {
    return boost;
  }
  const shortSide = Math.min(windowWidth, windowHeight);
  const t = constrain((shortSide - minShortSide) / (maxShortSide - minShortSide), 0, 1);
  return lerp(boost, 1, t);
}

function buildResponsiveFieldConfig(base) {
  const { layoutScale, reachScale } = computeViewportMetrics();
  const {
    spacingRatio,
    arrowLenSpacingRatio,
    repelRadiusSpacingRatio,
    cursorRepelRadiusSpacingRatio,
    cursorClearSpacingRatio,
    cursorClearFeatherSpacingRatio,
    falloffMultiplier,
    densityCompensation,
    ...rest
  } = base;

  const baseSpacing = spacingRatio * BASE_VIEWPORT.width;
  const densityFactor = computeDensityCompensation(densityCompensation);
  const spacing = baseSpacing * layoutScale * densityFactor;

  return {
    ...rest,
    spacing,
    arrowLen: spacing * arrowLenSpacingRatio,
    repelRadius: spacing * (cursorRepelRadiusSpacingRatio ?? repelRadiusSpacingRatio),
    cursorClearRadius: spacing * (cursorClearSpacingRatio ?? 0),
    cursorClearFeather: spacing * (cursorClearFeatherSpacingRatio ?? 0),
    falloffMultiplier: falloffMultiplier * reachScale
  };
}

function buildResponsiveFlowerConfig(base) {
  const { layoutScale, reachScale } = computeViewportMetrics();
  const {
    radiusRatio,
    revealRadiusDiagonalRatio,
    holePaddingRatio,
    clearRadiusRatio,
    clearFeatherRatio,
    ...rest
  } = base;

  const radiusPx = radiusRatio * BASE_SHORT_SIDE;
  const holePaddingPx = holePaddingRatio * BASE_SHORT_SIDE;
  const clearRadiusPx = clearRadiusRatio * BASE_SHORT_SIDE;
  const clearFeatherPx = clearFeatherRatio * BASE_SHORT_SIDE;
  const revealRadiusPx = revealRadiusDiagonalRatio * BASE_DIAGONAL;

  return {
    ...rest,
    radius: radiusPx * layoutScale,
    revealRadius: revealRadiusPx * reachScale,
    holePadding: holePaddingPx * layoutScale,
    clearRadius: clearRadiusPx * layoutScale,
    clearFeather: clearFeatherPx * layoutScale
  };
}

function buildResponsiveConfigs() {
  return {
    field: buildResponsiveFieldConfig(CONFIG.field),
    flower: buildResponsiveFlowerConfig(CONFIG.flower)
  };
}

function handlePointerEnter() {
  if (field) {
    field.setPointerInCanvas(true);
  }
}

function handlePointerLeave() {
  if (field && (typeof touches === "undefined" || touches.length === 0)) {
    field.resetPointerState();
  }
}


let field;
let bloomingFlower;
let flowerSprite;

function preload() {
  flowerSprite = loadImage(FLOWER_SPRITE_FILE);
}

function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.mouseOver(handlePointerEnter);
  canvas.mouseOut(handlePointerLeave);
  window.addEventListener("pointerleave", handlePointerLeave);
  window.addEventListener("blur", handlePointerLeave);
  pixelDensity(CONFIG.canvas.pixelDensity);
  stroke(CONFIG.canvas.strokeColor);
  noFill();

  const { field: fieldConfig, flower: flowerConfig } = buildResponsiveConfigs();
  const baseSpacing = CONFIG.field.spacingRatio * BASE_VIEWPORT.width;
  const spacingRatio = fieldConfig.spacing / baseSpacing;
  strokeWeight(CONFIG.canvas.strokeWeight * spacingRatio);

  field = new VectorField(fieldConfig);
  bloomingFlower = new BloomingFlower(flowerConfig, flowerSprite, FLOWER_FRAME_COUNT);

  background(CONFIG.canvas.background);
}

function draw() {
  background(CONFIG.canvas.background);
  field.updateAndDraw(mouseX, mouseY, bloomingFlower);
  bloomingFlower.draw();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  const { field: fieldConfig, flower: flowerConfig } = buildResponsiveConfigs();
  const baseSpacing = CONFIG.field.spacingRatio * BASE_VIEWPORT.width;
  const spacingRatio = fieldConfig.spacing / baseSpacing;
  strokeWeight(CONFIG.canvas.strokeWeight * spacingRatio);
  if (field) {
    field.applyResponsiveConfig(fieldConfig);
  }
  if (bloomingFlower) {
    bloomingFlower.applyResponsiveConfig(flowerConfig);
  }
}

function mouseMoved() {
  handlePointerEnter();
}

function mouseDragged() {
  handlePointerEnter();
}

function mouseOut() {
  handlePointerLeave();
}

function touchStarted() {
  handlePointerEnter();
}

function touchEnded() {
  if (typeof touches === "undefined" || touches.length === 0) {
    handlePointerLeave();
  }
}


class VectorField {
  constructor({
    spacing = 50,
    arrowLen = 16,
    repelRadius = 110,
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
    this.spacing = spacing;
    this.arrowLen = arrowLen;
    this.repelRadius = repelRadius;
    this.cursorClearRadius = cursorClearRadius;
    this.cursorClearFeather = cursorClearFeather;

    this.stiffness = stiffness;
    this.damping = damping;
    this.maxSpeed = maxSpeed;

    this.mouseLerp = constrain(mouseLerp, 0, 1);
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
      enterRate: constrain(enterRate, 0, 1),
      exitRate: constrain(exitRate, 0, 1)
    };
    this.pointerPresenceValue = 0;
    this.pointerInCanvas = false;

    this.smoothedMouse = createVector(0, 0);
    this._mouseInit = false;

    // Reusable temporary vectors to avoid GC
    this._tmpDiff = createVector(0, 0);
    this._tmpDir = createVector(0, 0);
    this._tmpTarget = createVector(0, 0);
    this._tmpToTarget = createVector(0, 0);
    this._tmpDirToMouse = createVector(0, 0);

    this.base = [];
    this.pos = [];
    this.vel = [];
    this.rebuild();
  }

  rebuild() {
    this.base.length = 0;
    this.pos.length = 0;
    this.vel.length = 0;

    const paddingX = Math.min(this.arrowLen, width / 2);
    const paddingY = Math.min(this.arrowLen, height / 2);
    const availableWidth = Math.max(width - paddingX * 2, 0);
    const availableHeight = Math.max(height - paddingY * 2, 0);

    const cols = Math.floor(availableWidth / this.spacing) + 1;
    const rows = Math.floor(availableHeight / this.spacing) + 1;
    const totalWidth = (cols - 1) * this.spacing;
    const totalHeight = (rows - 1) * this.spacing;
    const x0 = (width - totalWidth) / 2;
    const y0 = (height - totalHeight) / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = x0 + c * this.spacing;
        const py = y0 + r * this.spacing;
        const p = createVector(px, py);
        this.base.push(p);
        this.pos.push(p.copy());
        this.vel.push(createVector(0, 0));
      }
    }
  }

  applyResponsiveConfig(config) {
    this.spacing = config.spacing;
    this.arrowLen = config.arrowLen;
    this.repelRadius = config.repelRadius;
    this.cursorClearRadius = config.cursorClearRadius ?? this.cursorClearRadius;
    this.cursorClearFeather = config.cursorClearFeather ?? this.cursorClearFeather;
    this.falloffMultiplier = config.falloffMultiplier;
    if (config.pointerPresence) {
      this.pointerPresenceConfig = {
        ...this.pointerPresenceConfig,
        ...config.pointerPresence
      };
      this.pointerPresenceConfig.enterRate = constrain(this.pointerPresenceConfig.enterRate, 0, 1);
      this.pointerPresenceConfig.exitRate = constrain(this.pointerPresenceConfig.exitRate, 0, 1);
    }
    this.rebuild();
  }

  updateAndDraw(mx, my, revealTarget) {
    const curMouse = createVector(mx, my);
    if (!this._mouseInit) {
      this.smoothedMouse.set(curMouse);
      this._mouseInit = true;
    } else {
      this.smoothedMouse.lerp(curMouse, this.mouseLerp);
    }
    // We can use smoothedMouse directly as 'm' since we won't mutate it destructively for logic
    const m = this.smoothedMouse;
    const pointerPresence = this._updatePointerPresence();

    // Note: revealTarget.computeHole returns a new object, but that's once per frame, acceptable.
    // Ideally computeHole could also write to a shared object if we wanted extreme optimization.
    const holeData = revealTarget
      ? revealTarget.computeHole(m.copy(), this.repelRadius)
      : null;

    const holeCenter = holeData?.center ?? m;
    const baseHoleRadius = holeData?.radius ?? this.repelRadius;
    const holeRadius = baseHoleRadius * pointerPresence;
    const falloffRange = holeRadius * this.falloffMultiplier;
    const outerRadius = holeRadius + falloffRange;
    const boundaryPush = falloffRange * this.outerStrength;

    const holeClearRadius = holeData?.clearRadius ?? 0;
    const holeClearFeather = holeData?.clearFeather ?? 0;
    const cursorClearRadius = this.cursorClearRadius * pointerPresence;
    const cursorClearFeather = this.cursorClearFeather * pointerPresence;
    const clearRadius = Math.max(holeClearRadius, cursorClearRadius);
    const clearFeather = Math.max(holeClearFeather, cursorClearFeather);

    for (let i = 0; i < this.base.length; i++) {
      const base = this.base[i];
      const pos = this.pos[i];
      const vel = this.vel[i];

      // Calculate diff: base - holeCenter
      this._tmpDiff.set(base);
      this._tmpDiff.sub(holeCenter);

      const d = this._tmpDiff.mag();

      // Start target at base position
      this._tmpTarget.set(base);

      if (d < outerRadius) {
        // Calculate direction
        if (d > this.directionEpsilon) {
          this._tmpDir.set(this._tmpDiff);
          this._tmpDir.mult(1 / d); // Normalize
        } else {
          this._tmpDir.set(1, 0);
        }

        if (d < holeRadius) {
          const insideNorm = constrain((holeRadius - d) / holeRadius, 0, 1);
          const eased = 1 - Math.exp(-this.innerEase * insideNorm);
          const push = boundaryPush + falloffRange * this.innerExtraStrength * eased;

          // target = base + dir * push
          this._tmpDir.mult(push);
          this._tmpTarget.add(this._tmpDir);
        } else {
          const falloffNorm = constrain((outerRadius - d) / falloffRange, 0, 1);
          const eased = pow(falloffNorm, this.outerFalloffExponent);
          const push = falloffRange * this.outerStrength * eased;

          if (push > this.pushEpsilon) {
            // target = base + dir * push
            this._tmpDir.mult(push);
            this._tmpTarget.add(this._tmpDir);
          }
        }
      }

      if (clearRadius > 0 && d < clearRadius + clearFeather) {
        // Recalculate direction out (same as before usually, but safe to re-derive or reuse if valid)
        // We reused _tmpDir above, so let's re-calculate to be safe and clear
        if (d > this.directionEpsilon) {
          this._tmpDir.set(this._tmpDiff);
          this._tmpDir.mult(1 / d);
        } else {
          this._tmpDir.set(1, 0);
        }

        let exclusionPush = 0;
        if (d < clearRadius) {
          exclusionPush = clearRadius - d;
        } else if (clearFeather > 0) {
          const t = 1 - (d - clearRadius) / clearFeather;
          const eased = t * t;
          exclusionPush = clearFeather * eased * 0.6;
        }

        if (exclusionPush > 0) {
          this._tmpDir.mult(exclusionPush);
          this._tmpTarget.add(this._tmpDir);
        }
      }

      // Physics update
      // toTarget = (target - pos) * stiffness
      this._tmpToTarget.set(this._tmpTarget);
      this._tmpToTarget.sub(pos);
      this._tmpToTarget.mult(this.stiffness);

      // vel = vel * damping + toTarget
      vel.mult(this.damping);
      vel.add(this._tmpToTarget);

      if (vel.magSq() > this.maxSpeed * this.maxSpeed) {
        vel.setMag(this.maxSpeed);
      }

      pos.add(vel);

      // Rotation
      this._tmpDirToMouse.set(m);
      this._tmpDirToMouse.sub(pos);

      const angle = this._tmpDirToMouse.magSq() > this.angleEpsilon
        ? this._tmpDirToMouse.heading()
        : 0;

      push();
      translate(pos.x, pos.y);
      rotate(angle);
      this._arrow(this.arrowLen);
      pop();
    }
  }

  _arrow(len) {
    const { shaftRatio, tipLengthRatio, tipWidthRatio } = this.arrowShape;
    const shaftHalf = len * shaftRatio;
    const tipLength = len * tipLengthRatio;
    const tipWidth = len * tipWidthRatio;

    const tipStart = shaftHalf;
    const tipEnd = tipStart + tipLength;

    line(-shaftHalf, 0, tipEnd, 0);
    line(tipEnd, 0, tipStart, tipWidth);
    line(tipEnd, 0, tipStart, -tipWidth);
  }

  _updatePointerPresence() {
    const hasPointer = this._hasActivePointer();
    const target = hasPointer ? 1 : 0;
    const rate = hasPointer
      ? this.pointerPresenceConfig.enterRate
      : this.pointerPresenceConfig.exitRate;
    const clampedRate = constrain(rate, 0, 1);
    this.pointerPresenceValue = lerp(this.pointerPresenceValue, target, clampedRate);
    if (abs(this.pointerPresenceValue - target) < 1e-3) {
      this.pointerPresenceValue = target;
    }
    return this.pointerPresenceValue;
  }

  _hasActivePointer() {
    const hasTouch = typeof touches !== "undefined" && touches.length > 0;
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

class BloomingFlower {
  constructor(
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
    this.rotationMaxRad = radians(rotationMaxDegrees);
    this.glowBase = glowBase;
    this.glowGain = glowGain;
    this.bodyScaleBase = bodyScaleBase;
    this.bodyScaleGain = bodyScaleGain;

    this.spriteSheet = spriteSheet;
    this.frameCount = frameCount;

    this.center = createVector(width / 2, height / 2);
    this.proximity = 0;
    this.activation = 0;
    this.visible = false;
    this._hole = null;
  }

  applyResponsiveConfig(config) {
    Object.assign(this, config);
    if (this.rotationMaxDegrees !== undefined) {
      this.rotationMaxRad = radians(this.rotationMaxDegrees);
    }
    this.handleResize();
    this._hole = null;
  }

  computeHole(mouseVec, baseRepel) {
    this.center.set(width / 2, height / 2);

    const dist = p5.Vector.dist(mouseVec, this.center);
    this.proximity = constrain(1 - dist / this.revealRadius, 0, 1);

    const normalized = constrain(
      (this.proximity - this.revealStart) / (1 - this.revealStart),
      0,
      1
    );
    const targetActivation = this._easeOutCubic(normalized);

    const delta = abs(targetActivation - this.activation);
    const exiting = targetActivation < this.activation;
    const minRate = exiting && this.activationLerpMinRateExit !== undefined
      ? this.activationLerpMinRateExit
      : this.activationLerpMinRate;
    const maxRate = exiting && this.activationLerpMaxRateExit !== undefined
      ? this.activationLerpMaxRateExit
      : this.activationLerpMaxRate;
    const rate = constrain(
      map(delta, 0, this.activationLerpDeltaWindow, minRate, maxRate),
      minRate,
      maxRate
    );

    this.activation = lerp(this.activation, targetActivation, rate);
    if (abs(this.activation - targetActivation) < 1e-4) {
      this.activation = targetActivation;
    }

    const visibilityThreshold = this.activationVisibilityThreshold ?? 1e-4;
    this.visible = this.activation > visibilityThreshold;

    if (!this.visible) {
      this._hole = null;
      return null;
    }

    const targetRadius = this.radius + this.holePadding;
    const radius = lerp(baseRepel, targetRadius, this.activation);
    const center = p5.Vector.lerp(mouseVec, this.center, this.activation);

    const clearRadius = this.clearRadius * this.activation;
    const clearFeather = this.clearFeather;

    this._hole = { center, radius, clearRadius, clearFeather };
    return this._hole;
  }

  draw() {
    if (!this.visible || !this.spriteSheet) {
      return;
    }

    push();
    translate(this.center.x, this.center.y);
    const rotation = this.rotationMaxRad
      ? this.rotationMaxRad * pow(this.activation, this.rotationExponent)
      : 0;
    rotate(rotation);
    imageMode(CENTER);

    const glow = this.glowBase + this.glowGain * this.activation;
    const scale = this.bodyScaleBase + this.bodyScaleGain * this.activation;
    const size = this.radius * 2 * scale;

    const fadeIn = pow(constrain(this.activation, 0, 1), this.fadeInExponent);

    const lastIndex = this.frameCount - 1;
    const frameT = this.activation <= this.frameHoldActivation
      ? 0
      : constrain(
        (this.activation - this.frameHoldActivation) / (1 - this.frameHoldActivation),
        0,
        1
      );
    const shapedFrameT = pow(frameT, this.frameProgressExponent ?? 1);
    const progress = shapedFrameT * lastIndex;
    const idx0 = floor(progress);
    const idx1 = min(idx0 + 1, lastIndex);
    const blend = progress - idx0;
    const alpha = 255 * glow * fadeIn;

    // Sprite sheet logic
    // Assuming horizontal strip
    const frameWidth = this.spriteSheet.width / this.frameCount;
    const frameHeight = this.spriteSheet.height;

    // Draw frame 0
    tint(255, alpha * (1 - blend));
    // image(img, dx, dy, dWidth, dHeight, sx, sy, sWidth, sHeight)
    image(
      this.spriteSheet,
      0, 0, size, size,
      idx0 * frameWidth, 0, frameWidth, frameHeight
    );

    if (idx1 !== idx0) {
      tint(255, alpha * blend);
      image(
        this.spriteSheet,
        0, 0, size, size,
        idx1 * frameWidth, 0, frameWidth, frameHeight
      );
    }

    noTint();
    pop();
  }

  handleResize() {
    this.center.set(width / 2, height / 2);
  }

  _easeOutCubic(t) {
    const clamped = constrain(t, 0, 1);
    return 1 - pow(1 - clamped, 3);
  }
}

