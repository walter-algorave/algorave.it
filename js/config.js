// ── BASE VIEWPORT ─────────────────────────────────────────────────────────
// Reference frame for every *Ratio in CONFIG. Resolved values are derived at
// runtime against the live display (see computeViewportMetrics).

export const BASE_VIEWPORT = { width: 2560, height: 1440 };

export const BASE_DIAGONAL = Math.hypot(
  BASE_VIEWPORT.width,
  BASE_VIEWPORT.height,
);

export const BASE_SHORT_SIDE = Math.min(
  BASE_VIEWPORT.width,
  BASE_VIEWPORT.height,
);

export const CONFIG = {
  canvas: {
    pixelDensity: 1,
    strokeColor: 10,
    strokeWeight: 2.25,
    background: 250,
  },

  field: {
    // ── GRID & ARROW ──
    spacingRatio: 45 / BASE_VIEWPORT.width,
    arrowLenSpacingRatio: 16 / 45,

    // ── CURSOR HOLE ──
    cursor: {
      clearRadiusSpacingRatio: 30 / 45,
      clearFeatherSpacingRatio: 200 / 45,
    },

    // ── PHYSICS ──
    // Per-arrow spring-damper toward the grid rest position. Epsilons skip
    // sub-pixel updates so settled arrows stop costing draw work.
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
      tipWidthRatio: 0.35,
    },

    // Density boost on small screens so arrow spacing stays readable on mobile.
    densityCompensation: {
      minShortSide: 420,
      maxShortSide: 1280,
      boost: 1.6,
    },

    // Arrows whose grid-base falls deep inside a repulsor are faded out —
    // only the border ring stays visible, forming the repulsion halo without
    // ugly accumulation at the centre.
    arrowCulling: {
      circleCoreFraction: 0.45, // circle: fraction of holeRadius below which arrows hide
      rectCoreFraction: 0.55, // rect: normalized elliptical distance threshold
    },

    // Feather-band push magnitude as a fraction of the feather distance.
    // Used by (a) rounded-box rect repulsors (preview/label SDF) and (b) the
    // circular clear push around cursor/flower-hole centres. The radial
    // falloff of circle repulsors uses outerStrength/innerExtraStrength —
    // different formula entirely.
    featherPushStrength: 0.25,

    pointerPresence: {
      enterRate: 0.4,
      exitRate: 0.08,
    },
  },

  // Default template for every flower instance — per-instance overrides are
  // merged on top in buildResponsiveFlowerConfig.
  flower: {
    // ── GEOMETRY ──
    radiusRatio: 122 / BASE_SHORT_SIDE,
    revealRadiusDiagonalRatio: 140 / BASE_DIAGONAL,
    holePaddingRatio: 70 / BASE_SHORT_SIDE,
    clearRadiusRatio: 50 / BASE_SHORT_SIDE,
    clearFeatherRatio: 120 / BASE_SHORT_SIDE,
    revealRadiusRatio: 180 / BASE_SHORT_SIDE,
    // Physical core of the vector repulsion before proximity scaling.
    initialHoleRadiusRatio: 20 / BASE_SHORT_SIDE,
    tapLockRadiusRatio: 50 / BASE_SHORT_SIDE,
    // Hysteresis: mouse must be closer to bloom, can drift further before un-blooming.
    snapInRadiusRatio: 60 / BASE_SHORT_SIDE,
    snapOutRadiusRatio: 100 / BASE_SHORT_SIDE,
    // Applied only to the final bloom snap (animActivation lerp).
    snapLerpRate: 0.3,

    // ── MAGNETISM ──
    // Arrow orientation lock: fast engage, slow release while preview is closing.
    magnetismLerpEngage: 0.25,
    magnetismLerpHover: 0.08,
    magnetismLerpLocked: 0.02,

    // ── ACTIVATION LERP ──
    // Rate scales with delta (small delta → minRate, large → maxRate). Exit
    // rates are higher so the close stays snappy without overshoot.
    revealStart: 0.2,
    activationLerpMinRate: 0.025,
    activationLerpMaxRate: 0.1,
    activationLerpDeltaWindow: 0.3,
    activationLerpMinRateExit: 0.03,
    activationLerpMaxRateExit: 0.15,

    // Reverse-bloom close speed once a preview-enabled flower is clicked.
    // 0.05 ≈ cinematic, 0.20 ≈ snappy. 0.07 ≈ ~830ms.
    lockedActivationRate: 0.07,
    // Field-side close speed while locked — decoupled so the circular repulsor
    // vanishes right after release while the sprite plays the slower close.
    // Should track preview.openingLerpRate so the field cross-fades cleanly.
    lockedFieldActivationRate: 0.3,

    // ── VISUAL ──
    fadeInExponent: 1.05,
    frameHoldActivation: 0.24,
    activationVisibilityThreshold: 0.05,
    rotationMaxDegrees: 60,
    rotationExponent: 1.4,
    frameProgressExponent: 0.8,
    glowBase: 0.45,
    glowGain: 0.65,
    bodyScaleBase: 0.45,
    bodyScaleGain: 0.35,
    gridCols: 6,

    // Press-down feedback while pointer is held.
    pressLerpRate: 0.25,
    pressScaleGain: 0.05,

    // ── LABEL ──
    labelConfig: {
      fontSizeRatio: 75 / BASE_SHORT_SIDE,
      fontFamily: "Nunito",
      fontWeight: 500,
      color: 20,
      clearPaddingRatio: 5 / BASE_SHORT_SIDE,
      featherPaddingRatio: 200 / BASE_SHORT_SIDE,
      // sdRoundBox radius — capped to min(halfW, halfH), so high values pill out.
      cornerRadiusRatio: 20 / BASE_SHORT_SIDE,
      // Mirrors preview.repulsion.fadeInExponent so label bbox fades with the
      // same shape as the preview bbox.
      fadeInExponent: 1.4,
      activationRate: 0.15,
      deactivationRate: 0.25,
    },

    // ── IDLE WINK ──
    // After `timeout` ms of no interaction the flower winks periodically until
    // activation crosses interactionThreshold.
    idle: {
      timeout: 3500,
      winkIntervalMin: 2000,
      winkIntervalMax: 7000,
      winkDuration: 600,
      winkIntensity: 0.65, // 0–1, fraction of full bloom reached during a wink
      holeIntensity: 0.4, // 0–1, physics hole scale during wink
      interactionThreshold: 0.4, // 0–1, activation needed to break idle
    },

    // ── SPRING RELEASE ──
    // On pointer-up the flower overshoots for peakHoldFrames, then the lock
    // fires — fall and close animation run together as one motion.
    // enabled: false restores the pre-spring behaviour exactly.
    springRelease: {
      enabled: true,
      scaleGain: 0.22,
      riseRate: 0.3,
      peakHoldFrames: 5,
    },
  },

  // ── PREVIEW OVERLAY ──
  // Spring-damped media tiles + a single unified rect repulsor over the card
  // bbox (one source of force = no inter-block oscillation).
  preview: {
    // Field collapse rate after release. Sibling of floatingImage.fadeOutLerpRate
    // (tile alpha) and textFade.outLerpRate (text alpha), but distinct: this
    // one drives the FIELD response, not the preview's visual alpha.
    closingLerpRate: 0.25,
    // Ramp-up while the anchor flower is closing. Must stay close to
    // flower.lockedFieldActivationRate so the circular hole and the rect
    // repulsor cross-fade in sync — otherwise arrows get a one-frame kick.
    openingLerpRate: 0.3,

    // Ratios applied against the LIVE canvas shortSide at draw time (no
    // flowerScale here — preview tiles track the canvas 1:1).
    layout: {
      padRatio: 0.04,
      tileWRatio: 0.22,
      tileHRatio: 0.22, // square slots so square photos don't overflow
      tileGapRatio: 0.03,
      titleSizeRatio: 0.055,
      subtitleSizeRatio: 0.022,
      bodySizeRatio: 0.016,
      textGapRatio: 0.014,
      // Bigger than textGap so the photo row breathes above the headline.
      mediaTextGapRatio: 0.04,
      containerMinWRatio: 0.45,
    },

    textFade: {
      inLerpRate: 0.4,
      outLerpRate: 0.3,
    },

    floatingImage: {
      stiffness: 0.1, // ↑ → tighter pull-back
      damping: 0.78, // ↓ → more friction (less drift)
      maxSpeed: 1.0,
      repulsionRadiusRatio: 150 / BASE_SHORT_SIDE,
      repulsionStrength: 0.18,
      // Scales the per-frame velocity injection from cursor repulsion.
      // repulsionStrength is the push *budget*; this turns it into the gentle
      // drift the tiles actually need (full strength would whip).
      repulsionVelocityScale: 0.04,
      fadeInDurationMs: 100,
      // Tuned to track the vector field collapse (see closingLerpRate).
      fadeOutLerpRate: 0.3,
    },

    // Unified rect repulsor covering the tight bbox of all content blocks
    // (media tiles + each measured text line). Strength fades in with the
    // anchor's close progress (closing^fadeInExponent). New media types join
    // the bbox automatically via their renderer's getBounds() — no per-type tuning.
    repulsion: {
      fadeInExponent: 1.4,
      clearPaddingRatio: 30 / BASE_SHORT_SIDE,
      featherPaddingRatio: 220 / BASE_SHORT_SIDE,
      cornerRadiusRatio: 40 / BASE_SHORT_SIDE,
    },

    // Action buttons rebuilt as full BloomingFlower instances. `type` drives
    // the trigger handler in PreviewManager._triggerAction.
    actionFlowers: [
      {
        id: "action-close",
        type: "close",
        triggerTime: "peak",
        x: 0.42,
        y: 0.88,
        sprite: "./assets/daisy_sprite.webp",
      },
      {
        id: "action-link",
        type: "link",
        triggerTime: "closed",
        x: 0.58,
        y: 0.88,
        sprite: "./assets/daisy_sprite.webp",
      },
    ],

    // Per-instance overrides merged on top of CONFIG.flower for action flowers.
    // Note on snap radii: tapLock/snapIn/snapOut stay at full pixel size even
    // though the sprite is smaller — buttons stay easy to engage (snap zone
    // covers ~60% of the visible action flower vs ~37% on main flowers).
    actionFlowerOverrides: {
      radiusRatio: 75 / BASE_SHORT_SIDE,
      revealRadiusDiagonalRatio: 110 / BASE_DIAGONAL,
      holePaddingRatio: 45 / BASE_SHORT_SIDE,
      clearRadiusRatio: 32 / BASE_SHORT_SIDE,
      clearFeatherRatio: 80 / BASE_SHORT_SIDE,
      tapLockRadiusRatio: 50 / BASE_SHORT_SIDE,
      snapInRadiusRatio: 45 / BASE_SHORT_SIDE,
      snapOutRadiusRatio: 65 / BASE_SHORT_SIDE,
      label: undefined,
      labelConfig: undefined,
      preview: null,
    },
  },

  // ── FLOWERS ──────────────────────────────────────────────────────────────
  // Each entry = one flower on the canvas. Add / remove / reorder freely.
  //
  // Required: id, sprite, x/y (normalized 0–1), label.
  // Optional `preview` object → turns the flower into a clickable hotspot;
  // without it, the flower keeps the hover-only behaviour.
  //
  //   preview: {
  //     title, subtitle, body,            // any combination, omit what's unused
  //     link: "https://...",              // null → ↗ button hidden
  //     media: [                          // unknown types skipped silently
  //       { type: 'image', src: '...' },
  //       // { type: 'youtube', id: '...' },
  //     ]
  //   }
  //
  // Legacy `images: [url, ...]` still accepted as a shorthand media list.
  flowers: [
    {
      id: "flower-1",
      sprite: "./assets/daisy_sprite.webp",
      x: 0.25,
      y: 0.25,
      label: "Daisy Flower",
      preview: {
        title: "Daisy Flower",
        subtitle: "Bellis perennis · campo aperto",
        link: "https://en.wikipedia.org/wiki/Common_daisy",
        media: [
          { type: "image", src: "./assets/daisy_img1.png" },
          { type: "image", src: "./assets/daisy_img2.jpg" },
        ],
      },
    },
    {
      id: "flower-2",
      sprite: "./assets/rose_sprite.webp",
      x: 0.75,
      y: 0.25,
      label: "Rose",
    },
    {
      id: "flower-3",
      sprite: "./assets/anemone_sprite.webp",
      x: 0.25,
      y: 0.75,
      label: "Anemone",
    },
  ],
};

