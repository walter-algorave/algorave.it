import { FlowerPreview } from "./FlowerPreview.js";

export class PreviewManager {
  // ── CONSTRUCTOR ───────────────────────────────────────────────────────────

  constructor(p, flowers, previewConfig, options = {}) {
    this.p = p;
    this.flowers = flowers;
    // refreshed by applyResponsiveConfig on resize
    this.previewConfig = previewConfig ?? null;

    // shared URL → p5.Image cache; prevents re-decoding on repeated opens
    this.imageCache = new Map();

    const physics = this.previewConfig?.floatingImage;
    const repulsion = this.previewConfig?.repulsion;
    const layout = this.previewConfig?.layout;
    const textFade = this.previewConfig?.textFade;
    const textCursorReact = this.previewConfig?.textCursorReact;

    // one FlowerPreview per flower that opted in via `preview` config
    this.previews = new Map();
    flowers.forEach((flower, idx) => {
      if (flower.hasPreview()) {
        this.previews.set(
          idx,
          new FlowerPreview(
            this.p,
            flower.preview,
            this.imageCache,
            physics,
            repulsion,
            layout,
            textFade,
            textCursorReact,
          ),
        );
      }
    });

    // action flowers — owned here (separate from main flowers[]) so the global
    // lock loop never touches them; hidden (locked, activation=0) when no preview is active
    this.actionFlowers = options.actionFlowers ?? [];
    for (const af of this.actionFlowers) af.setLocked(true);

    // armed = spring peaked, waiting for close; fired = dispatched (prevents double-fire)
    this._actionState = new Map();
    for (const af of this.actionFlowers) {
      this._actionState.set(af, { armed: false, fired: false });
    }

    // snaps preview layout to grid centers so content lines up with arrow nodes
    this._field = options.field ?? null;
    this._snapFn = this._field
      ? (x, y) => this._field.getNearestGridCenter(x, y)
      : null;

    // indices
    this.activePreview = null;
    this.anchorIdx = -1; // flower the active preview belongs to
    this.pendingAnchorIdx = -1; // flower whose close-anim must finish before mount
    this.pressedFlowerIdx = -1;
    this.springFlowerIdx = -1; // flower in spring release, waiting to open preview
    this._actionPressedIdx = -1;
    this._actionSpringIdx = -1; // action flower awaiting spring peak

    // 0→1 as anchor closes, held at 1 while open, 1→0 while preview fades out;
    // drives global strength of preview repulsors so field morphs in sync
    this._closingProgress = 0;

    // reused each frame to avoid per-frame allocation
    this._mouseVec = { x: 0, y: 0 };

    // HTML <a> floats invisibly over the link action flower; native click
    // bypasses Safari's popup blocker for window.open
    this._linkOverlay = this._makeLinkAnchor();

    // Main flowers carrying a direct `link` (no preview) get their own
    // invisible <a>, shown over the flower while it's bloomed — same popup-safe
    // trick, but persistent (no preview wraps them).
    this._flowerLinkOverlays = new Map();
    this.flowers.forEach((flower, idx) => {
      if (
        typeof flower.hasLink === "function" &&
        flower.hasLink() &&
        !flower.hasPreview()
      ) {
        this._flowerLinkOverlays.set(idx, this._makeLinkAnchor(flower.link));
      }
    });
  }

  // Creates an invisible <a target="_blank"> over the canvas; a real pointer
  // click on it opens the URL natively, side-stepping popup blockers.
  _makeLinkAnchor(href = null) {
    const a = document.createElement("a");
    a.target = "_blank";
    a.rel = "noopener";
    if (href) a.href = href;
    a.style.position = "absolute";
    a.style.display = "none";
    a.style.cursor = "pointer";
    a.style.opacity = "0";
    a.style.zIndex = "100";
    a.style.webkitTapHighlightColor = "transparent";
    if (this.p.canvas && this.p.canvas.parentElement) {
      this.p.canvas.parentElement.appendChild(a);
    }
    return a;
  }

  // ── RESPONSIVE ────────────────────────────────────────────────────────────

  applyResponsiveConfig(previewConfig) {
    if (!previewConfig) return;
    this.previewConfig = previewConfig;
    const physics = previewConfig.floatingImage;
    const repulsion = previewConfig.repulsion;
    const layout = previewConfig.layout;
    const textFade = previewConfig.textFade;
    const textCursorReact = previewConfig.textCursorReact;
    for (const fp of this.previews.values()) {
      fp.applyPhysicsConfig(physics);
      fp.applyRepulsionConfig(repulsion);
      fp.applyLayoutConfig(layout);
      fp.applyTextFadeConfig(textFade);
      fp.applyTextCursorReactConfig(textCursorReact);
    }
    if (Array.isArray(previewConfig.actionFlowers)) {
      for (
        let i = 0;
        i < this.actionFlowers.length && i < previewConfig.actionFlowers.length;
        i++
      ) {
        this.actionFlowers[i].applyResponsiveConfig(
          previewConfig.actionFlowers[i],
        );
      }
    }
  }

