// Settings hardening: every value sanitizer, the live-only change detector, and
// the schema-driven applySettings (storage -> config).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { sanitizeNonNeg, sanitizeBool, sanitizeTaxRate, sanitizeSound, SOUNDS, DEFAULT_SOUND, sanitizeEmoji, sanitizeGoldin, sanitizeFilterMode, sanitizeFilterExpand, isLiveOnlyChange, applySettings, config, DEFAULTS } = require("./load-es.js");

// --- sanitizeNonNeg / sanitizeTaxRate: hardening for the popup path --------
test("sanitizeNonNeg: passes through valid values, uses the given fallback", () => {
  assert.equal(sanitizeNonNeg(0.5, 0.5), 0.5);
  assert.equal(sanitizeNonNeg(0, 10), 0);
  assert.equal(sanitizeNonNeg(-1, 10), 10);
  assert.equal(sanitizeNonNeg("abc", 10), 10);
  assert.equal(sanitizeNonNeg(undefined, 0.5), 0.5);
});

test("sanitizeTaxRate: passes through a valid rate", () => {
  assert.equal(sanitizeTaxRate(0.1), 0.1);
  assert.equal(sanitizeTaxRate(0), 0);
});

test("sanitizeTaxRate: bad input falls back to 8.25%", () => {
  assert.equal(sanitizeTaxRate(undefined), 0.0825);
  assert.equal(sanitizeTaxRate(-1), 0.0825);
  assert.equal(sanitizeTaxRate("abc"), 0.0825);
  assert.equal(sanitizeTaxRate(NaN), 0.0825);
});

// --- sanitizeBool ----------------------------------------------------------
test("sanitizeBool: booleans pass through, non-booleans fall back", () => {
  assert.equal(sanitizeBool(true, false), true);
  assert.equal(sanitizeBool(false, true), false);
  assert.equal(sanitizeBool(undefined, true), true);
  assert.equal(sanitizeBool("yes", false), false);
});

// --- sanitizeSound: alert-sound key validation -----------------------------
test("sanitizeSound: known keys pass, everything else -> coin", () => {
  assert.equal(sanitizeSound("coin"), "coin");
  assert.equal(sanitizeSound("chime"), "chime");
  assert.equal(sanitizeSound("bell"), "bell");
  assert.equal(sanitizeSound("bogus"), DEFAULT_SOUND);
  assert.equal(sanitizeSound(""), DEFAULT_SOUND);
  assert.equal(sanitizeSound(undefined), DEFAULT_SOUND);
  assert.equal(sanitizeSound(42), DEFAULT_SOUND);
  // Every advertised preset must actually exist in SOUNDS.
  ["coin", "chime", "bell", "ding", "arcade"].forEach((k) => assert.ok(SOUNDS[k]));
  assert.equal(DEFAULT_SOUND, "coin");
});

// --- sanitizeEmoji: badge picker allowlist ---------------------------------
test("sanitizeEmoji: preset members and blank pass; junk -> fallback", () => {
  assert.equal(sanitizeEmoji("🎲", "⭐"), "🎲");
  assert.equal(sanitizeEmoji("⭐", "🎲"), "⭐");
  assert.equal(sanitizeEmoji("", "🎲"), ""); // blank = no badge, allowed
  assert.equal(sanitizeEmoji("💀", "🎲"), "🎲"); // not in the preset set
  assert.equal(sanitizeEmoji("<script>", "⭐"), "⭐"); // no arbitrary text
  assert.equal(sanitizeEmoji(undefined, "🎲"), "🎲");
  assert.equal(sanitizeEmoji(42, ""), "");
});

// --- isLiveOnlyChange: in-place refresh vs. full rebuild -------------------
test("isLiveOnlyChange: perUnitShipping alone is live-only", () => {
  assert.equal(isLiveOnlyChange(["perUnitShipping"]), true);
});

test("isLiveOnlyChange: a baked key forces a rebuild", () => {
  assert.equal(isLiveOnlyChange(["taxRate"]), false);
  assert.equal(isLiveOnlyChange(["shipFloor"]), false);
  assert.equal(isLiveOnlyChange(["pageSearch"]), false);
});

test("isLiveOnlyChange: mixed live + baked forces a rebuild", () => {
  assert.equal(isLiveOnlyChange(["perUnitShipping", "taxRate"]), false);
});

test("isLiveOnlyChange: no changes is not live-only", () => {
  assert.equal(isLiveOnlyChange([]), false);
  assert.equal(isLiveOnlyChange(null), false);
});

// --- sanitizeGoldin: mode validation ---------------------------------------
test("sanitizeGoldin: valid modes pass, everything else -> show", () => {
  assert.equal(sanitizeGoldin("flag"), "flag");
  assert.equal(sanitizeGoldin("hide"), "hide");
  assert.equal(sanitizeGoldin("show"), "show");
  // Legacy stored value degrades to the new no-op default (same behavior).
  assert.equal(sanitizeGoldin("off"), "show");
  assert.equal(sanitizeGoldin("bogus"), "show");
  assert.equal(sanitizeGoldin(undefined), "show");
  assert.equal(sanitizeGoldin(true), "show");
});

// --- sanitizeFilterMode / sanitizeFilterExpand -----------------------------
test("sanitizeFilterMode: valid modes pass, everything else -> show", () => {
  assert.equal(sanitizeFilterMode("hide"), "hide");
  assert.equal(sanitizeFilterMode("collapsible"), "collapsible");
  assert.equal(sanitizeFilterMode("show"), "show");
  assert.equal(sanitizeFilterMode("bogus"), "show");
  assert.equal(sanitizeFilterMode(undefined), "show");
  assert.equal(sanitizeFilterMode(true), "show");
});

test("sanitizeFilterExpand: only click passes, everything else -> hover", () => {
  assert.equal(sanitizeFilterExpand("click"), "click");
  assert.equal(sanitizeFilterExpand("hover"), "hover");
  assert.equal(sanitizeFilterExpand("bogus"), "hover");
  assert.equal(sanitizeFilterExpand(undefined), "hover");
});

// --- applySettings: schema-driven storage -> config ------------------------
test("applySettings: empty stored -> config carries every default", () => {
  applySettings({});
  Object.keys(DEFAULTS).forEach((k) => assert.deepEqual(config[k], DEFAULTS[k]));
});

test("applySettings: junk stored values are sanitized per key", () => {
  applySettings({
    taxRate: "abc",
    notifyAt1: 45.9,
    notifySound: "nope",
    enabled: "yes",
  });
  assert.equal(config.taxRate, 0.0825);
  assert.equal(config.notifyAt1, 45); // floored to whole seconds
  assert.equal(config.notifySound, DEFAULT_SOUND);
  assert.equal(config.enabled, DEFAULTS.enabled); // non-boolean -> default
});
