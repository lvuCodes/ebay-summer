// eBay Σummer. Copyright (C) 2026 lvuCodes. Licensed under GPL-3.0-or-later; see LICENSE.md.
//
// Single source of truth for every persisted setting's default value.
//
// Loaded in BOTH the content-script list (manifest.json) and popup.html, after
// every feature's schema.js (each of which registered its own defaults map via
// registerSettings). Everyone reads defaults from here: content.js uses them as
// storage-read fallbacks and to seed `config`; popup.js seeds its form
// fallbacks from them and writes this whole map on "Reset defaults". Keeping
// ONE assembled map is what stops the content/popup tables drifting.
(function () {
  "use strict";
  const ES = (globalThis.ES = globalThis.ES || {});

  const DEFAULTS = Object.assign(
    {
      // Master on/off for the whole extension — the one core-owned setting. When
      // false, content.js injects nothing (no boxes, no page CSS, no live-hide,
      // no auction notifications).
      enabled: true,
    },
    // Each feature's schema.js contributed its defaults: the section masters
    // (estTotal / customView / notifyEnabled / highlightEnabled) and every
    // sub-setting live in their feature's schema, not here. ALL FOUR masters
    // default on, but each feature ships in a no-op resting state so enabling
    // the extension changes nothing until the user opts a sub-item in —
    // estTotal is the exception (its boxes show immediately; that's the
    // extension's core purpose).
    ...ES.settingsSchemas.map((s) => s.defaults)
  );

  ES.DEFAULTS = DEFAULTS;
})();