  // ── POINTER ───────────────────────────────────────────────────────────────

  handlePointerDown(findFlowerUnderPointer) {
    // preview open → action flowers steal the pointer; clicks outside are swallowed
    if (this.activePreview && this.activePreview.isOpen()) {
      const aIdx = this._findActionFlowerUnderPointer();
      if (aIdx >= 0 && !this.actionFlowers[aIdx].isLocked()) {
        this._actionPressedIdx = aIdx;
        this.actionFlowers[aIdx].setPressed(true);
      }
      return;
    }

    // mid-transition (mounting / closing / anchor close-anim / spring) → swallow
    if (this.activePreview && this.activePreview.isActive()) return;
    if (this.pendingAnchorIdx >= 0) return;
    if (this.springFlowerIdx >= 0) return;

    const idx = findFlowerUnderPointer();
    if (
      idx >= 0 &&
      (this.flowers[idx].hasPreview() || this.flowers[idx].hasLink()) &&
      !this.flowers[idx].isLocked()
    ) {
      this.pressedFlowerIdx = idx;
      this.flowers[idx].setPressed(true);
    }
  }

  isHoveringActionFlower(mx, my) {
    if (!this.activePreview || !this.activePreview.isOpen()) return false;
    for (const af of this.actionFlowers) {
      if (af.isLocked()) continue;
      if (!af.isFullyBloomed) continue;
      if (this.p.dist(mx, my, af.center.x, af.center.y) < af.tapLockRadius)
        return true;
    }
    return false;
  }

  handlePointerRelease(eventType, pointerIsOverFlower) {
    // action flower release takes priority while preview is interactive
    if (this._actionPressedIdx >= 0) {
      const af = this.actionFlowers[this._actionPressedIdx];
      af.setPressed(false);
      const stillOver = this._pointerOverActionFlower(this._actionPressedIdx);
      if (eventType === "pointerup" && stillOver && af.isTappable()) {
        if (af.hasSpringEnabled()) {
          af.startSpringRelease();
          this._actionSpringIdx = this._actionPressedIdx;
        } else {
          this._triggerAction(this._actionPressedIdx);
        }
      }
      this._actionPressedIdx = -1;
      return;
    }

    if (this.pressedFlowerIdx < 0) return;

    const flower = this.flowers[this.pressedFlowerIdx];
    flower.setPressed(false);

    const stillOver = pointerIsOverFlower(flower);
    if (eventType === "pointerup" && stillOver && flower.isTappable()) {
      if (flower.hasSpringEnabled()) {
        flower.startSpringRelease();
        this.springFlowerIdx = this.pressedFlowerIdx;
      } else if (flower.hasPreview()) {
        this._openPreview(this.pressedFlowerIdx);
      }
      // link-only flower with spring disabled: the <a> overlay opens the URL
    } else if (!stillOver && flower.activation > 0.05) {
      // released outside: play the lock-close anyway so the flower never pops
      // off via fast proximity-exit; self-unlocks once fully closed
      flower.cancelTap();
    }
    this.pressedFlowerIdx = -1;
  }

  // ── EXTERNAL CONTROLS ─────────────────────────────────────────────────────

