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
            clearRadiusSpacingRatio: 30 / 45,
            // Ratio of the cursor clearing feathering relative to the spacing.
            clearFeatherSpacingRatio: 200 / 45,
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
        // Ratio of the snap radius (force bloom) relative to the base short side.
        snapRadiusRatio: 70 / BASE_SHORT_SIDE,
        // Ratio of the arrow snap radius (force arrows to center) relative to the base short side.
        arrowSnapRadiusRatio: 90 / BASE_SHORT_SIDE,
        // Threshold for starting the reveal animation.
        // Interpolation factor for the snap-to-bloom effect ("confident" open lerp).
        snapLerpRate: 0.3,
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
            fontFamily: 'SF Pro Rounded',
            fontWeight: 400,
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
            timeout: 3500,          // Time in ms before idle mode starts
            winkIntervalMin: 2000,  // Min time between winks
            winkIntervalMax: 7000,  // Max time between winks
            winkDuration: 600,      // Duration of a single wink
            winkIntensity: 0.65,    // How much the flower opens (0-1)
            holeIntensity: 0.4,     // Scale for physics hole size during idle (0-1)
            interactionThreshold: 0.4 // Activation level required to reset idle timer (0-1)
        }
    },
    // Array of flower instances to display.
    // To add a flower: add an entry with id, sprite path, x/y (0–1 normalized), and label.
    // gridCols only needed here if this flower's sprite sheet differs from CONFIG.flower.gridCols.
    flowers: [
        {
            id: 'flower-1',
            sprite: './assets/daisy_sprite.webp',
            x: 0.25,
            y: 0.25,
            label: "Daisy Flower"
        },
        {
            id: 'flower-2',
            sprite: './assets/rose_sprite.webp',
            x: 0.75,
            y: 0.25,
            label: "Rose"
        },
        {
            id: 'flower-3',
            sprite: './assets/anemone_sprite.webp',
            x: 0.25,
            y: 0.75,
            label: "Anemone"
        }
    ]
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// Computes scaling metrics based on the current viewport dimensions.
export function computeViewportMetrics(p) {
    // Scale indipendente basato sul MONITOR FISICO, non sulla finestra! (True Physical Density proxy).
    // Ancorandoci al `displayWidth` la griglia/fiori non si rimpiccioliscono stringendo la finestra,
    // eppure rimangono ritarati sulla densità tipica del dispositivo (es. 0.75 per un monitor 1080p,
    // o 0.45 (tetto minimo) per uno smartphone mobile).
    const physicalScale = p.constrain(p.displayWidth / BASE_VIEWPORT.width, 0.45, 1.5);
    const flowerScale = physicalScale;
    
    // Anche l'area d'influenza (reachScale) deve essere ancorata all'hardware,
    // altrimenti stringere la finestra ridurrebbe il raggio in cui il fiore si accorge del mouse!
    const displayDiagonal = Math.hypot(p.displayWidth, p.displayHeight);
    const reachScale = p.constrain(displayDiagonal / BASE_DIAGONAL, 0.5, 1.8);
    
    return { reachScale, flowerScale, physicalScale };
}

// Computes a density compensation factor for smaller screens.
export function computeDensityCompensation(p, {
    minShortSide = 420,
    maxShortSide = 1280,
    boost = 1.6
} = {}) {
    if (maxShortSide <= minShortSide) {
        return boost;
    }
    // TRUE PHYSICAL DENSITY: Usa la dimensione del monitor fisico (display), non della finestra,
    // altrimenti stringere la finestra su desktop attiverebbe il boost per mobile!
    const shortSide = Math.min(p.displayWidth, p.displayHeight);
    const t = p.constrain((shortSide - minShortSide) / (maxShortSide - minShortSide), 0, 1);
    return p.lerp(boost, 1, t);
}

// Builds the responsive configuration for the vector field.
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

    // Ritarato: applichiamo "physicalScale" per ripristinare visivamente la medesima 
    // grandezza di frecce a cui eri abituato con la finestra massimizzata (es. ~75% su un 1080p).
    const baseSpacing = spacingRatio * BASE_VIEWPORT.width * physicalScale;
    const densityFactor = computeDensityCompensation(p, densityCompensation);
    
    // TRUE PHYSICAL DENSITY: we no longer multiply by layoutScale. 
    // Spacing only depends on base configuration + mobile density boost.
    const spacing = baseSpacing * densityFactor;

    return {
        ...rest,
        spacing,
        arrowLen: spacing * arrowLenSpacingRatio,
        cursorClearRadius: spacing * (cursor?.clearRadiusSpacingRatio ?? 0),
        cursorClearFeather: spacing * (cursor?.clearFeatherSpacingRatio ?? 0),
        falloffMultiplier: falloffMultiplier * reachScale
        // pointerPresence is already included via ...rest
    };
}

// Builds the responsive configuration for a single flower instance.
export function buildResponsiveFlowerConfig(p, base, instanceConfig) {
    const { reachScale, flowerScale } = computeViewportMetrics(p);

    // Merge base defaults with per-instance overrides.
    const merged = { ...base, ...instanceConfig };

    // Extract ALL ratio-keyed fields so they don't leak into ...rest.
    // Everything remaining in ...rest is a resolved, non-ratio value passed through as-is.
    const {
        radiusRatio,
        revealRadiusDiagonalRatio,
        holePaddingRatio,
        clearRadiusRatio,
        clearFeatherRatio,
        initialHoleRadiusRatio,
        tapLockRadiusRatio,
        snapRadiusRatio,
        arrowSnapRadiusRatio,
        labelConfig: rawLabelConfig,
        x: xRatio,
        y: yRatio,
        ...rest
    } = merged;

    // Scale label config ratios to px.
    const labelConfig = rawLabelConfig ? {
        ...rawLabelConfig,
        fontSize:      (rawLabelConfig.fontSizeRatio      ?? 0.02) * BASE_SHORT_SIDE * flowerScale,
        offsetY:       (rawLabelConfig.offsetYRatio       ?? 0.10) * BASE_SHORT_SIDE * flowerScale,
        clearPadding:  (rawLabelConfig.clearPaddingRatio  ?? 0.02) * BASE_SHORT_SIDE * flowerScale,
        featherPadding:(rawLabelConfig.featherPaddingRatio ?? 0.04) * BASE_SHORT_SIDE * flowerScale
    } : undefined;

    return {
        ...rest,
        radius:           (radiusRatio              * BASE_SHORT_SIDE) * flowerScale,
        revealRadius:     (revealRadiusDiagonalRatio * BASE_DIAGONAL)  * reachScale,
        holePadding:      (holePaddingRatio          * BASE_SHORT_SIDE) * flowerScale,
        clearRadius:      (clearRadiusRatio          * BASE_SHORT_SIDE) * flowerScale,
        clearFeather:     (clearFeatherRatio         * BASE_SHORT_SIDE) * flowerScale,
        initialHoleRadius:(initialHoleRadiusRatio    * BASE_SHORT_SIDE) * flowerScale,
        tapLockRadius:    (tapLockRadiusRatio        * BASE_SHORT_SIDE) * flowerScale,
        snapRadius:       (snapRadiusRatio           * BASE_SHORT_SIDE) * flowerScale,
        arrowSnapRadius:  (arrowSnapRadiusRatio      * BASE_SHORT_SIDE) * flowerScale,
        x: xRatio !== undefined ? xRatio * p.width  : undefined,
        y: yRatio !== undefined ? yRatio * p.height : undefined,
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

