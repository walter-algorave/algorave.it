import {
    CONFIG,
    buildResponsiveConfigs
} from "./config.js";
import { VectorField } from "./VectorField.js";
import { BloomingFlower } from "./BloomingFlower.js";

// =============================================================================
// SKETCH DEFINITION
// =============================================================================

const sketch = (p) => {
    let field;
    let bloomingFlowers = [];
    // Map to store loaded sprites by ID or path
    const loadedSprites = new Map();

    // -------------------------------------------------------------------------
    // PRELOAD
    // -------------------------------------------------------------------------

    p.preload = () => {
        // Load sprites for all configured flowers
        // We iterate through the config to find unique sprite paths
        const uniqueSprites = new Set(CONFIG.flowers.map(f => f.sprite));

        uniqueSprites.forEach(path => {
            if (path) {
                loadedSprites.set(path, p.loadImage(path));
            }
        });
    };

    // -------------------------------------------------------------------------
    // SETUP
    // -------------------------------------------------------------------------

    p.setup = () => {
        const canvas = p.createCanvas(p.windowWidth, p.windowHeight).parent('sketch-container');

        // Accessibility
        canvas.elt.setAttribute('aria-label', 'Interactive vector field with blooming flowers that react to mouse movement.');
        canvas.elt.setAttribute('role', 'img');
        canvas.elt.innerHTML = 'Your browser does not support the HTML5 canvas tag.';

        p.pixelDensity(CONFIG.canvas.pixelDensity);
        p.stroke(CONFIG.canvas.strokeColor);
        p.noFill();

        const { field: fieldConfig, flowers: flowerConfigs } = buildResponsiveConfigs(p);
        const baseSpacing = CONFIG.field.spacingRatio * 2560;
        const spacingRatio = fieldConfig.spacing / baseSpacing;
        p.strokeWeight(CONFIG.canvas.strokeWeight * spacingRatio);

        field = new VectorField(p, fieldConfig);

        // Initialize multiple flowers
        bloomingFlowers = flowerConfigs.map(config => {
            // Retrieve the loaded sprite for this flower
            const sprite = loadedSprites.get(config.sprite);
            return new BloomingFlower(p, config, sprite);
        });

        p.background(CONFIG.canvas.background);

        // Interaction Listeners
        canvas.mouseOver(handlePointerEnter);
        canvas.mouseOut(handlePointerLeave);
    };

    // -------------------------------------------------------------------------
    // DRAW LOOP
    // -------------------------------------------------------------------------

    p.draw = () => {
        p.background(CONFIG.canvas.background);
        if (field) {
            // Pass all flowers to the field for repulsion/clearing
            field.updateAndDraw(p.mouseX, p.mouseY, bloomingFlowers);

            // Draw each flower
            for (const flower of bloomingFlowers) {
                flower.draw();
            }
        }
    };

    // -------------------------------------------------------------------------
    // EVENTS
    // -------------------------------------------------------------------------

    p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
        const { field: fieldConfig, flowers: flowerConfigs } = buildResponsiveConfigs(p);
        const baseSpacing = CONFIG.field.spacingRatio * 2560;
        const spacingRatio = fieldConfig.spacing / baseSpacing;
        p.strokeWeight(CONFIG.canvas.strokeWeight * spacingRatio);

        if (field) {
            field.applyResponsiveConfig(fieldConfig);
        }

        // Update all flowers
        if (bloomingFlowers.length === flowerConfigs.length) {
            for (let i = 0; i < bloomingFlowers.length; i++) {
                bloomingFlowers[i].applyResponsiveConfig(flowerConfigs[i]);
            }
        } else {
            // Re-init if count changed
            bloomingFlowers = flowerConfigs.map(config => {
                const sprite = loadedSprites.get(config.sprite);
                return new BloomingFlower(p, config, sprite);
            });
        }
    };

    p.mouseMoved = () => {
        handlePointerEnter();
    };

    p.mouseDragged = () => {
        handlePointerEnter();
    };

    p.mouseOut = () => {
        handlePointerLeave();
    };

    p.touchStarted = () => {
        handlePointerEnter();
    };

    p.touchEnded = () => {
        if (typeof p.touches === "undefined" || p.touches.length === 0) {
            handlePointerLeave();
        }
    };

    // -------------------------------------------------------------------------
    // HELPERS
    // -------------------------------------------------------------------------

    function handlePointerEnter() {
        if (field) {
            field.setPointerInCanvas(true);
        }
    }

    function handlePointerLeave() {
        if (field && (typeof p.touches === "undefined" || p.touches.length === 0)) {
            field.resetPointerState();
        }
    }
};

// =============================================================================
// INSTANCE CREATION
// =============================================================================

new p5(sketch);
