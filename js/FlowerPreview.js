// Per-flower overlay shown after a click. Owned and driven by PreviewManager.
//
// Lifecycle: idle → mounting → open → closing → idle.
// Draw is split across two layers so it slots between the existing ones:
// field arrows → drawBackgroundLayer (media) → flowers → drawForegroundLayer (text).

import { MEDIA_RENDERERS, hasRenderer } from "./mediaRenderers.js";
import { drawStyledText } from "./textUtils.js";
import { LetterField } from "./LetterField.js";

const STATE_IDLE = "idle";
const STATE_MOUNTING = "mounting";
const STATE_OPEN = "open";
const STATE_CLOSING = "closing";

// Single source of truth for weights — text measurement (for repulsor
// sizing) must match the actual rendering in drawForegroundLayer.
const TEXT_STYLE = {
  title: { weight: 700, fillFactor: 1.0 },
  subtitle: { weight: 500, fillFactor: 0.92 },
  body: { weight: 400, fillFactor: 0.85 },
};

export class FlowerPreview {
  constructor(
    p,
    previewConfig,
    imageCache,
    physicsConfig,
    repulsionConfig,
    layoutConfig,
    textFadeConfig,
    textCursorReactConfig,
  ) {
    this.p = p;
    this.config = this._normalizeConfig(previewConfig);

    // Shared URL → p5.Image cache owned by PreviewManager — de-duplicates
    // loads across opens of every preview.
    this.imageCache = imageCache;

    // Resolved by buildResponsivePreviewConfig and re-pushed by
    // PreviewManager on resize via the apply*Config setters below.
    this.physicsConfig = physicsConfig ?? null;
    this.repulsionConfig = repulsionConfig ?? null;
    this.layoutConfig = layoutConfig ?? null;
    this.textFadeConfig = textFadeConfig ?? null;
    this.textCursorReactConfig = textCursorReactConfig ?? null;

    this.state = STATE_IDLE;

    this.renderers = [];
    this.textAlpha = 0; // 0..1 — lerps for foreground text fade
    this._lastLayout = null;

    // Per-line { title?, subtitle?, body? } LetterField — built lazily once
    // the layout is known. Cleared when the preview returns to idle so the
    // next open re-measures against the (possibly resized) layout.
    this._letterFields = {};

    // Grid snap function injected by PreviewManager via prepareLayout/mount.
    this._snapFn = null;

    // Drives the repulsion fade-in: 0 → 1 while the anchor flower closes,
    // 1 → 0 again while this preview itself is closing.
    this._closingProgress = 0;

    // Rebuilt whenever the layout changes (mount / relayout / prepareLayout).
    this._repulsors = [];
  }

  // ── RESPONSIVE ────────────────────────────────────────────────────────────

  // Push physics tunables down to every live media renderer. Mount reads
  // physicsConfig directly, so freshly created renderers pick it up too.
  applyPhysicsConfig(physics) {
    if (!physics) return;
    this.physicsConfig = physics;
    for (const r of this.renderers) r.applyPhysicsConfig(physics);
  }

  applyRepulsionConfig(rc) {
    this.repulsionConfig = rc ?? null;
    this._rebuildRepulsors();
  }

  applyLayoutConfig(layout) {
    if (!layout) return;
    this.layoutConfig = layout;
    // invalidate cache → recompute on next prepareLayout / relayout
    this._lastLayout = null;
  }

  applyTextFadeConfig(textFade) {
    if (!textFade) return;
    this.textFadeConfig = textFade;
  }

  // null disables the per-letter reaction (drawStyledText fallback). Wipe
  // the cache so the next layout rebuilds against the new appliesTo list /
  // physics — and old fields don't leak into a now-disabled draw.
  applyTextCursorReactConfig(textCursorReact) {
    this.textCursorReactConfig = textCursorReact ?? null;
    this._letterFields = {};
  }

  // ── CONFIG ────────────────────────────────────────────────────────────────

