// Generic value sanitizers shared by content.js and the popup. Pure. Feature-
// specific sanitizers live next to the keys they validate: the sound-key
// sanitizer in sounds.js, and the tax-rate / Goldin / filter / emoji sanitizers
// each in their feature's schema.js.
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

  Object.assign(ES, {
    sanitizeNonNeg,
    sanitizeBool,
  });
})();