// ── RESPONSIVE BUILDERS ───────────────────────────────────────────────────

// Scales are anchored to the PHYSICAL display, not the window — shrinking the
// window must not shrink the flowers, and the reach radius must stay tied to
// the hardware (not the viewport).
export function computeViewportMetrics(p) {
  const physicalScale = p.constrain(
    p.displayWidth / BASE_VIEWPORT.width,
    0.45,
    1.5,
  );
  const flowerScale = physicalScale;

  const displayDiagonal = Math.hypot(p.displayWidth, p.displayHeight);
  const reachScale = p.constrain(displayDiagonal / BASE_DIAGONAL, 0.5, 1.8);

  return { reachScale, flowerScale, physicalScale };
}

// Uses the PHYSICAL short side — resizing a desktop window must not trigger
// the mobile boost.
export function computeDensityCompensation(
  p,
  { minShortSide = 420, maxShortSide = 1280, boost = 1.6 } = {},
) {
  if (maxShortSide <= minShortSide) {
    return boost;
  }

  const shortSide = Math.min(p.displayWidth, p.displayHeight);
  const t = p.constrain(
    (shortSide - minShortSide) / (maxShortSide - minShortSide),
    0,
    1,
  );
  return p.lerp(boost, 1, t);
}

export function buildResponsiveFieldConfig(p, base) {
  const { physicalScale, reachScale } = computeViewportMetrics(p);
  const {
    spacingRatio,
    arrowLenSpacingRatio,
    falloffMultiplier,
    densityCompensation,
    cursor,
    ...rest
  } = base;

  const baseSpacing = spacingRatio * BASE_VIEWPORT.width * physicalScale;
  const densityFactor = computeDensityCompensation(p, densityCompensation);
  const spacing = baseSpacing * densityFactor;

  return {
    ...rest,
    spacing,
    arrowLen: spacing * arrowLenSpacingRatio,
    cursorClearRadius: spacing * (cursor?.clearRadiusSpacingRatio ?? 0),
    cursorClearFeather: spacing * (cursor?.clearFeatherSpacingRatio ?? 0),
    falloffMultiplier: falloffMultiplier * reachScale,
    strokeColor: CONFIG.canvas.strokeColor,
  };
}

