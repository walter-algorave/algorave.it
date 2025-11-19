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
     - repelRadiusSpacingRatio: raggio del "buco" rispetto allo spacing.
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

   PULSANTE (CONFIG.button)
     - radiusRatio: percentuale del lato corto per il raggio del bottone.
     - revealRadiusDiagonalRatio: percentuale della diagonale usata per il reveal.
     - holePaddingRatio: margine extra del buco rispetto al lato corto.
     - revealStart: soglia di prossimita per iniziare il reveal.
     - revealVisibleOffset: margine per renderlo visibile.
     - label: testo mostrato al centro.
     - glowBase/glowGain: intensita dell'alone rispetto all'attivazione.
     - bodyScaleBase/bodyScaleGain: scala del corpo rispetto al raggio.
     - dropShadowGray/dropShadowAlpha: colore e trasparenza ombra.
     - dropShadowYOffsetRatio/WidthScale/HeightScale: forma dell'ombra.
     - ringGray/ringAlpha/ringWeightBaseRatio/ringWeightGainRatio/ringScale: contorno principale.
     - bodyGray/bodyAlpha*: riempimento del corpo del bottone.
     - labelGray/labelAlpha/textSizeBaseRatio/textSizeGainRatio: stile del testo.
     - hoverRingGray/hoverRingAlpha/hoverRingWeightRatio: alone in hover.
*/

const BASE_VIEWPORT = { width: 2560, height: 1440 };
const BASE_DIAGONAL = Math.hypot(BASE_VIEWPORT.width, BASE_VIEWPORT.height);
const BASE_SHORT_SIDE = Math.min(BASE_VIEWPORT.width, BASE_VIEWPORT.height);

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
  button: {
    radiusRatio: 52 / BASE_SHORT_SIDE,
    revealRadiusDiagonalRatio: 160 / BASE_DIAGONAL,
    holePaddingRatio: 80 / BASE_SHORT_SIDE,
    revealStart: 0.25,
    revealVisibleOffset: 0.04,
    label: "enter",
    glowBase: 0.35,
    glowGain: 0.65,
    bodyScaleBase: 0.55,
    bodyScaleGain: 0.35,
    dropShadowGray: 0,
    dropShadowAlpha: 35,
    dropShadowYOffsetRatio: 5 / BASE_SHORT_SIDE,
    dropShadowWidthScale: 1.4,
    dropShadowHeightScale: 1.6,
    ringGray: 15,
    ringAlphaBase: 80,
    ringAlphaGain: 140,
    ringWeightBaseRatio: 1.2 / BASE_SHORT_SIDE,
    ringWeightGainRatio: 2.2 / BASE_SHORT_SIDE,
    ringScale: 1.25,
    bodyGray: 18,
    bodyAlphaBase: 140,
    bodyAlphaGain: 110,
    labelGray: 250,
    labelAlpha: 200,
    textSizeBaseRatio: 14 / BASE_SHORT_SIDE,
    textSizeGainRatio: 3 / BASE_SHORT_SIDE,
    hoverRingGray: 18,
    hoverRingAlpha: 220,
    hoverRingWeightRatio: 2.5 / BASE_SHORT_SIDE
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
    repelRadius: spacing * repelRadiusSpacingRatio,
    falloffMultiplier: falloffMultiplier * reachScale
  };
}

function buildResponsiveButtonConfig(base) {
  const { layoutScale, reachScale } = computeViewportMetrics();
  const {
    radiusRatio,
    revealRadiusDiagonalRatio,
    holePaddingRatio,
    dropShadowYOffsetRatio,
    ringWeightBaseRatio,
    ringWeightGainRatio,
    hoverRingWeightRatio,
    textSizeBaseRatio,
    textSizeGainRatio,
    ...rest
  } = base;

  const radiusPx = radiusRatio * BASE_SHORT_SIDE;
  const holePaddingPx = holePaddingRatio * BASE_SHORT_SIDE;
  const dropShadowYOffsetPx = dropShadowYOffsetRatio * BASE_SHORT_SIDE;
  const ringWeightBasePx = ringWeightBaseRatio * BASE_SHORT_SIDE;
  const ringWeightGainPx = ringWeightGainRatio * BASE_SHORT_SIDE;
  const hoverRingWeightPx = hoverRingWeightRatio * BASE_SHORT_SIDE;
  const textSizeBasePx = textSizeBaseRatio * BASE_SHORT_SIDE;
  const textSizeGainPx = textSizeGainRatio * BASE_SHORT_SIDE;
  const revealRadiusPx = revealRadiusDiagonalRatio * BASE_DIAGONAL;

  return {
    ...rest,
    radius: radiusPx * layoutScale,
    revealRadius: revealRadiusPx * reachScale,
    holePadding: holePaddingPx * layoutScale,
    dropShadowYOffset: dropShadowYOffsetPx * layoutScale,
    ringWeightBase: ringWeightBasePx * layoutScale,
    ringWeightGain: ringWeightGainPx * layoutScale,
    hoverRingWeight: hoverRingWeightPx * layoutScale,
    textSizeBase: textSizeBasePx * layoutScale,
    textSizeGain: textSizeGainPx * layoutScale
  };
}