  // Accepts the new `media: [{type, ...}]` schema and the legacy
  // `images: [url, ...]` shape. Descriptors whose `type` is not in
  // MEDIA_RENDERERS are dropped here (with a warn) so layout and mount
  // never have to branch on unknown types.
  _normalizeConfig(cfg) {
    if (!cfg)
      return { title: "", subtitle: "", body: "", link: null, media: [] };
    let media = Array.isArray(cfg.media) ? cfg.media.slice() : [];
    if (!media.length && Array.isArray(cfg.images)) {
      media = cfg.images.map((src) => ({ type: "image", src }));
    }
    const filtered = [];
    for (const m of media) {
      if (!m) continue;
      if (hasRenderer(m.type)) {
        filtered.push(m);
      } else {
        console.warn(
          `FlowerPreview: skipping media of unknown type "${m?.type}"`,
        );
      }
    }
    return {
      title: cfg.title || "",
      subtitle: cfg.subtitle || "",
      body: cfg.body || "",
      link: cfg.link || null,
      // "row" = uniform horizontal row (default); "feature-left" = one large tile
      // on the left + two stacked on the right. Consumed by _computeMediaTiles.
      mediaLayout: cfg.mediaLayout || "row",
      // Whether the ↗ content button is shown for this preview. Defaults to "link
      // present" so existing previews are unchanged; set linkButton:true to show
      // the button before the URL exists, or omit both to hide it entirely.
      hasLinkButton: cfg.linkButton ?? cfg.link != null,
      media: filtered,
    };
  }

  // ── STATE ─────────────────────────────────────────────────────────────────

  isActive() {
    return this.state !== STATE_IDLE;
  }
  isOpen() {
    return this.state === STATE_OPEN || this.state === STATE_MOUNTING;
  }
  isFullyHidden() {
    return this.state === STATE_IDLE;
  }

  // ── LAYOUT ────────────────────────────────────────────────────────────────

