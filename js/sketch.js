import {
    CONFIG,
    FLOWER_VIDEO_FILE,
    buildResponsiveConfigs
} from "./config.js";
import { VectorField } from "./VectorField.js";
import { BloomingFlower } from "./BloomingFlower.js";

// =============================================================================
// SKETCH DEFINITION
// =============================================================================

const sketch = (p) => {
    let field;
    let bloomingFlower;
    let flowerVideo;

    // -------------------------------------------------------------------------
    // SETUP
    // -------------------------------------------------------------------------

    let chromaShader;

    // -------------------------------------------------------------------------
    // PRELOAD
    // -------------------------------------------------------------------------

    p.preload = () => {
        chromaShader = p.loadShader('./shaders/chroma.vert', './shaders/chroma.frag');
    };

    // -------------------------------------------------------------------------
    // SETUP
    // -------------------------------------------------------------------------

    p.setup = () => {
        const canvas = p.createCanvas(p.windowWidth, p.windowHeight).parent('sketch-container');

        // Accessibility
        canvas.elt.setAttribute('aria-label', 'Interactive vector field with a blooming flower that reacts to mouse movement.');
        canvas.elt.setAttribute('role', 'img');
        canvas.elt.innerHTML = 'Your browser does not support the HTML5 canvas tag.';

        p.pixelDensity(CONFIG.canvas.pixelDensity);
        p.stroke(CONFIG.canvas.strokeColor);
        p.noFill();

        // Load video
        flowerVideo = p.createVideo(FLOWER_VIDEO_FILE);
        flowerVideo.hide(); // Hide the DOM element

        const { field: fieldConfig, flower: flowerConfig } = buildResponsiveConfigs(p);
        const baseSpacing = CONFIG.field.spacingRatio * 2560;
        const spacingRatio = fieldConfig.spacing / baseSpacing;
        p.strokeWeight(CONFIG.canvas.strokeWeight * spacingRatio);

        field = new VectorField(p, fieldConfig);
        bloomingFlower = new BloomingFlower(p, flowerConfig, flowerVideo, chromaShader);

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
        if (field && bloomingFlower) {
            field.updateAndDraw(p.mouseX, p.mouseY, bloomingFlower);
            bloomingFlower.draw();
        }
    };

    // -------------------------------------------------------------------------
    // EVENTS
    // -------------------------------------------------------------------------

    p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
        const { field: fieldConfig, flower: flowerConfig } = buildResponsiveConfigs(p);
        const baseSpacing = CONFIG.field.spacingRatio * 2560;
        const spacingRatio = fieldConfig.spacing / baseSpacing;
        p.strokeWeight(CONFIG.canvas.strokeWeight * spacingRatio);

        if (field) {
            field.applyResponsiveConfig(fieldConfig);
        }
        if (bloomingFlower) {
            bloomingFlower.applyResponsiveConfig(flowerConfig);
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
