// =============================================================================
// GLOBAL VIEWPORT CONSTANTS
// =============================================================================

// Base width for calculations, representing a standard high-res desktop.
export const BASE_VIEWPORT = { width: 2560, height: 1440 };

// Diagonal length of the base viewport, used for scaling calculations.
export const BASE_DIAGONAL = Math.hypot(BASE_VIEWPORT.width, BASE_VIEWPORT.height);

// Shortest side of the base viewport, used for relative sizing.
export const BASE_SHORT_SIDE = Math.min(BASE_VIEWPORT.width, BASE_VIEWPORT.height);

// =============================================================================
// ASSETS & ANIMATION CONSTANTS FOR PYTHON SCRIPT
// =============================================================================

export const FLOWER_SPRITE_FILE = "./assets/flower_sprite.webp";
export const FLOWER_SOURCE_VIDEO = "./assets/daisy_flower.mp4";
export const FLOWER_GRID_COLS = 6;
export const FLOWER_FRAME_COUNT = FLOWER_GRID_COLS * FLOWER_GRID_COLS;
export const FLOWER_CHROMA_THRESHOLD = 0.45;
export const FLOWER_CHROMA_SMOOTHNESS = 0.1;

// =============================================================================
// MAIN CONFIGURATION OBJECT
// =============================================================================