// Extracts every *Ratio field so nothing leaks into ...rest, then resolves
// each to px. labelConfig is rebuilt the same way (nested ratios).
export function buildResponsiveFlowerConfig(p, base, instanceConfig) {
  const { reachScale, flowerScale } = computeViewportMetrics(p);

  const merged = { ...base, ...instanceConfig };

  const {
    radiusRatio,
    revealRadiusDiagonalRatio,
    holePaddingRatio,
    clearRadiusRatio,
    clearFeatherRatio,
    initialHoleRadiusRatio,
    tapLockRadiusRatio,
    snapInRadiusRatio,
    snapOutRadiusRatio,
    labelConfig: rawLabelConfig,
    x: xRatio,
    y: yRatio,
    ...rest
  } = merged;

  const labelConfig = rawLabelConfig
    ? {
        ...rawLabelConfig,
        fontSize:
          (rawLabelConfig.fontSizeRatio ?? 0.02) *
          BASE_SHORT_SIDE *
          flowerScale,
        clearPadding:
          (rawLabelConfig.clearPaddingRatio ?? 0.02) *
          BASE_SHORT_SIDE *
          flowerScale,
        featherPadding:
          (rawLabelConfig.featherPaddingRatio ?? 0.04) *
          BASE_SHORT_SIDE *
          flowerScale,
        cornerRadius:
          (rawLabelConfig.cornerRadiusRatio ?? 0) *
          BASE_SHORT_SIDE *
          flowerScale,
      }
    : undefined;

  return {
    ...rest,
    radius: radiusRatio * BASE_SHORT_SIDE * flowerScale,
    revealRadius: revealRadiusDiagonalRatio * BASE_DIAGONAL * reachScale,
    holePadding: holePaddingRatio * BASE_SHORT_SIDE * flowerScale,
    clearRadius: clearRadiusRatio * BASE_SHORT_SIDE * flowerScale,
    clearFeather: clearFeatherRatio * BASE_SHORT_SIDE * flowerScale,
    initialHoleRadius: initialHoleRadiusRatio * BASE_SHORT_SIDE * flowerScale,
    tapLockRadius: tapLockRadiusRatio * BASE_SHORT_SIDE * flowerScale,
    snapInRadius: snapInRadiusRatio * BASE_SHORT_SIDE * flowerScale,
    snapOutRadius: snapOutRadiusRatio * BASE_SHORT_SIDE * flowerScale,
    x: xRatio !== undefined ? xRatio * p.width : undefined,
    y: yRatio !== undefined ? yRatio * p.height : undefined,
    labelConfig,
  };
}

