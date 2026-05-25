import { CONFIG, BASE_VIEWPORT, buildResponsiveConfigs } from "./config.js";
import { VectorField } from "./VectorField.js";
import { BloomingFlower } from "./BloomingFlower.js";
import { PreviewManager } from "./PreviewManager.js";

const sketch = (p) => {
  let field;
  let bloomingFlowers = [];
  let lastFlowerInteractionTime = 0;

  const loadedSprites = new Map();

  // Owns the click-to-preview flow: per-flower controllers, active preview,
  // press hand-off, image cache, and the global lock that keeps other flowers
  // inert while a preview is open. Built in setup() because it needs the
  // resolved bloomingFlowers + responsive previewConfig.
  let previewManager;

  // ── PRELOAD ─────────────────────────────────────────────────────────────

  p.preload = () => {
    // Set de-duplicates paths shared between main flowers and preview-scoped
    // action flowers — no double-load when an action reuses a main sprite.
    const uniqueSprites = new Set([
      ...CONFIG.flowers.map((f) => f.sprite),
      ...(CONFIG.preview.actionFlowers ?? []).map((af) => af.sprite),
    ]);

    uniqueSprites.forEach((path) => {
      if (path) {
        loadedSprites.set(path, p.loadImage(path));
      }
    });
  };

  // ── SETUP ───────────────────────────────────────────────────────────────

  p.setup = () => {
    const canvas = p
      .createCanvas(p.windowWidth, p.windowHeight)
      .parent("sketch-container");

    canvas.elt.setAttribute(
      "aria-label",
      "Interactive vector field with blooming flowers that react to mouse movement.",
    );
    canvas.elt.setAttribute("role", "img");
    canvas.elt.innerHTML =
      "Your browser does not support the HTML5 canvas tag.";

    p.pixelDensity(CONFIG.canvas.pixelDensity);
    p.stroke(CONFIG.canvas.strokeColor);
    p.noFill();

    const {
      field: fieldConfig,
      flowers: flowerConfigs,
      preview: previewConfig,
    } = buildResponsiveConfigs(p);

    field = new VectorField(p, fieldConfig);

    bloomingFlowers = flowerConfigs.map((config) => {
      const sprite = loadedSprites.get(config.sprite);
      return new BloomingFlower(p, config, sprite);
    });
    snapFlowersToGrid(bloomingFlowers, field);

    // Preview-scoped action flowers (close / link / future actions) reuse the
    // same BloomingFlower primitive — no subclass, no copy-paste. The
    // `action: { type }` field lets PreviewManager dispatch on click, and
    // setLocked(true) hides them until PreviewManager unlocks on mount.
    const actionFlowerSpriteSources = CONFIG.preview.actionFlowers ?? [];
    const actionFlowers = previewConfig.actionFlowers.map((cfg, i) => {
      const src = actionFlowerSpriteSources[i];
      const sprite = loadedSprites.get(src.sprite);
      const af = new BloomingFlower(
        p,
        { ...cfg, action: { type: src.type, triggerTime: src.triggerTime } },
        sprite,
      );
      af.setLocked(true);
      return af;
    });
    snapFlowersToGrid(actionFlowers, field);

    previewManager = new PreviewManager(p, bloomingFlowers, previewConfig, {
      actionFlowers,
      field,
    });

    applyStrokeWeight(p, fieldConfig);
    p.background(CONFIG.canvas.background);

    // Listen on the parent container, not the canvas itself: pointer events
    // bubbling from the HTML anchor overlay (Safari popup fix) still reach
    // the interaction logic to drive the spring animation.
    const el = canvas.elt.parentElement || canvas.elt;

    // Fallback preventDefault for older mobile browsers. Exception: skip for
    // anchor taps, otherwise mobile Safari swallows the click that opens the
    // link in a new tab.
    el.addEventListener(
      "touchstart",
      (e) => {
        if (
          e.target &&
          e.target.tagName &&
          e.target.tagName.toLowerCase() === "a"
        ) {
          return;
        }
        e.preventDefault();
      },
      { passive: false },
    );

    el.addEventListener("pointerdown", (e) => {
      handlePointerEnter();
      previewManager.handlePointerDown(findFlowerUnderPointer);
    });

    el.addEventListener("pointermove", () => {
      handlePointerEnter();
    });

    const handlePointerReleaseOrLeave = (e) => {
      previewManager.handlePointerRelease(e.type, pointerIsOverFlower);

      // Mouse 'up' doesn't mean the pointer left the canvas — stay active.
      if (e.pointerType === "mouse" && e.type === "pointerup") return;

      let isOverFlower = false;
      for (const flower of bloomingFlowers) {
        if (pointerIsOverFlower(flower)) {
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

    el.addEventListener("pointerup", handlePointerReleaseOrLeave);
    el.addEventListener("pointercancel", handlePointerReleaseOrLeave);
    el.addEventListener("pointerleave", handlePointerReleaseOrLeave);

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") previewManager.closeActive();
    });

    lastFlowerInteractionTime = p.millis();
  };

  // ── DRAW ────────────────────────────────────────────────────────────────

  p.draw = () => {
    p.background(CONFIG.canvas.background);

    // Update labels before field.updateAndDraw so _extraRepulsion is ready
    // for this frame. Uses previous frame's activation (one-frame lag —
    // imperceptible due to lerp smoothing).
    for (const flower of bloomingFlowers) {
      if (flower.label) flower.updateLabel(field);
    }

    // ORDER INVARIANT: previewManager.update() MUST run before
    // getRepulsionProviders() + field.updateAndDraw(). It resolves
    // spring-peak → pending-anchor → prepareLayout → closingProgress in
    // this frame; the field then consumes the freshly-built repulsors.
    // Swap the two and you get a one-frame lag (preview pushes against
    // stale closingProgress, field reads last-frame state).
    previewManager.update(p.mouseX, p.mouseY);

    // Repulsion providers = main flowers + (while a preview is in flight)
    // action flowers and the active/pending preview. PreviewManager returns
    // [] when idle, so the field behaves exactly as before in that path.
    const providers = bloomingFlowers.concat(
      previewManager.getRepulsionProviders(),
    );
    field.updateAndDraw(p.mouseX, p.mouseY, providers);

    // Preview background layer sits between field and flowers.
    previewManager.drawBackgroundLayer();

    const threshold = CONFIG.flower.idle.interactionThreshold;
    const idleTimeout = CONFIG.flower.idle.timeout;
    const now = p.millis();
    const isIdle = now - lastFlowerInteractionTime > idleTimeout;

    // Single pass: detect interaction, advance idle state, draw.
    for (const flower of bloomingFlowers) {
      if (flower.activation > threshold) {
        lastFlowerInteractionTime = now;
      }
      flower.updateIdle(now, isIdle);
      flower.draw();
      flower.drawLabel();
    }

    // Action flowers share the Z-row of normal flowers: above the preview
    // background images, below the preview text foreground.
    previewManager.updateAndDrawActionFlowers(now);

    previewManager.drawForegroundLayer();

    updatePointerCursor();
  };

  // ── EVENTS ──────────────────────────────────────────────────────────────

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    const {
      field: fieldConfig,
      flowers: flowerConfigs,
      preview: previewConfig,
    } = buildResponsiveConfigs(p);

    applyStrokeWeight(p, fieldConfig);
    field.applyResponsiveConfig(fieldConfig);

    for (let i = 0; i < bloomingFlowers.length; i++) {
      bloomingFlowers[i].applyResponsiveConfig(flowerConfigs[i]);
    }
    snapFlowersToGrid(bloomingFlowers, field);

    previewManager.applyResponsiveConfig(previewConfig);
    snapFlowersToGrid(previewManager.actionFlowers, field);
    previewManager.relayout();
  };

  // ── HELPERS ─────────────────────────────────────────────────────────────

  function handlePointerEnter() {
    if (field) field.setPointerInCanvas(true);
  }

  function handlePointerLeave() {
    if (field && (typeof p.touches === "undefined" || p.touches.length === 0)) {
      field.resetPointerState();
    }
  }

  // Returns the index of the flower under the current pointer, or -1.
  function findFlowerUnderPointer() {
    for (let i = 0; i < bloomingFlowers.length; i++) {
      if (pointerIsOverFlower(bloomingFlowers[i])) return i;
    }
    return -1;
  }

  function pointerIsOverFlower(flower) {
    return (
      p.dist(p.mouseX, p.mouseY, flower.center.x, flower.center.y) <
      flower.tapLockRadius
    );
  }

  // Canvas cursor → `pointer` only when the surface under the mouse is
  // actually clickable: bloom-gated main flowers when idle, or action
  // flowers while a preview is open. Cheap to call every frame.
  function updatePointerCursor() {
    const canvas = p.canvas;
    if (!canvas) return;
    let wantPointer = false;
    if (previewManager.isOpen()) {
      wantPointer = previewManager.isHoveringActionFlower(p.mouseX, p.mouseY);
    } else {
      for (const flower of bloomingFlowers) {
        if (
          flower.hasPreview() &&
          flower.isFullyBloomed &&
          pointerIsOverFlower(flower)
        ) {
          wantPointer = true;
          break;
        }
      }
    }
    const desired = wantPointer ? "pointer" : "default";
    if (canvas.style.cursor !== desired) canvas.style.cursor = desired;
  }

  // Snaps each flower's center onto the nearest grid cell. Run after setup
  // and after every resize so flowers always sit exactly on a grid node.
  function snapFlowersToGrid(flowers, field) {
    for (const flower of flowers) {
      const snapped = field.getNearestGridCenter(
        flower.center.x,
        flower.center.y,
      );
      flower.center.set(snapped.x, snapped.y);
    }
  }

  // Scales strokeWeight with the responsive arrow spacing so arrows stay
  // visually consistent across viewport sizes and density factors.
  function applyStrokeWeight(p, fieldConfig) {
    const baseSpacing = CONFIG.field.spacingRatio * BASE_VIEWPORT.width;
    const spacingRatio = fieldConfig.spacing / baseSpacing;
    p.strokeWeight(CONFIG.canvas.strokeWeight * spacingRatio);
  }
};

new p5(sketch);
