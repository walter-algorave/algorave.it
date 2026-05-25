// Media renderers — registry of factories indexed by media `type`.
//
// FlowerPreview consults MEDIA_RENDERERS for every media descriptor in a
// preview's config. Adding a new type (youtube, maps, …) means dropping a new
// factory here and listing it in the registry below — no edits required in
// FlowerPreview, VectorField, or PreviewManager.
//
// Renderer contract — every factory must return an object with:
//   type:                    string                         // mirrors the descriptor type
//   getBounds():             { left, right, top, bottom }   // tight tile rect, feeds the unified repulsor
//   update(mouseVec):        void                           // per-frame integration
//   drawBackgroundLayer():   void                           // drawn under the flowers
//   drawForegroundLayer():   void                           // drawn above the flowers (optional)
//   requestFadeOut():        void                           // begin fade-out before unmount
//   isFullyHidden():         boolean                        // true once fade-out has completed
//   alpha (getter):          number                         // 0..1, drives FlowerPreview mount/close state
//   applyPhysicsConfig(cfg): void                           // live-update physics on resize
//   setPosition(x, y):       void                           // relayout on window resize
//   setSize(w, h):           void                           // relayout on window resize
//
// getBounds() must return the *layout tile* rect, not the rendered visual
// extent — keeps the unified repulsion bbox predictable regardless of media type.
// ─────────────────────────────────────────────────────────────────────────────

import { FloatingImage } from "./FloatingImage.js";

// ── IMAGE RENDERER ────────────────────────────────────────────────────────

function makeImageRenderer({
  p,
  descriptor,
  position,
  size,
  physics,
  appearDelay,
  imageCache,
}) {
  const url = descriptor?.src;
  const hasCached = url && imageCache.has(url);
  const cached = hasCached ? imageCache.get(url) : null;

  const fi = new FloatingImage({
    p,
    image: cached || null,
    baseX: position.x,
    baseY: position.y,
    size: size.w,
    maxHeight: size.h,
    rotationDeg: 0,
    appearDelay,
    stiffness: physics?.stiffness,
    damping: physics?.damping,
    maxSpeed: physics?.maxSpeed,
    repulsionRadius: physics?.repulsionRadius,
    repulsionStrength: physics?.repulsionStrength,
    repulsionVelocityScale: physics?.repulsionVelocityScale,
    fadeInDurationMs: physics?.fadeInDurationMs,
    fadeOutLerpRate: physics?.fadeOutLerpRate,
  });

  if (url && !hasCached) {
    p.loadImage(
      url,
      (img) => {
        imageCache.set(url, img);
        fi.setImage(img);
      },
      () => {
        console.warn(`FloatingImage: failed to load "${url}"`);
        // cache the failure so the preview doesn't refetch on every open
        imageCache.set(url, null);
      },
    );
  }

  // width = FloatingImage.size scalar; height = layout slot. Tracking the slot
  // (not the loaded image's extent) keeps the repulsion bbox matched to the
  // allocated tile even when the image's aspect ratio differs.
  let tileW = size.w;
  let tileH = size.h;

  return {
    type: "image",
    getBounds() {
      const halfW = tileW / 2;
      const halfH = tileH / 2;
      return {
        left: fi.base.x - halfW,
        right: fi.base.x + halfW,
        top: fi.base.y - halfH,
        bottom: fi.base.y + halfH,
      };
    },
    update(mouseVec) {
      fi.update(mouseVec);
    },
    drawBackgroundLayer() {
      fi.draw();
    },
    drawForegroundLayer() {},
    requestFadeOut() {
      fi.requestFadeOut();
    },
    isFullyHidden() {
      return fi.isFullyHidden();
    },
    get alpha() {
      return fi.alpha;
    },
    applyPhysicsConfig(cfg) {
      if (!cfg) return;
      fi.stiffness = cfg.stiffness;
      fi.damping = cfg.damping;
      fi.maxSpeed = cfg.maxSpeed;
      fi.repulsionRadius = cfg.repulsionRadius;
      fi.repulsionStrength = cfg.repulsionStrength;
      if (cfg.repulsionVelocityScale != null)
        fi.repulsionVelocityScale = cfg.repulsionVelocityScale;
      if (cfg.fadeInDurationMs != null)
        fi.fadeInDurationMs = cfg.fadeInDurationMs;
      if (cfg.fadeOutLerpRate != null) fi.fadeOutLerpRate = cfg.fadeOutLerpRate;
    },
    setPosition(x, y) {
      // hard snap base + pos + vel — leaving any gap makes the maxSpeed cap
      // visible as a slow chase after a resize
      fi.base.set(x, y);
      fi.pos.set(x, y);
      fi.vel.set(0, 0);
    },
    setSize(w, h) {
      tileW = w;
      tileH = h;
      fi.size = w;
      fi.maxHeight = h;
    },
  };
}

// ── REGISTRY ──────────────────────────────────────────────────────────────
// Extend by adding entries. Unknown types are filtered out by
// FlowerPreview._normalizeConfig with a console.warn (no crash).

export const MEDIA_RENDERERS = {
  image: makeImageRenderer,
};

export function hasRenderer(type) {
  return Object.prototype.hasOwnProperty.call(MEDIA_RENDERERS, type);
}