  // Pure function of config + canvas size + snapFn. Cached in _lastLayout
  // so draw/repulsors don't pay the cost every frame.
  _layout(snapFn) {
    const p = this.p;
    const cx = p.width / 2;
    const cy = p.height / 2;
    const shortSide = Math.min(p.width, p.height);

    // _normalizeConfig has already dropped unknown types — every entry
    // here is renderable by some MEDIA_RENDERERS factory.
    const mediaCount = this.config.media.length;

    // All dimensions as fractions of shortSide — single tuning surface in
    // CONFIG.preview.layout, automatic responsiveness on resize.
    const lc = this.layoutConfig;
    const L = {
      pad: shortSide * lc.padRatio,
      tileW: shortSide * lc.tileWRatio,
      tileH: shortSide * lc.tileHRatio,
      tileGap: shortSide * lc.tileGapRatio,
      titleSize: shortSide * lc.titleSizeRatio,
      subtitleSize: shortSide * lc.subtitleSizeRatio,
      bodySize: shortSide * lc.bodySizeRatio,
      textGap: shortSide * lc.textGapRatio,
      mediaTextGap: shortSide * lc.mediaTextGapRatio,
    };

    const hasTitle = !!this.config.title;
    const hasSubtitle = !!this.config.subtitle;
    const hasBody = !!this.config.body;
    const hasMedia = mediaCount > 0;

    // Media geometry: total block size + per-tile offsets from the block center.
    // "row" preserves the original uniform row; "feature-left" is asymmetric.
    const mediaBlock = hasMedia
      ? this._computeMediaTiles(L, mediaCount, this.config.mediaLayout)
      : { width: 0, height: 0, tiles: [] };
    const containerW =
      Math.max(mediaBlock.width, shortSide * lc.containerMinWRatio) + 2 * L.pad;

    const mediaSectionH = mediaBlock.height;
    const textBlockH =
      (hasTitle ? L.titleSize : 0) +
      (hasSubtitle ? (hasTitle ? L.textGap : 0) + L.subtitleSize : 0) +
      (hasBody ? (hasTitle || hasSubtitle ? L.textGap : 0) + L.bodySize : 0);

    // Center the actual content bbox on (cx, cy) rather than the padded
    // container — asymmetric padding around an empty text block would
    // otherwise shift the media block off the geometric center.
    const mediaTextGap = hasMedia && textBlockH > 0 ? L.mediaTextGap : 0;
    const contentH = mediaSectionH + mediaTextGap + textBlockH;

    const containerH =
      L.pad +
      (hasMedia ? mediaSectionH + L.pad : 0) +
      (textBlockH > 0 ? textBlockH + L.pad : 0);

    let containerL = cx - containerW / 2;
    let containerT = cy - containerH / 2;

    const contentTop = cy - contentH / 2;
    // Block centered horizontally on cx; its vertical center sits half a block
    // height below the content top. Each tile carries its own w/h.
    const blockCenterY = contentTop + mediaBlock.height / 2;
    const mediaPositions = mediaBlock.tiles.map((t) => ({
      x: cx + t.dx,
      y: blockCenterY + t.dy,
      w: t.w,
      h: t.h,
    }));

    const textTop = hasMedia
      ? contentTop + mediaSectionH + mediaTextGap
      : contentTop;
    let textCursor = textTop;
    const textPos = {};
    if (hasTitle) {
      textPos.title = {
        x: cx,
        y: textCursor + L.titleSize / 2,
        size: L.titleSize,
      };
      textCursor += L.titleSize + L.textGap;
    }
    if (hasSubtitle) {
      textPos.subtitle = {
        x: cx,
        y: textCursor + L.subtitleSize / 2,
        size: L.subtitleSize,
      };
      textCursor += L.subtitleSize + L.textGap;
    }
    if (hasBody) {
      textPos.body = {
        x: cx,
        y: textCursor + L.bodySize / 2,
        size: L.bodySize,
      };
    }

    // Snap the whole layout as a rigid block: snap the center once and
    // apply the same delta to everything. Per-element snapping would
    // break internal alignment and produce asymmetric repulsion patterns.
    if (snapFn) {
      const snappedCenter = snapFn(cx, cy);
      const dx = snappedCenter.x - cx;
      const dy = snappedCenter.y - cy;

      for (const pos of mediaPositions) {
        pos.x += dx;
        pos.y += dy;
      }
      for (const key of Object.keys(textPos)) {
        const t = textPos[key];
        t.x += dx;
        t.y += dy;
      }
      containerL += dx;
      containerT += dy;
    }

    // Measure text widths for rect repulsor sizing. Heights collapse to
    // font size — ascent+descent variation is sub-pixel here.
    const textBounds = {};
    const measure = (text, size, weight) => {
      p.drawingContext.save();
      p.drawingContext.font = `${weight} ${size}px "Nunito", system-ui, sans-serif`;
      const w = p.drawingContext.measureText(text).width;
      p.drawingContext.restore();
      return { w, h: size };
    };
    if (textPos.title)
      textBounds.title = measure(
        this.config.title,
        textPos.title.size,
        TEXT_STYLE.title.weight,
      );
    if (textPos.subtitle)
      textBounds.subtitle = measure(
        this.config.subtitle,
        textPos.subtitle.size,
        TEXT_STYLE.subtitle.weight,
      );
    if (textPos.body)
      textBounds.body = measure(
        this.config.body,
        textPos.body.size,
        TEXT_STYLE.body.weight,
      );

    return {
      mediaPositions,
      textPos,
      textBounds,

      // Kept for layout debugging only — the actual repulsor is computed from
      // the tight bbox of each tile's w/h + textBounds per line.
      containerBounds: {
        left: containerL,
        top: containerT,
        width: containerW,
        height: containerH,
      },
    };
  }

