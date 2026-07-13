// Runtime settings object for the eBay Est.-Total extension.
//
// Modules communicate through a single shared namespace, `globalThis.ES`. In an
// MV3 isolated world every content script shares one global, and the popup page's
// scripts share window; both resolve `globalThis`, so `ES` is the one seam. Each
// module attaches its public API to `ES` and reads its dependencies back off it.
// No bundler, no build step — the manifest just lists the files in dependency
// order.
//
// `config` is the one mutable knob. It is SEEDED from the shared default map
// (ES.DEFAULTS, defined in defaults.js, which loads before this file). content.js
// overwrites its fields from chrome.storage on load and on change (mutating the
// object in place, never replacing it), so every module that captured the
// reference sees fresh values. The initial seed only matters before that first
// read; the values themselves live in ONE place (defaults.js) to avoid drift.
(function () {
  "use strict";
  const ES = (globalThis.ES = globalThis.ES || {});

  const config = { ...ES.DEFAULTS };

  // Setting keys whose change only affects LIVE-rendered content (e.g. the
  // per-unit "$X.XX/unit" line in an open panel) — NOT content baked at build
  // time. A change limited to these is applied by each feature's
  // onLiveOnlyChange() in-place refresh; anything else needs a full clear +
  // rebuild. Isolating this is what keeps an expanded per-unit panel from
  // collapsing when you flip the "include shipping in price per item" toggle.
  // Each feature declares its own live-only keys in its schema.js.
  const LIVE_ONLY_KEYS = (ES.settingsSchemas || []).flatMap((s) => s.liveOnlyKeys || []);

  // True when every changed key is live-only (and at least one changed) — the
  // signal for the in-place refresh path instead of clearBoxes()+run(). Pure.
  function isLiveOnlyChange(changedKeys) {
    return (
      Array.isArray(changedKeys) &&
      changedKeys.length > 0 &&
      changedKeys.every((k) => LIVE_ONLY_KEYS.includes(k))
    );
  }

  Object.assign(ES, { config, LIVE_ONLY_KEYS, isLiveOnlyChange });
})();
