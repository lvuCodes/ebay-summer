// Coverage for live.js's cross-widget glue (perUnit shared state + the
// registerLive registry). live.js isn't part of load-es.js (it's grouped with
// the DOM/chrome modules), but perUnit.set/subscribe and registerLive are
// DOM-free — they touch only `el.isConnected` — so they're exercised here with
// plain { isConnected } stand-ins. Requires calc.js first: perUnit.set clamps
// the count via clampCount, which live.js pulls off ES at load.
const { test } = require("node:test");
const assert = require("node:assert");

require("../src/core/registry.js");
require("../src/core/sanitize.js");
require("../src/calculator/calc.js");
require("../src/core/config.js");
require("../src/calculator/live.js");
const ES = globalThis.ES;

test("perUnit.set clamps the count and notifies subscribers (regression: clampCount was unresolved)", () => {
  const el = { isConnected: true };
  const seen = [];
  ES.perUnit.subscribe(el, (count, active) => seen.push([count, active]));
  ES.perUnit.set(3.9, true); // floors to 3, marks active
  assert.strictEqual(ES.perUnit.count, 3);
  assert.strictEqual(ES.perUnit.active, true);
  assert.deepStrictEqual(seen.at(-1), [3, true]);

  ES.perUnit.set(0, null); // clamps below-1 to 1; null leaves active unchanged
  assert.strictEqual(ES.perUnit.count, 1);
  assert.strictEqual(ES.perUnit.active, true);
});

test("perUnit prunes detached subscribers on the next notify", () => {
  const live = { isConnected: true };
  const detached = { isConnected: false };
  let liveFired = 0;
  let detachedFired = 0;
  const before = ES.perUnit._subs.length;
  ES.perUnit.subscribe(live, () => liveFired++);
  ES.perUnit.subscribe(detached, () => detachedFired++);
  assert.strictEqual(ES.perUnit._subs.length, before + 2);

  ES.perUnit.set(2, null);
  assert.strictEqual(liveFired, 1);
  assert.strictEqual(detachedFired, 0); // detached entry pruned before its fn runs
  assert.strictEqual(ES.perUnit._subs.length, before + 1);
});

test("perUnit.setIncludeShip flips the flag and notifies", () => {
  const el = { isConnected: true };
  let last = null;
  ES.perUnit.subscribe(el, (count) => (last = count));
  ES.perUnit.setIncludeShip(false);
  assert.strictEqual(ES.perUnit.includeShip, false);
  assert.notStrictEqual(last, null); // subscriber was invoked
  ES.perUnit.setIncludeShip(true);
  assert.strictEqual(ES.perUnit.includeShip, true);
});

test("refreshLive runs connected entries and never fires detached ones", () => {
  let liveRan = 0;
  let detachedRan = 0;
  ES.registerLive({ isConnected: false }, () => detachedRan++);
  ES.registerLive({ isConnected: true }, () => liveRan++);
  ES.refreshLive();
  assert.ok(liveRan >= 1);
  assert.strictEqual(detachedRan, 0); // detached entry is pruned, its fn never runs
  // Pruned for good: a second pass still never fires it.
  ES.refreshLive();
  assert.strictEqual(detachedRan, 0);
});