function buildResponsiveConfigs() {
  return {
    field: buildResponsiveFieldConfig(CONFIG.field),
    button: buildResponsiveButtonConfig(CONFIG.button)
  };
}

function handlePointerEnter() {
  if (field) {
    field.setPointerInCanvas(true);
  }
}

function handlePointerLeave() {
  if (field && (typeof touches === "undefined" || touches.length === 0)) {
    field.setPointerInCanvas(false);
  }
}


let field;
let interactiveButton;

function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.mouseOver(handlePointerEnter);
  canvas.mouseOut(handlePointerLeave);
  window.addEventListener("pointerleave", handlePointerLeave);
  window.addEventListener("blur", handlePointerLeave);
  pixelDensity(CONFIG.canvas.pixelDensity);
  stroke(CONFIG.canvas.strokeColor);
  noFill();

  const { field: fieldConfig, button: buttonConfig } = buildResponsiveConfigs();
  const baseSpacing = CONFIG.field.spacingRatio * BASE_VIEWPORT.width;
  const spacingRatio = fieldConfig.spacing / baseSpacing;
  strokeWeight(CONFIG.canvas.strokeWeight * spacingRatio);

  field = new VectorField(fieldConfig);
  interactiveButton = new RevealButton(buttonConfig);

  background(CONFIG.canvas.background);
}

function draw() {
  background(CONFIG.canvas.background);
  field.updateAndDraw(mouseX, mouseY, interactiveButton);
  interactiveButton.draw();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  const { field: fieldConfig, button: buttonConfig } = buildResponsiveConfigs();
  const baseSpacing = CONFIG.field.spacingRatio * BASE_VIEWPORT.width;
  const spacingRatio = fieldConfig.spacing / baseSpacing;
  strokeWeight(CONFIG.canvas.strokeWeight * spacingRatio);
  if (field) {
    field.applyResponsiveConfig(fieldConfig);
  }
  if (interactiveButton) {
    interactiveButton.applyResponsiveConfig(buttonConfig);
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
    const m = this.smoothedMouse.copy();
    const pointerPresence = this._updatePointerPresence();

    // Calcola eventuale buco creato dal pulsante/interfaccia
    const holeData = revealTarget
      ? revealTarget.computeHole(m.copy(), this.repelRadius)
      : null;

    const holeCenter = holeData?.center ?? m;
    const baseHoleRadius = holeData?.radius ?? this.repelRadius;
    const holeRadius = baseHoleRadius * pointerPresence;
    const falloffRange = holeRadius * this.falloffMultiplier;
    const outerRadius = holeRadius + falloffRange;
    const boundaryPush = falloffRange * this.outerStrength;

    for (let i = 0; i < this.base.length; i++) {
      const base = this.base[i];
      const pos = this.pos[i];
      const vel = this.vel[i];

      const diff = p5.Vector.sub(base, holeCenter);
      const d = diff.mag();

      let target = base;
      if (d < outerRadius) {
        const dir = d > this.directionEpsilon
          ? diff.copy().mult(1 / d)
          : createVector(1, 0);

        if (d < holeRadius) {
          const insideNorm = constrain((holeRadius - d) / holeRadius, 0, 1);
          const eased = 1 - Math.exp(-this.innerEase * insideNorm);
          const push = boundaryPush + falloffRange * this.innerExtraStrength * eased;
          target = p5.Vector.add(base, dir.mult(push));
        } else {
          const falloffNorm = constrain((outerRadius - d) / falloffRange, 0, 1);
          const eased = pow(falloffNorm, this.outerFalloffExponent);
          const push = falloffRange * this.outerStrength * eased;
          if (push > this.pushEpsilon) {
            target = p5.Vector.add(base, dir.mult(push));
          }
        }
      }

      const toTarget = p5.Vector.sub(target, pos).mult(this.stiffness);
      vel.mult(this.damping).add(toTarget);

      if (vel.mag() > this.maxSpeed) {
        vel.setMag(this.maxSpeed);
      }

      pos.add(vel);

      const dirToMouse = p5.Vector.sub(m, pos);
      const angle = dirToMouse.magSq() > this.angleEpsilon ? dirToMouse.heading() : 0;

      push();
      translate(pos.x, pos.y);
      rotate(angle);
      this._arrow(this.arrowLen);
      pop();
    }
  }

  // Disegna una freccia usando le proporzioni configurabili
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
}

