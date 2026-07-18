// eBay Σummer. Copyright (C) 2026 lvuCodes. Licensed under GPL-3.0-or-later; see LICENSE.md.
//
// Dispatcher. All the earlier modules load first (see manifest) and attach
// their API to ES; this file computes the page kind, runs every registered
// feature's hooks, keeps them running as the page mutates, and reacts to live
// settings changes. Feature-agnostic: the features (calculator, highlights,
// custom-view, notifications) plug in via registry.js's registerFeature, so
// nothing here names a feature. The heavy lifting lives in core/style.js
// (stylesheets + FOUC cache), core/settings.js (storage → config), and each
// feature's own run/clear hooks.
(function () {
  "use strict";
  const ES = globalThis.ES;
  const {
    config,
    isLiveOnlyChange,
    DEFAULTS,
    foucPageKind,
    injectCss,
    injectPageCss,
    clearInjected,
    applySettings,
    migrateLegacy,
    features,
  } = ES;

  // The page kind comes from early.js's foucPageKind (the ONE URL dispatch,
  // shared with the FOUC cache keys; early.js always runs first at
  // document_start). "other" = unrouted page: features still run (the
  // page-agnostic CSS overrides and markers apply everywhere), but the shared
  // widget CSS and the mutation observer stay off — nothing renders there.
  const kind = foucPageKind(location.pathname);
  const routed = kind !== "other";

  let observer;
  let resizing = false;

  function startObserving() {
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // One render pass. Disconnect the observer around it so our own DOM inserts
  // don't retrigger it; the feature run() hooks are idempotent, so re-runs only
  // add boxes/markers to newly-hydrated content. While a resize is in flight we
  // stay detached — the resize handler owns reconnection so we don't reattach
  // mid-drag.
  function run() {
    if (observer) observer.disconnect();
    // Master off: strip everything we inject (every feature's clear() + both
    // stylesheets + the FOUC cache) and stop — no rendering, no observing.
    // Re-enabling arrives via onChanged -> run().
    if (!config.enabled) {
      clearInjected();
      return;
    }
    if (routed) injectCss();
    injectPageCss(kind); // per-page layout + page-agnostic overrides — every page
    // Each feature self-gates on its own master/sub toggles and self-clears
    // when toggled off, so a flipped setting reverses live.
    features.forEach((f) => f.run && f.run(kind));
    if (routed && observer && !resizing) startObserving();
  }

  // Is this mutation confined to a live countdown timer? eBay reticks every
  // auction's "Xm Ys left" once a second; without this filter those ticks would
  // fire a full re-render every second (ongoing latency, and it compounds during
  // resize). Text-node targets are checked via their parent element.
  function inTimer(node) {
    const el = node && (node.nodeType === 1 ? node : node.parentElement);
    return !!(el && el.closest && el.closest(".timer-item, .container-item-col__info-timer, .timer"));
  }

  let debounce;
  observer = new MutationObserver(function (mutations) {
    // Skip storms that are purely countdown ticks; render only when something
    // outside a timer actually changed (new cards hydrating, etc.).
    if (!mutations.some((m) => !inTimer(m.target))) return;
    clearTimeout(debounce);
    debounce = setTimeout(run, 350);
  });

  // Resize is the main source of jank: eBay reflows and thrashes the DOM on every
  // frame, and an attached MutationObserver forces the browser to record and
  // deliver mutation records for the whole body subtree each of those frames.
  // Detach entirely for the duration of an active resize, then do one catch-up
  // render (which also reattaches the observer) after it settles.
  let resizeEnd;
  window.addEventListener(
    "resize",
    function () {
      if (!resizing) {
        resizing = true;
        clearTimeout(debounce);
        observer.disconnect();
      }
      clearTimeout(resizeEnd);
      resizeEnd = setTimeout(function () {
        resizing = false;
        run();
      }, 300);
    },
    { passive: true }
  );

  // Initial load: migrate legacy keys, pull settings, then render + start watching.
  migrateLegacy(function () {
    chrome.storage.sync.get(DEFAULTS, function (stored) {
      applySettings(stored);
      run();
    });
  });

  // Live updates from the popup: re-apply settings and re-render on any change.
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== "sync") return;
    const changedKeys = Object.keys(changes);
    chrome.storage.sync.get(DEFAULTS, function (stored) {
      applySettings(stored);
      // A change limited to live-only keys is applied by each feature's
      // in-place refresh (e.g. re-rendering an open per-unit panel) — a full
      // rebuild would collapse an expanded panel (a jarring bug).
      if (isLiveOnlyChange(changedKeys)) {
        features.forEach((f) => f.onLiveOnlyChange && f.onLiveOnlyChange());
        return;
      }
      // Everything else needs a clear + rebuild: each feature wipes what a
      // settings edit could have staled (boxes bake totals at build time;
      // highlights are add-only within a pass, so stale marks from the previous
      // terms would persist without an explicit wipe). run() re-renders.
      features.forEach((f) => f.onSettingsChanged && f.onSettingsChanged());
      run();
    });
  });

  // One-time feature startup hooks (e.g. the auction-ending countdown watch —
  // a no-op off its pages; each feature gates on `kind` itself).
  features.forEach((f) => f.init && f.init(kind));
})();
