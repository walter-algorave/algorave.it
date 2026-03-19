import {
    CONFIG,
    BASE_VIEWPORT,
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

        field = new VectorField(p, fieldConfig);

        // Initialize flowers and snap each to the nearest grid cell center.
        bloomingFlowers = flowerConfigs.map(config => {
            const sprite = loadedSprites.get(config.sprite);
            return new BloomingFlower(p, config, sprite);
        });
        snapFlowersToGrid(bloomingFlowers, field);

        applyLayout(p, fieldConfig);
        p.background(CONFIG.canvas.background);

        // Interaction Listeners - Pointer Events API (Native)
        const el = canvas.elt;
        
        // Prevent default browser touch interactions (fallback for older mobile browsers)
        el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });

        el.addEventListener('pointerdown', (e) => {
            handlePointerEnter();
            if (e.pointerType !== 'mouse') lastTouchTime = p.millis();
        });

        el.addEventListener('pointermove', (e) => {
            handlePointerEnter();
        });

        const handlePointerReleaseOrLeave = (e) => {
            // Mouse 'up' does not mean it left the canvas, so stay active (hovering).
            if (e.pointerType === 'mouse' && e.type === 'pointerup') return;

            // Check if pointer is over any flower for tap-lock
            let isOverFlower = false;
            for (const flower of bloomingFlowers) {
                const d = p.dist(p.mouseX, p.mouseY, flower.center.x, flower.center.y);
                if (d < flower.tapLockRadius) {
                    isOverFlower = true;
                    break;
                }
            }

            if (isOverFlower) {
                handlePointerEnter();
            } else {
                handlePointerLeave();
            }
        };

        el.addEventListener('pointerup', handlePointerReleaseOrLeave);
        el.addEventListener('pointercancel', handlePointerReleaseOrLeave);
        el.addEventListener('pointerleave', handlePointerReleaseOrLeave);

        lastFlowerInteractionTime = p.millis();
    };

    // -------------------------------------------------------------------------
    // DRAW LOOP
    // -------------------------------------------------------------------------

    p.draw = () => {
        p.background(CONFIG.canvas.background);

        // Update label state before updateAndDraw so _extraRepulsion is ready for this frame.
        // Uses previous frame's activation (one-frame lag) — imperceptible due to lerp.
        for (const flower of bloomingFlowers) {
            if (flower.label) flower.updateLabel(field);
        }

        field.updateAndDraw(p.mouseX, p.mouseY, bloomingFlowers);

        const threshold = CONFIG.flower.idle?.interactionThreshold ?? 0.1;
        const idleTimeout = CONFIG.flower.idle?.timeout ?? 5000;
        const now = p.millis();
        const isIdle = (now - lastFlowerInteractionTime) > idleTimeout;

        // Single loop: check interaction, update idle state and draw
        for (const flower of bloomingFlowers) {
            if (flower.activation > threshold) {
                lastFlowerInteractionTime = now;
            }
            flower.updateIdle(now, isIdle);
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

        applyLayout(p, fieldConfig);
        field.applyResponsiveConfig(fieldConfig);

        for (let i = 0; i < bloomingFlowers.length; i++) {
            bloomingFlowers[i].applyResponsiveConfig(flowerConfigs[i]);
        }
        snapFlowersToGrid(bloomingFlowers, field);
    };

    // -------------------------------------------------------------------------
    // HELPERS
    // -------------------------------------------------------------------------

    function handlePointerEnter() {
        if (field) field.setPointerInCanvas(true);
    }

    function handlePointerLeave() {
        if (field && (typeof p.touches === "undefined" || p.touches.length === 0)) {
            field.resetPointerState();
        }
    }

    // Snaps each flower's center to the nearest grid cell center.
    // Called after setup and after every resize so flowers always sit on a grid node.
    function snapFlowersToGrid(flowers, field) {
        for (const flower of flowers) {
            const snapped = field.getNearestGridCenter(flower.center.x, flower.center.y);
            flower.center.set(snapped.x, snapped.y);
        }
    }

    // Applies layout-dependent stroke weight. Scales with spacing so arrows
    // stay visually consistent across different viewport sizes and density factors.
    function applyLayout(p, fieldConfig) {
        const baseSpacing = CONFIG.field.spacingRatio * BASE_VIEWPORT.width;
        const spacingRatio = fieldConfig.spacing / baseSpacing;
        p.strokeWeight(CONFIG.canvas.strokeWeight * spacingRatio);
    }
};

// =============================================================================
// INSTANCE CREATION
// =============================================================================

new p5(sketch);
