// The two registries that keep the core feature-agnostic. Loads FIRST (right
// after nothing — it only touches ES), in both the content-script bundle and
// the popup.
//
// A FEATURE (calculator, highlights, custom-view, notifications) plugs into the
// core through two seams, so the core never names a feature and deleting one is
// "remove its folder + its manifest/popup <script> lines":
//
//  1. registerSettings({ defaults, sanitizers, liveOnlyKeys, migrate }) — the
//     feature's persisted-settings schema. core/defaults.js merges the defaults
//     maps into ES.DEFAULTS, core/settings.js merges the sanitizers and chains
//     the migrations, core/config.js flattens the liveOnlyKeys.
//  2. registerFeature({ key, sharedCss, pageCss, run, clear, onSettingsChanged,
//     onLiveOnlyChange, init }) — the feature's runtime hooks, all optional:
//       sharedCss            static CSS for the one shared <style> (all pages)
//       pageCss(kind, cfg)   config-driven CSS for the per-page <style>
//       run(kind)            one idempotent render pass (self-gated on config)
//       clear()              strip everything the feature ever injected
//       onSettingsChanged()  pre-run wipe when a persisted setting changes
//       onLiveOnlyChange()   in-place refresh for live-only key changes
//       init(kind)           one-time startup hook (after the first settings read)
//
// Registration order = manifest load order, which fixes the CSS concatenation
// order and the run() order.
(function () {
  "use strict";
  const ES = (globalThis.ES = globalThis.ES || {});

  ES.settingsSchemas = [];
  ES.registerSettings = function (schema) {
    ES.settingsSchemas.push(schema);
  };

  ES.features = [];
  ES.registerFeature = function (feature) {
    ES.features.push(feature);
  };

  // Pure assemblers over the registered features — core/style.js feeds these to
  // the two <style> elements; exported here (not there) so Node tests can build
  // the stylesheets without the DOM-touching injector.
  ES.assembleSharedCss = function () {
    return ES.features.map((f) => f.sharedCss || "").join("");
  };
  ES.assemblePageCss = function (kind, cfg) {
    return ES.features.map((f) => (f.pageCss ? f.pageCss(kind, cfg) : "")).join("");
  };
})();