export const CONFIG = {
    // Configuration for the main canvas element.
    canvas: {
        // Pixel density factor (1 = standard, higher for retina displays).
        pixelDensity: 1,
        // Color of the vector field arrows (grayscale value: 0-255).
        strokeColor: 10,
        // Thickness of the vector field arrows.
        strokeWeight: 2.25,
        // Background color of the canvas (grayscale value: 0-255).
        background: 250
    },
    // Configuration for the vector field behavior and appearance.
    field: {
        // Ratio of arrow spacing relative to the base viewport width.
        spacingRatio: 45 / BASE_VIEWPORT.width,
        // Ratio of arrow length relative to the spacing.
        arrowLenSpacingRatio: 16 / 45,
        // Ratio of the repulsion radius relative to the spacing.
        repelRadiusSpacingRatio: 50 / 45,
        // Ratio of the cursor repulsion radius relative to the spacing.
        cursorRepelRadiusSpacingRatio: 50 / 45,
        // Ratio of the cursor clearing radius relative to the spacing.
        cursorClearSpacingRatio: 30.8 / 45,
        // Ratio of the cursor clearing feathering relative to the spacing.
        cursorClearFeatherSpacingRatio: 20 / 45,
        // Stiffness of the arrow spring physics (higher = stiffer).
        stiffness: 0.075,
        // Damping factor for arrow movement (lower = more oscillation).
        damping: 0.86,
        // Maximum speed limit for arrow movement.
        maxSpeed: 12,
        // Interpolation factor for mouse movement smoothing.
        mouseLerp: 0.4,
        // Multiplier for the falloff range of the repulsion effect.
        falloffMultiplier: 2.1,
        // Strength of the repulsion effect at the outer boundary.
        outerStrength: 0.15,
        // Extra strength added to the repulsion effect inside the radius.
        innerExtraStrength: 0.11,
        // Easing exponent for the inner repulsion effect.
        innerEase: 2.8,
        // Exponent for the outer falloff curve.
        outerFalloffExponent: 1.35,
        // Minimum distance to consider for direction calculation to avoid division by zero.
        directionEpsilon: 1e-4,
        // Minimum push force to apply to avoid insignificant updates.
        pushEpsilon: 1e-3,
        // Minimum angle difference to trigger rotation updates.
        angleEpsilon: 1e-6,
        // Configuration for the shape of the individual arrows.
        arrowShape: {
            // Ratio of the shaft length to the total arrow length.
            shaftRatio: 0.4,
            // Ratio of the tip length to the total arrow length.
            tipLengthRatio: 0.55,
            // Ratio of the tip width to the total arrow length.
            tipWidthRatio: 0.35
        },
        // Configuration for adjusting density based on screen size.
        densityCompensation: {
            // Minimum screen short side for density adjustment.
            minShortSide: 420,
            // Maximum screen short side for density adjustment.
            maxShortSide: 1280,
            // Boost factor for density on smaller screens.
            boost: 1.6
        },
        // Configuration for pointer interaction presence.
        pointerPresence: {
            // Rate at which the pointer effect fades in.
            enterRate: 0.4,
            // Rate at which the pointer effect fades out.
            exitRate: 0.08
        }
    },
    // Configuration for the blooming flower behavior and appearance.
    flower: {
        // Ratio of the flower radius relative to the base short side.
        radiusRatio: 122 / BASE_SHORT_SIDE,
        // Ratio of the reveal radius relative to the base diagonal.
        revealRadiusDiagonalRatio: 180 / BASE_DIAGONAL,
        // Ratio of the hole padding relative to the base short side.
        holePaddingRatio: 120 / BASE_SHORT_SIDE,
        // Ratio of the clear radius relative to the base short side.
        clearRadiusRatio: 40 / BASE_SHORT_SIDE,
        // Ratio of the clear feathering relative to the base short side.
        clearFeatherRatio: 70 / BASE_SHORT_SIDE,
        // Threshold for starting the reveal animation.
        revealStart: 0.20,
        // Minimum interpolation rate for activation.
        activationLerpMinRate: 0.025,
        // Maximum interpolation rate for activation.
        activationLerpMaxRate: 0.1,
        // Window size for activation interpolation delta.
        activationLerpDeltaWindow: 0.3,
        // Minimum interpolation rate for deactivation (exit).
        activationLerpMinRateExit: 0.06,
        // Maximum interpolation rate for deactivation (exit).
        activationLerpMaxRateExit: 0.48,
        // Exponent for the fade-in curve.
        fadeInExponent: 1.15,
        // Activation threshold to hold the frame.
        frameHoldActivation: 0.24,
        // Threshold for visibility activation.
        activationVisibilityThreshold: 0.05,
        // Maximum rotation in degrees.
        rotationMaxDegrees: 60,
        // Exponent for rotation easing.
        rotationExponent: 1.4,
        // Exponent for frame progress easing.
        frameProgressExponent: 0.8,
        // Base intensity for the glow effect.
        glowBase: 0.45,
        // Gain factor for the glow effect.
        glowGain: 0.65,
        // Base scale for the flower body.
        bodyScaleBase: 0.45,
        // Gain factor for the flower body scale.
        bodyScaleGain: 0.35,
        // Number of frames in the sprite sheet.
        frameCount: FLOWER_FRAME_COUNT,
        // Number of columns in the sprite sheet grid.
        gridCols: FLOWER_GRID_COLS
    }
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// Computes scaling metrics based on the current viewport dimensions.
export function computeViewportMetrics(p) {
    const widthRatio = p.windowWidth / BASE_VIEWPORT.width;
    const heightRatio = p.windowHeight / BASE_VIEWPORT.height;
    const layoutScale = p.constrain(Math.min(widthRatio, heightRatio), 0.45, 1.6);
    const diagonal = Math.hypot(p.windowWidth, p.windowHeight);
    const reachScale = p.constrain(diagonal / BASE_DIAGONAL, 0.5, 1.8);
    return { layoutScale, reachScale };
}

// Computes a density compensation factor for smaller screens.
export function computeDensityCompensation(p, {
    minShortSide = 420,
    maxShortSide = 1280,
    boost = 1.3
} = {}) {
    if (maxShortSide <= minShortSide) {
        return boost;
    }
    const shortSide = Math.min(p.windowWidth, p.windowHeight);
    const t = p.constrain((shortSide - minShortSide) / (maxShortSide - minShortSide), 0, 1);
    return p.lerp(boost, 1, t);
}

// Builds the responsive configuration for the vector field.
export function buildResponsiveFieldConfig(p, base) {
    const { layoutScale, reachScale } = computeViewportMetrics(p);
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
    const densityFactor = computeDensityCompensation(p, densityCompensation);
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

// Builds the responsive configuration for the flower.
export function buildResponsiveFlowerConfig(p, base) {
    const { layoutScale, reachScale } = computeViewportMetrics(p);
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

// Aggregates and builds all responsive configurations.
export function buildResponsiveConfigs(p) {
    return {
        field: buildResponsiveFieldConfig(p, CONFIG.field),
        flower: buildResponsiveFlowerConfig(p, CONFIG.flower)
    };
}

