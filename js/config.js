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
        // --- CURSOR INTERACTION (The "Hole" around the mouse) ---
        cursor: {
            // Ratio of the cursor clearing radius relative to the spacing.
            clearRadiusSpacingRatio: 20 / 45,
            // Ratio of the cursor clearing feathering relative to the spacing.
            clearFeatherSpacingRatio: 120 / 45,
        },
        // --- PHYSICS ---
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
    // This object serves as the default template for all flowers.
    flower: {
        // Ratio of the flower radius relative to the base short side.
        radiusRatio: 122 / BASE_SHORT_SIDE,
        // Ratio of the reveal radius relative to the base diagonal.
        revealRadiusDiagonalRatio: 140 / BASE_DIAGONAL,
        // Ratio of the hole padding relative to the base short side.
        holePaddingRatio: 70 / BASE_SHORT_SIDE,
        // Ratio of the clear radius relative to the base short side.
        clearRadiusRatio: 50 / BASE_SHORT_SIDE,
        // Ratio of the clear feathering relative to the base short side.
        clearFeatherRatio: 120 / BASE_SHORT_SIDE,
        // Ratio of the initial hole radius (when starting to bloom) relative to the base short side.
        initialHoleRadiusRatio: 20 / BASE_SHORT_SIDE,
        // Ratio of the tap lock radius relative to the base short side.
        tapLockRadiusRatio: 50 / BASE_SHORT_SIDE,
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
        fadeInExponent: 1.05,
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
        // Number of columns in the sprite sheet grid.
        gridCols: 6,
        // --- LABEL CONFIGURATION ---
        labelConfig: {
            fontSizeRatio: 75 / BASE_SHORT_SIDE,
            fontFamily: 'sans-serif',
            color: 30,
            // Clear area around the text (hard push)
            clearPaddingRatio: 5 / BASE_SHORT_SIDE,
            // Feathered area around the clear area (soft push)
            featherPaddingRatio: 300 / BASE_SHORT_SIDE,
            activationRate: 0.15,
            deactivationRate: 0.25
        },
        // --- IDLE ANIMATION CONFIGURATION ---
        idle: {
            timeout: 3000,          // Time in ms before idle mode starts
            winkIntervalMin: 3000,  // Min time between winks
            winkIntervalMax: 7000,  // Max time between winks
            winkDuration: 600,      // Duration of a single wink
            winkIntensity: 0.65,    // How much the flower opens (0-1)
            holeIntensity: 0.4,     // Scale for physics hole size during idle (0-1)
            interactionThreshold: 0.4 // Activation level required to reset idle timer (0-1)
        }
    },
    // Array of flower instances to display.
    flowers: [
        {
            id: 'flower-1',
            sprite: './assets/daisy_sprite.webp',
            x: 0.25,
            y: 0.25,
            gridCols: 6,
            label: "Daisy Flower"
        },
        {
            id: 'flower-2',
            sprite: './assets/rose_sprite.webp',
            x: 0.75,
            y: 0.25,
            gridCols: 6,
            label: "Rose"
        },
        {
            id: 'flower-3',
            sprite: './assets/anemone_sprite.webp',
            x: 0.25,
            y: 0.75,
            gridCols: 6,
            label: "Anemone"
        }
    ]
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
        falloffMultiplier,
        densityCompensation,
        cursor, // New cursor object
        ...rest
    } = base;

    const baseSpacing = spacingRatio * BASE_VIEWPORT.width;
    const densityFactor = computeDensityCompensation(p, densityCompensation);
    const spacing = baseSpacing * layoutScale * densityFactor;

    return {
        ...rest,
        spacing,
        arrowLen: spacing * arrowLenSpacingRatio,
        cursorClearRadius: spacing * (cursor?.clearRadiusSpacingRatio ?? 0),
        cursorClearFeather: spacing * (cursor?.clearFeatherSpacingRatio ?? 0),
        falloffMultiplier: falloffMultiplier * reachScale,
        pointerPresence: base.pointerPresence // Ensure this is passed through
    };
}

// Builds the responsive configuration for a single flower instance.
export function buildResponsiveFlowerConfig(p, base, instanceConfig) {
    const { layoutScale, reachScale } = computeViewportMetrics(p);

    // Merge base and instance config so overrides take precedence
    const merged = { ...base, ...instanceConfig };

    const {
        radiusRatio,
        revealRadiusDiagonalRatio,
        holePaddingRatio,
        clearRadiusRatio,
        clearFeatherRatio,
        ...rest
    } = merged;

    const radiusPx = radiusRatio * BASE_SHORT_SIDE;
    const holePaddingPx = holePaddingRatio * BASE_SHORT_SIDE;
    const clearRadiusPx = clearRadiusRatio * BASE_SHORT_SIDE;
    const clearFeatherPx = clearFeatherRatio * BASE_SHORT_SIDE;
    const revealRadiusPx = revealRadiusDiagonalRatio * BASE_DIAGONAL;

    // Label config scaling
    const labelConfig = merged.labelConfig ? {
        ...merged.labelConfig,
        fontSize: (merged.labelConfig.fontSizeRatio || 0.02) * BASE_SHORT_SIDE * layoutScale,
        offsetY: (merged.labelConfig.offsetYRatio || 0.1) * BASE_SHORT_SIDE * layoutScale,
        clearPadding: (merged.labelConfig.clearPaddingRatio || 0.02) * BASE_SHORT_SIDE * layoutScale,
        featherPadding: (merged.labelConfig.featherPaddingRatio || 0.04) * BASE_SHORT_SIDE * layoutScale
    } : undefined;

    return {
        ...rest,
        radius: radiusPx * layoutScale,
        revealRadius: revealRadiusPx * reachScale,
        holePadding: holePaddingPx * layoutScale,
        clearRadius: clearRadiusPx * layoutScale,
        clearFeather: clearFeatherPx * layoutScale,
        initialHoleRadius: (merged.initialHoleRadiusRatio * BASE_SHORT_SIDE) * layoutScale,
        tapLockRadius: (merged.tapLockRadiusRatio * BASE_SHORT_SIDE) * layoutScale,
        // Calculate absolute position if x/y are provided as ratios
        x: instanceConfig.x !== undefined ? instanceConfig.x * p.width : undefined,
        y: instanceConfig.y !== undefined ? instanceConfig.y * p.height : undefined,
        labelConfig
    };
}

// Aggregates and builds all responsive configurations.
export function buildResponsiveConfigs(p) {
    const flowers = CONFIG.flowers.map(f => buildResponsiveFlowerConfig(p, CONFIG.flower, f));
    return {
        field: buildResponsiveFieldConfig(p, CONFIG.field),
        flowers: flowers
    };
}

