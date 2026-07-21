// eBay Σummer. Copyright (C) 2026 lvuCodes. Licensed under GPL-3.0-or-later; see LICENSE.md.
//
// Storage → config: sanitize every stored setting into the shared `config`
// object, plus the one-time legacy-key migrations. Schema-driven: DEFAULTS
// (defaults.js) is the single key list — boolean keys sanitize via
// sanitizeBool automatically, and every non-boolean key names its sanitizer in
// its feature's schema.js (registered via registerSettings, merged here).
// Adding a boolean setting therefore needs no change anywhere; a non-boolean
// one needs exactly one sanitizers entry in its feature's schema.
(function () {
  "use strict";
  const ES = (globalThis.ES = globalThis.ES || {});
  const { config, DEFAULTS, sanitizeBool } = ES;

  // Per-key sanitizers for the non-boolean settings, merged from every
  // feature's schema. Each takes (storedValue, storedObject) — the second
  // argument only matters for legacy migrations.
  const SANITIZERS = Object.assign({}, ...ES.settingsSchemas.map((s) => s.sanitizers || {}));

  // Copy sanitized stored settings into `config` (mutating it in place, never
  // replacing it, so every module that captured the reference sees fresh values).
  function applySettings(stored) {
    Object.keys(DEFAULTS).forEach((key) => {
      const sanitize = SANITIZERS[key];
      config[key] = sanitize
        ? sanitize(stored[key], stored)
        : sanitizeBool(stored[key], DEFAULTS[key]);
    });
  }

  // Chain the features' one-time legacy-key migrations (each schema may supply
  // a migrate(done) hook), then call done. Runs before the first settings read.
  function migrateLegacy(done) {
    const migrations = ES.settingsSchemas.map((s) => s.migrate).filter(Boolean);
    (function next(i) {
      if (i >= migrations.length) return done();
      migrations[i](() => next(i + 1));
    })(0);
  }

  Object.assign(ES, { applySettings, migrateLegacy });
})();