  // Media block geometry: total { width, height } plus a { dx, dy, w, h } per
  // tile, where dx/dy are offsets from the block center. Keeps _layout agnostic
  // to the arrangement — text flow and repulsor bbox only need width/height and
  // per-tile rects.
  //
  // "row"          → uniform horizontal row (original behaviour).
  // "feature-left" → one large tile on the left, two stacked on the right.
  //                  Requires exactly 3 media; any other count (or a missing
  //                  featureLayout config) falls back to "row".
  _computeMediaTiles(L, mediaCount, mediaLayout) {
    const shortSide = Math.min(this.p.width, this.p.height);
    const fl = this.layoutConfig.featureLayout;

    if (mediaLayout === "feature-left" && mediaCount === 3 && fl) {
      const width = shortSide * fl.blockWRatio;
      const height = shortSide * fl.blockHRatio;
      const gap = shortSide * fl.innerGapRatio;
      const leftW = width * fl.leftFraction;
      const rightW = width - leftW - gap;
      const rightH = (height - gap) / 2;
      const leftDx = -width / 2 + leftW / 2;
      const rightDx = -width / 2 + leftW + gap + rightW / 2;
      const rightDy = rightH / 2 + gap / 2;
      return {
        width,
        height,
        // media[0] = large left, media[1] = top right, media[2] = bottom right
        tiles: [
          { dx: leftDx, dy: 0, w: leftW, h: height },
          { dx: rightDx, dy: -rightDy, w: rightW, h: rightH },
          { dx: rightDx, dy: rightDy, w: rightW, h: rightH },
        ],
      };
    }

    // Default: uniform horizontal row of tileW × tileH tiles.
    const width = mediaCount * L.tileW + (mediaCount - 1) * L.tileGap;
    const tiles = [];
    for (let i = 0; i < mediaCount; i++) {
      tiles.push({
        dx: -width / 2 + L.tileW / 2 + i * (L.tileW + L.tileGap),
        dy: 0,
        w: L.tileW,
        h: L.tileH,
      });
    }
    return { width, height: L.tileH, tiles };
  }

  // Idempotently builds the layout + repulsors before any image has
  // loaded. PreviewManager calls this every frame while the anchor flower
  // is closing so the field can start morphing before mount.
  prepareLayout(snapFn, closingProgress) {
    if (snapFn) this._snapFn = snapFn;
    if (typeof closingProgress === "number")
      this._closingProgress = closingProgress;
    if (!this._lastLayout) {
      this._lastLayout = this._layout(this._snapFn);
      this._rebuildRepulsors();
      this._syncLetterFields();
    }
  }

  // ── LETTER FIELDS ─────────────────────────────────────────────────────────

  // Rebuild or relocate one LetterField per enabled text line. Reuses an
  // existing field via relocate() when text + size match (resize/relayout),
  // so the spring state survives a window resize.
  _syncLetterFields() {
    const cfg = this.textCursorReactConfig;
    const layout = this._lastLayout;
    if (!cfg || !cfg.enabled || !layout) {
      this._letterFields = {};
      return;
    }
    const allow = new Set(cfg.appliesTo || []);
    const next = {};
    for (const key of ["title", "subtitle", "body"]) {
      if (!allow.has(key)) continue;
      const t = layout.textPos[key];
      const text = this.config[key];
      if (!t || !text) continue;
      const weight = TEXT_STYLE[key].weight;
      const existing = this._letterFields[key];
      if (
        existing &&
        existing.text === text &&
        existing.size === t.size &&
        existing.weight === weight
      ) {
        existing.applyPhysicsConfig(cfg);
        existing.relocate(t.x, t.y);
        next[key] = existing;
      } else {
        next[key] = new LetterField({
          p: this.p,
          text,
          baseX: t.x,
          baseY: t.y,
          size: t.size,
          weight,
          physics: cfg,
        });
      }
    }
    this._letterFields = next;
  }

  // ── LIFECYCLE ─────────────────────────────────────────────────────────────