  // actual unlock + state cleanup happens in update() once fade-out completes,
  // so the close animation runs to its end
  closeActive() {
    if (!this.activePreview) return;
    this.activePreview.unmount();
    this._deactivateActionFlowers();
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────

  update(mouseX, mouseY) {
    this._mouseVec.x = mouseX;
    this._mouseVec.y = mouseY;

    // spring peaks first — the resulting state must be visible to the rest of
    // this same update pass (closingProgress, prepareLayout, repulsion)
    if (
      this.springFlowerIdx >= 0 &&
      this.flowers[this.springFlowerIdx].isSpringPeakDone()
    ) {
      const idx = this.springFlowerIdx;
      this.springFlowerIdx = -1;
      // link-only flowers: the <a> overlay already opened the URL on click
      if (this.flowers[idx].hasPreview()) this._openPreview(idx);
    }
    if (
      this._actionSpringIdx >= 0 &&
      this.actionFlowers[this._actionSpringIdx].isSpringPeakDone()
    ) {
      const idx = this._actionSpringIdx;
      this._actionSpringIdx = -1;
      const af = this.actionFlowers[idx];
      
      if (af.action?.persistent) {
        // Persistent action: fire at peak, let spring decay naturally.
        // Flower stays unlocked and re-clickable.
        this._triggerAction(idx);
      } else {
        // Consumable action: lock → reverse-bloom → fire at triggerTime.
        af.setLocked(true);
        const st = this._actionState.get(af);
        st.armed = true;
        // triggerTime 'peak': fire NOW so preview fade-out and button close
        // overlap as one continuous motion (same pattern as anchor flower on open).
        // `fired` flag prevents the armed+isFullyClosed path below from double-firing.
        if (af.action?.triggerTime === "peak") {
          st.fired = true;
          this._triggerAction(idx);
        }
      }
    }

    this._updateClosingProgress();

    if (this.activePreview) {
      this.activePreview.update(this._mouseVec, this._closingProgress);
    }

    // armed action flower fully closed → run its action (once)
    for (let i = 0; i < this.actionFlowers.length; i++) {
      const af = this.actionFlowers[i];
      const st = this._actionState.get(af);
      if (st.armed && !st.fired && af.isFullyClosed()) {
        st.fired = true;
        this._triggerAction(i);
      }
    }

    if (
      this.pendingAnchorIdx >= 0 &&
      this.flowers[this.pendingAnchorIdx].isFullyClosed()
    ) {
      this.pendingAnchorIdx = -1;
    }

    // preview fully faded out → release global lock + reset state
    if (this.activePreview && this.activePreview.isFullyHidden()) {
      this._unlockAll();
      this._resetActionFlowers();
      this.activePreview = null;
      this.anchorIdx = -1;
      this.pendingAnchorIdx = -1;
    }
  }

  _updateClosingProgress() {
    if (this.pendingAnchorIdx >= 0) {
      // ramp up here (not jump to 1) so the anchor-hole → preview-rect swap
      // cross-fades — otherwise arrows get a one-frame velocity kick
      const rate = this.previewConfig.openingLerpRate;
      this._closingProgress = this.p.lerp(this._closingProgress, 1, rate);
      if (this._closingProgress > 1 - 1e-3) this._closingProgress = 1;
      return;
    }
    if (this.activePreview && this.activePreview.isOpen()) {
      this._closingProgress = 1;
      return;
    }
    if (this.activePreview && !this.activePreview.isOpen()) {
      // CLOSING: lerp the global gate back to 0 fast so the field collapses
      // snappily right after release
      const rate = this.previewConfig.closingLerpRate;
      this._closingProgress = this.p.lerp(this._closingProgress, 0, rate);
      if (this._closingProgress < 1e-3) this._closingProgress = 0;
      return;
    }
    this._closingProgress = 0;
  }

  // ── DRAW ──────────────────────────────────────────────────────────────────

  drawBackgroundLayer() {
    if (this.activePreview) this.activePreview.drawBackgroundLayer();
  }

  drawForegroundLayer() {
    if (this.activePreview) this.activePreview.drawForegroundLayer();
  }

  // action flowers sit between preview images (bg) and preview text (fg) —
  // same Z-order as a normal flower row.
  // idle forced true so they wink immediately on emergence (the global interaction
  // timeout never elapses during an open preview — main flowers are all locked)
  updateAndDrawActionFlowers(now) {
    if (!this.actionFlowers.length) return;
    const active = this.activePreview != null || this.pendingAnchorIdx >= 0;
    // A preview without a content button never shows the link action flower at
    // all — never updated, never drawn. Defensive: also kept locked in
    // _activateActionFlowers, so this guarantees nothing renders on the rose.
    const showLink = !!this.activePreview?.config?.hasLinkButton;

    let linkFlower = null;
    for (const af of this.actionFlowers) {
      const isLink = af.action?.type === "link";
      if (isLink) linkFlower = af;
      if (active && !(isLink && !showLink)) {
        af.updateIdle(now, true);
        af.draw();
      }
    }

    if (
      linkFlower &&
      !linkFlower.isLocked() &&
      linkFlower.isFullyBloomed &&
      this.activePreview?.config?.link
    ) {
      const d = linkFlower.tapLockRadius * 2;
      this._linkOverlay.style.left =
        linkFlower.center.x - linkFlower.tapLockRadius + "px";
      this._linkOverlay.style.top =
        linkFlower.center.y - linkFlower.tapLockRadius + "px";
      this._linkOverlay.style.width = d + "px";
      this._linkOverlay.style.height = d + "px";
      this._linkOverlay.href = this.activePreview.config.link;
      this._linkOverlay.style.display = "block";
    } else {
      this._linkOverlay.style.display = "none";
    }
  }

  // Direct-link main flowers: keep an invisible <a> parked over each one while
  // it's bloomed (and no preview is in flight), so a real click opens its URL.
  updateMainLinkOverlays() {
    if (!this._flowerLinkOverlays.size) return;
    const previewBusy =
      this.activePreview != null || this.pendingAnchorIdx >= 0;
    for (const [idx, a] of this._flowerLinkOverlays) {
      const flower = this.flowers[idx];
      if (!previewBusy && flower.isFullyBloomed) {
        const d = flower.tapLockRadius * 2;
        a.style.left = flower.center.x - flower.tapLockRadius + "px";
        a.style.top = flower.center.y - flower.tapLockRadius + "px";
        a.style.width = d + "px";
        a.style.height = d + "px";
        a.style.display = "block";
      } else {
        a.style.display = "none";
      }
    }
  }

  // ── PUBLIC API ────────────────────────────────────────────────────────────

  relayout() {
    if (this.activePreview) this.activePreview.relayout();
  }

  isOpen() {
    return this.activePreview !== null && this.activePreview.isOpen();
  }

  // action flowers safe to include: locked + activation=0 emits no hole
  getRepulsionProviders() {
    const out = [];
    if (this.activePreview) out.push(this.activePreview);
    if (this.pendingAnchorIdx >= 0) {
      const pending = this.previews.get(this.pendingAnchorIdx);
      if (pending && pending !== this.activePreview) out.push(pending);
    }
    if (this.activePreview || this.pendingAnchorIdx >= 0) {
      for (const af of this.actionFlowers) out.push(af);
    }
    return out;
  }

  // ── INTERNAL ──────────────────────────────────────────────────────────────

  _openPreview(idx) {
    if (this.activePreview) this.closeActive();
    // anchor plays its reverse-bloom; others kept inert (no proximity bloom,
    // no idle wink) so the preview owns the whole stage
    this._lockAll();
    this.pendingAnchorIdx = idx;

    // mount immediately so fade-in runs parallel to the anchor close-anim
    this.activePreview = this.previews.get(idx) ?? null;
    this.anchorIdx = idx;
    if (this.activePreview) {
      this.activePreview.mount(this._snapFn);
      this._activateActionFlowers();
    }
  }

  _lockAll() {
    for (const flower of this.flowers) flower.setLocked(true);
  }

  _unlockAll() {
    for (const flower of this.flowers) {
      flower.setLocked(false);
    }
  }

  // nextWinkTime = 0 forces an immediate first wink so action flowers visibly
  // emerge instead of sitting at alpha 0 until the cursor wanders close
  _activateActionFlowers() {
    // A preview without a content button keeps the link action flower locked
    // (locked + activation 0 → never drawn, emits no hole). The close/back
    // button is always activated.
    const showLink = !!this.activePreview?.config?.hasLinkButton;
    for (const af of this.actionFlowers) {
      if (af.action?.type === "link" && !showLink) {
        af.setLocked(true);
        continue;
      }
      af.setLocked(false);
      // Wipe transient state from the previous cycle. magnetism in particular
      // decays slowly while locked, then freezes when the flower drops out of
      // providers between previews — without this reset the residual would
      // emit a stale snapCenter on the next open and tug the field's rotation
      // target toward the action flower's position.
      af.magnetism = 0;
      af.activation = 0;
      af.fieldActivation = 0;
      const st = this._actionState.get(af);
      st.armed = false;
      st.fired = false;
      af.nextWinkTime = 0;
    }
  }

  // reverse-bloom on every action flower in sync with the preview fade
  _deactivateActionFlowers() {
    for (const af of this.actionFlowers) af.setLocked(true);
  }

  _resetActionFlowers() {
    for (const af of this.actionFlowers) {
      const st = this._actionState.get(af);
      st.armed = false;
      st.fired = false;
    }
    this._actionPressedIdx = -1;
    this._actionSpringIdx = -1;
    this._linkOverlay.style.display = "none";
  }

  _pointerOverActionFlower(idx) {
    const af = this.actionFlowers[idx];
    if (!af) return false;
    return (
      this.p.dist(this.p.mouseX, this.p.mouseY, af.center.x, af.center.y) <
      af.tapLockRadius
    );
  }

  _findActionFlowerUnderPointer() {
    for (let i = 0; i < this.actionFlowers.length; i++) {
      if (this._pointerOverActionFlower(i)) return i;
    }
    return -1;
  }

  // extending with new types ('share', 'save', ...) = one case here + an entry
  // in CONFIG.preview.actionFlowers
  _triggerAction(idx) {
    const af = this.actionFlowers[idx];
    const type = af?.action?.type;
    switch (type) {
      case "close":
        this.closeActive();
        break;
      case "link":
        // no-op: the HTML overlay <a> handles the new tab natively
        break;
      default:
        // unknown type → close so the preview never gets stuck
        this.closeActive();
        break;
    }
  }
}