class RevealButton {
  constructor({
    radius = 50,
    revealRadius = 220,
    holePadding = 30,
    revealStart = 0.25,
    revealVisibleOffset = 0.05,
    label = "enter",
    glowBase = 0.35,
    glowGain = 0.65,
    bodyScaleBase = 0.55,
    bodyScaleGain = 0.35,
    dropShadowGray = 0,
    dropShadowAlpha = 35,
    dropShadowYOffset = 5,
    dropShadowWidthScale = 1.4,
    dropShadowHeightScale = 1.6,
    ringGray = 15,
    ringAlphaBase = 80,
    ringAlphaGain = 140,
    ringWeightBase = 1.2,
    ringWeightGain = 2.2,
    ringScale = 1.25,
    bodyGray = 18,
    bodyAlphaBase = 140,
    bodyAlphaGain = 110,
    labelGray = 250,
    labelAlpha = 200,
    textSizeBase = 14,
    textSizeGain = 3,
    hoverRingGray = 18,
    hoverRingAlpha = 220,
    hoverRingWeight = 2.5
  } = {}) {
    this.radius = radius;
    this.revealRadius = revealRadius;
    this.holePadding = holePadding;
    this.revealStart = revealStart;
    this.revealVisibleOffset = revealVisibleOffset;
    this.label = label;
    this.glowBase = glowBase;
    this.glowGain = glowGain;
    this.bodyScaleBase = bodyScaleBase;
    this.bodyScaleGain = bodyScaleGain;
    this.dropShadowGray = dropShadowGray;
    this.dropShadowAlpha = dropShadowAlpha;
    this.dropShadowYOffset = dropShadowYOffset;
    this.dropShadowWidthScale = dropShadowWidthScale;
    this.dropShadowHeightScale = dropShadowHeightScale;
    this.ringGray = ringGray;
    this.ringAlphaBase = ringAlphaBase;
    this.ringAlphaGain = ringAlphaGain;
    this.ringWeightBase = ringWeightBase;
    this.ringWeightGain = ringWeightGain;
    this.ringScale = ringScale;
    this.bodyGray = bodyGray;
    this.bodyAlphaBase = bodyAlphaBase;
    this.bodyAlphaGain = bodyAlphaGain;
    this.labelGray = labelGray;
    this.labelAlpha = labelAlpha;
    this.textSizeBase = textSizeBase;
    this.textSizeGain = textSizeGain;
    this.hoverRingGray = hoverRingGray;
    this.hoverRingAlpha = hoverRingAlpha;
    this.hoverRingWeight = hoverRingWeight;

    this.center = createVector(width / 2, height / 2);
    this.proximity = 0;
    this.activation = 0;
    this.hover = false;
    this.visible = false;
    this._hole = null;
  }

  applyResponsiveConfig(config) {
    Object.assign(this, config);
    this.handleResize();
    this._hole = null;
  }

  computeHole(mouseVec, baseRepel) {
    // Il bottone rimane centrato sulla finestra corrente
    this.center.set(width / 2, height / 2);

    const dist = p5.Vector.dist(mouseVec, this.center);
    this.proximity = constrain(1 - dist / this.revealRadius, 0, 1);
    this.hover = dist <= this.radius;

    const normalized = constrain(
      (this.proximity - this.revealStart) / (1 - this.revealStart),
      0,
      1
    );
    this.activation = this.hover ? 1 : this._easeOutCubic(normalized);

    this.visible = this.proximity > this.revealStart + this.revealVisibleOffset;

    if (this.activation <= 0) {
      this._hole = null;
      return null;
    }

    const targetRadius = this.radius + this.holePadding;
    const radius = lerp(baseRepel, targetRadius, this.activation);
    const center = this.hover
      ? this.center.copy()
      : p5.Vector.lerp(mouseVec, this.center, this.activation);

    this._hole = { center, radius };
    return this._hole;
  }

  draw() {
    if (!this.visible) {
      return;
    }

    push();
    translate(this.center.x, this.center.y);

    const glow = this.glowBase + this.glowGain * this.activation;
    const bodyScale = this.bodyScaleBase + this.bodyScaleGain * this.activation;
    const bodyDiameter = this.radius * 2 * bodyScale;

    // Ombra e bagliore morbido
    noStroke();
    fill(
      this.dropShadowGray,
      this.dropShadowGray,
      this.dropShadowGray,
      this.dropShadowAlpha * glow
    );
    ellipse(
      0,
      this.dropShadowYOffset * (1 - glow),
      bodyDiameter * this.dropShadowWidthScale,
      bodyDiameter * this.dropShadowHeightScale
    );

    // Anello esterno
    stroke(
      this.ringGray,
      this.ringGray,
      this.ringGray,
      this.ringAlphaBase + this.ringAlphaGain * glow
    );
    strokeWeight(this.ringWeightBase + this.ringWeightGain * glow);
    noFill();
    ellipse(0, 0, bodyDiameter * this.ringScale);

    // Corpo del bottone
    noStroke();
    fill(
      this.bodyGray,
      this.bodyGray,
      this.bodyGray,
      this.bodyAlphaBase + this.bodyAlphaGain * glow
    );
    circle(0, 0, bodyDiameter);

    // Testo centrale
    fill(this.labelGray, this.labelGray, this.labelGray, this.labelAlpha);
    textAlign(CENTER, CENTER);
    textSize(this.textSizeBase + this.textSizeGain * glow);
    text(this.label, 0, 0);

    if (this.hover) {
      noFill();
      stroke(
        this.hoverRingGray,
        this.hoverRingGray,
        this.hoverRingGray,
        this.hoverRingAlpha
      );
      strokeWeight(this.hoverRingWeight);
      ellipse(0, 0, (this.radius + this.holePadding) * 2);
    }

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
