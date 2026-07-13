// Value sanitizers shared by content.js and the popup. Pure. (The sound-key
// sanitizer lives in sounds.js, next to the SOUNDS table it validates against.)
(function () {
  "use strict";
  const ES = (globalThis.ES = globalThis.ES || {});

  // Clamp any stored/user number to a safe finite non-negative value.
  function sanitizeNonNeg(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  }

  // Coerce a stored value to a boolean, falling back when it isn't one.
  function sanitizeBool(v, fallback) {
    return typeof v === "boolean" ? v : fallback;
  }

  // The tax rate with its 8.25% default.
  function sanitizeTaxRate(v) {
    return sanitizeNonNeg(v, 0.0825);
  }

  // The Goldin mode: "hide" or "flag", else "show" (the default / no-op). Any
  // legacy "off" value falls through to "show" — same behavior, matching the UI.
  function sanitizeGoldin(v) {
    return v === "hide" || v === "flag" ? v : "show";
  }

  // The left filter-rail mode: "hide" or "collapsible", else "show" (default).
  // A legacy stored `showFilters` boolean (the former on/off toggle) migrates in
  // via the caller, so unknown values here just fall back to the shown default.
  function sanitizeFilterMode(v) {
    return v === "hide" || v === "collapsible" ? v : "show";
  }

  // How the collapsed filter rail expands: "click", else "hover" (the default).
  function sanitizeFilterExpand(v) {
    return v === "click" ? "click" : "hover";
  }

  // The badge emoji for a Listing Highlights polarity. Restricted to the preset
  // picker set (empty string = no badge); anything else falls back. Kept as an
  // allowlist so a stored junk value can't inject arbitrary text into a title.
  const EMOJI_PRESETS = ["", "🎲", "⭐", "🔥", "✅", "⚠️", "💎", "👀", "🚩", "🚫"];
  function sanitizeEmoji(v, fallback) {
    return EMOJI_PRESETS.includes(v) ? v : fallback;
  }

  Object.assign(ES, {
    sanitizeNonNeg,
    sanitizeBool,
    sanitizeTaxRate,
    sanitizeGoldin,
    sanitizeFilterMode,
    sanitizeFilterExpand,
    sanitizeEmoji,
    EMOJI_PRESETS,
  });
})();