// Action flowers reuse buildResponsiveFlowerConfig with CONFIG.flower merged
// against actionFlowerOverrides — same primitive, same behaviour, smaller skin.
export function buildResponsivePreviewConfig(p, base) {
  const { flowerScale } = computeViewportMetrics(p);
  const { repulsionRadiusRatio, ...floatingRest } = base.floatingImage;

  const rc = base.repulsion;
  const repulsion = rc
    ? {
        fadeInExponent: rc.fadeInExponent,
        clearPadding: rc.clearPaddingRatio * BASE_SHORT_SIDE * flowerScale,
        featherPadding: rc.featherPaddingRatio * BASE_SHORT_SIDE * flowerScale,
        cornerRadius:
          (rc.cornerRadiusRatio ?? 0) * BASE_SHORT_SIDE * flowerScale,
      }
    : null;

  const baseTemplate = {
    ...CONFIG.flower,
    ...(base.actionFlowerOverrides || {}),
  };
  const actionFlowers = Array.isArray(base.actionFlowers)
    ? base.actionFlowers.map((af) =>
        buildResponsiveFlowerConfig(p, baseTemplate, af),
      )
    : [];

  return {
    floatingImage: {
      ...floatingRest,
      repulsionRadius: repulsionRadiusRatio * BASE_SHORT_SIDE * flowerScale,
    },
    repulsion,
    actionFlowers,
    // layout ratios resolved at draw-time against the live canvas shortSide.
    layout: base.layout,
    textFade: base.textFade,
    closingLerpRate: base.closingLerpRate,
  };
}

export function buildResponsiveConfigs(p) {
  const flowers = CONFIG.flowers.map((f) =>
    buildResponsiveFlowerConfig(p, CONFIG.flower, f),
  );
  return {
    field: buildResponsiveFieldConfig(p, CONFIG.field),
    flowers: flowers,
    preview: buildResponsivePreviewConfig(p, CONFIG.preview),
  };
}