  mount(snapFn) {
    if (this.state !== STATE_IDLE) return;
    if (snapFn) this._snapFn = snapFn;

    // Reuse the layout already built during pendingAnchor, if any.
    const layout = this._lastLayout || this._layout(this._snapFn);

    const physics = this.physicsConfig || null;
    this.renderers = [];
    for (let i = 0; i < this.config.media.length; i++) {
      const descriptor = this.config.media[i];
      const pos = layout.mediaPositions[i];
      if (!pos) continue;
      const factory = MEDIA_RENDERERS[descriptor.type];
      // _normalizeConfig should have filtered this — stay defensive.
      if (!factory) continue;
      this.renderers.push(
        factory({
          p: this.p,
          descriptor,
          position: pos,
          size: { w: pos.w, h: pos.h },
          physics,
          appearDelay: 0,
          imageCache: this.imageCache,
        }),
      );
    }

    this._lastLayout = layout;
    this._rebuildRepulsors();
    this._syncLetterFields();
    this.state = STATE_MOUNTING;
  }

  unmount() {
    if (this.state === STATE_IDLE || this.state === STATE_CLOSING) return;
    for (const r of this.renderers) r.requestFadeOut();
    this.state = STATE_CLOSING;
  }

  // Called on window resize: recompute layout and reposition live renderers.
  relayout() {
    if (this.state === STATE_IDLE && !this._lastLayout) return;
    const layout = this._layout(this._snapFn);
    for (
      let i = 0;
      i < this.renderers.length && i < layout.mediaPositions.length;
      i++
    ) {
      const pos = layout.mediaPositions[i];
      this.renderers[i].setPosition(pos.x, pos.y);
      this.renderers[i].setSize(pos.w, pos.h);
    }
    this._lastLayout = layout;
    this._rebuildRepulsors();
    this._syncLetterFields();
  }

  // ── REPULSORS ─────────────────────────────────────────────────────────────

  // Build ONE rect repulsor = tight bounding box of every content block
  // currently in the layout. A single source of force makes inter-block
  // oscillation impossible by construction: the field around the bbox is
  // monotone outward, no two overlapping ellipses fighting in a gap.
  //
  // Bounds source: live renderers (via getBounds) when mounted, otherwise
  // mediaPositions (each with its own w/h) from the layout — covers the
  // pendingAnchor phase, where repulsion must start pushing before any renderer exists.
  _rebuildRepulsors() {
    const rc = this.repulsionConfig;
    const L = this._lastLayout;
    if (!rc || !L) {
      this._repulsors = [];
      return;
    }

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    let hasContent = false;

    const expand = (left, top, right, bottom) => {
      if (left < minX) minX = left;
      if (top < minY) minY = top;
      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;
      hasContent = true;
    };

    if (this.renderers.length > 0) {
      for (const renderer of this.renderers) {
        const bb = renderer.getBounds();
        if (!bb) continue;
        expand(bb.left, bb.top, bb.right, bb.bottom);
      }
    } else if (Array.isArray(L.mediaPositions)) {
      // Pre-mount path: prepareLayout called during pendingAnchor. Each tile
      // carries its own w/h (asymmetric layouts have no shared size).
      for (const pos of L.mediaPositions) {
        const halfW = pos.w / 2;
        const halfH = pos.h / 2;
        expand(pos.x - halfW, pos.y - halfH, pos.x + halfW, pos.y + halfH);
      }
    }

    for (const key of ["title", "subtitle", "body"]) {
      const tp = L.textPos?.[key];
      const tb = L.textBounds?.[key];
      if (!tp || !tb) continue;
      const halfW = tb.w / 2;
      const halfH = tb.h / 2;
      expand(tp.x - halfW, tp.y - halfH, tp.x + halfW, tp.y + halfH);
    }

    if (!hasContent) {
      this._repulsors = [];
      return;
    }

    this._repulsors = [
      {
        type: "rect",
        center: this.p.createVector((minX + maxX) / 2, (minY + maxY) / 2),
        width: maxX - minX,
        height: maxY - minY,
        clearPadding: rc.clearPadding,
        featherPadding: rc.featherPadding,
        cornerRadius: rc.cornerRadius ?? 0,
        strength: 1,
      },
    ];
  }

