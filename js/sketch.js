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
    let lastTouchTime = 0;
    let lastFlowerInteractionTime = 0;
    // Map to store loaded sprites by ID or path
    const loadedSprites = new Map();

    // -------------------------------------------------------------------------
    // PRELOAD
    // -------------------------------------------------------------------------

    p.preload = () => {
        // Load sprites for all configured flowers
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
            const sprite = loadedSprites.get(config.sprite);
            const flower = new BloomingFlower(p, config, sprite);
            // Snap to grid
            const snapped = field.getNearestGridCenter(flower.center.x, flower.center.y);
            flower.center.set(snapped.x, snapped.y);
            return flower;
        });

        p.background(CONFIG.canvas.background);

        // Interaction Listeners
        canvas.mouseOver(handlePointerEnter);
        canvas.mouseOut(handlePointerLeave);
        canvas.mouseOver(handlePointerEnter);
        canvas.mouseOut(handlePointerLeave);

        lastFlowerInteractionTime = p.millis();
    };

    // -------------------------------------------------------------------------
    // DRAW LOOP
    // -------------------------------------------------------------------------

    p.draw = () => {
        p.background(CONFIG.canvas.background);
        field.updateAndDraw(p.mouseX, p.mouseY, bloomingFlowers);

        // Draw each flower and its label
        let anyFlowerActive = false;
        const threshold = CONFIG.flower.idle?.interactionThreshold ?? 0.1;

        for (const flower of bloomingFlowers) {
            if (flower.activation > threshold) {
                anyFlowerActive = true;
            }
        }

        if (anyFlowerActive) {
            lastFlowerInteractionTime = p.millis();
        }

        const idleTimeout = CONFIG.flower.idle?.timeout ?? 5000;
        const isIdle = (p.millis() - lastFlowerInteractionTime) > idleTimeout;

        for (const flower of bloomingFlowers) {
            flower.updateIdle(p.millis(), isIdle);
            flower.draw();
            flower.drawLabel();
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

        field.applyResponsiveConfig(fieldConfig);

        // Update all flowers
        for (let i = 0; i < bloomingFlowers.length; i++) {
            bloomingFlowers[i].applyResponsiveConfig(flowerConfigs[i]);
            // Snap to grid
            const snapped = field.getNearestGridCenter(bloomingFlowers[i].center.x, bloomingFlowers[i].center.y);
            bloomingFlowers[i].center.set(snapped.x, snapped.y);
        }
    };

    p.mouseMoved = () => {
        if (p.millis() - lastTouchTime < 500) return;
        handlePointerEnter();
    };

    p.mouseDragged = () => {
        if (p.millis() - lastTouchTime < 500) return;
        handlePointerEnter();
    };

    p.mouseOut = () => {
        handlePointerLeave();
    };

    p.touchStarted = () => {
        lastTouchTime = p.millis();
        handlePointerEnter();
    };

    p.touchEnded = (event) => {
        // Ignore mouse events masquerading as touch events (fixes desktop click bug)
        if (event && event.type === 'mouseup') return;

        lastTouchTime = p.millis();

        if (typeof p.touches === "undefined" || p.touches.length === 0) {
            // Check if we are releasing over a flower
            let isOverFlower = false;
            for (const flower of bloomingFlowers) {
                // Check if the last touch position is within the flower's interaction zone
                const d = p.dist(p.mouseX, p.mouseY, flower.center.x, flower.center.y);
                if (d < flower.tapLockRadius) {
                    isOverFlower = true;
                    break;
                }
            }

            if (isOverFlower) {
                // Keep the field and flower active
                handlePointerEnter();
            } else {
                // Close the field
                handlePointerLeave();
            }
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