  // VectorField iterates revealTargets and calls computeHole on each.
  // FlowerPreview only emits rect repulsors via getExtraRepulsion (it's
  // not a flower), so the circular hole is always null.
  computeHole() {
    return null;
  }

  // Returns the rect descriptor gated by _closingProgress so the field
  // morphs smoothly across anchor-close → mount → open → close. Copies
  // before scaling — VectorField rebuilds repulsors every frame and may
  // reorder them; the cached descriptor must stay clean.
  getExtraRepulsion() {
    if (!this._repulsors.length) return null;
    const exp = this.repulsionConfig.fadeInExponent;
    const g = Math.pow(this.p.constrain(this._closingProgress, 0, 1), exp);
    if (g < 1e-3) return null;

    return this._repulsors.map((r) => ({
      ...r,
      strength: (r.strength ?? 1) * g,
    }));
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────

  update(mouseVec, closingProgress) {
    if (typeof closingProgress === "number")
      this._closingProgress = closingProgress;
    if (this.state === STATE_IDLE) return;

    for (const r of this.renderers) r.update(mouseVec);
    // Letters keep updating even while the text alpha is below threshold so
    // they're already settled at their bases when the fade-in starts.
    for (const key in this._letterFields) {
      this._letterFields[key].update(mouseVec);
    }

    if (this.state === STATE_MOUNTING) {
      const minAlpha = this.renderers.length
        ? this.renderers.reduce((m, r) => Math.min(m, r.alpha), 1)
        : 1;
      if (minAlpha > 0.7) this.state = STATE_OPEN;
    }

    const textTarget = this.state === STATE_CLOSING ? 0 : 1;
    const textLerpRate =
      this.state === STATE_CLOSING
        ? this.textFadeConfig.outLerpRate
        : this.textFadeConfig.inLerpRate;
    this.textAlpha = this.p.lerp(this.textAlpha, textTarget, textLerpRate);

    if (this.state === STATE_CLOSING) {
      const allHidden =
        this.renderers.length === 0 ||
        this.renderers.every((r) => r.isFullyHidden());
      if (allHidden && this.textAlpha < 0.02) {
        this.state = STATE_IDLE;
        this.renderers = [];
        this._lastLayout = null;
        this._repulsors = [];
        this._letterFields = {};
      }
    }
  }

  // ── DRAW ──────────────────────────────────────────────────────────────────

  drawBackgroundLayer() {
    if (this.state === STATE_IDLE) return;
    for (const r of this.renderers) r.drawBackgroundLayer();
  }

  drawForegroundLayer() {
    if (this.state === STATE_IDLE) return;

    // Renderer overlays (badges, controls) draw before the text so the
    // text always reads on top.
    for (const r of this.renderers) r.drawForegroundLayer();

    if (this.textAlpha <= 0.01) return;

    const p = this.p;
    const layout = this._lastLayout || this._layout(this._snapFn);
    const alphaT = 255 * this.textAlpha;

    p.push();
    p.textAlign(p.CENTER, p.CENTER);
    p.noStroke();

    const drawLine = (key, fill) => {
      const t = layout.textPos[key];
      if (!t) return;
      const alpha = alphaT * TEXT_STYLE[key].fillFactor;
      const field = this._letterFields[key];
      if (field) {
        field.draw({ fill, alpha });
      } else {
        drawStyledText(p, this.config[key], t.x, t.y, {
          weight: TEXT_STYLE[key].weight,
          size: t.size,
          fill,
          alpha,
        });
      }
    };
    drawLine("title", 20);
    drawLine("subtitle", 40);
    drawLine("body", 60);

    p.pop();
  }
}
