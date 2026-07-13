// Auction-ending alert logic: the countdown parser and the fire-once-per-
// threshold dedup.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseTimeLeft, pendingThresholds, tickAlerts } = require("./load-es.js");

const freshState = () => ({ armed: false, ended: false, notified: new Set() });

// --- parseTimeLeft: countdown -> seconds, across page formats --------------
test("parseTimeLeft: listing 'Ends in Xm Ys'", () => {
  assert.equal(parseTimeLeft("Ends in 55m 0s"), 55 * 60);
  assert.equal(parseTimeLeft("Ends in 1m 30s"), 90);
});

test("parseTimeLeft: bids 'Xm Ys left'", () => {
  assert.equal(parseTimeLeft("2m 28s left"), 148);
});

test("parseTimeLeft: search 'Time left Zs' and bare seconds", () => {
  assert.equal(parseTimeLeft("0 bids · Time left 45s"), 45);
  assert.equal(parseTimeLeft("2s"), 2);
});

test("parseTimeLeft: hours and days", () => {
  assert.equal(parseTimeLeft("2h 4m left"), 2 * 3600 + 4 * 60);
  assert.equal(parseTimeLeft("1d 3h left"), 86400 + 3 * 3600);
});

test("parseTimeLeft: no time -> null", () => {
  assert.equal(parseTimeLeft(""), null);
  assert.equal(parseTimeLeft(null), null);
  assert.equal(parseTimeLeft("Ended"), null);
  assert.equal(parseTimeLeft("Time left Ended"), null); // no digits
});

// --- pendingThresholds: fire-once-per-threshold auction dedup ---------------
test("pendingThresholds: reached thresholds fire, unreached don't", () => {
  assert.deepEqual(pendingThresholds(45, [60, 30], new Set()), [60]);
  assert.deepEqual(pendingThresholds(25, [60, 30], new Set()), [60, 30]);
  assert.deepEqual(pendingThresholds(90, [60, 30], new Set()), []);
});

test("pendingThresholds: already-fired thresholds are skipped", () => {
  assert.deepEqual(pendingThresholds(25, [60, 30], new Set([60])), [30]);
  assert.deepEqual(pendingThresholds(25, [60, 30], new Set([60, 30])), []);
});

test("pendingThresholds: mirrored timers dedupe to one alert per threshold", () => {
  // Same page, same auction, N timer nodes -> N calls with equal `secs`, but a
  // shared `fired` Set means only the first pass emits; the rest see it fired.
  const fired = new Set();
  const first = pendingThresholds(45, [60, 30], fired);
  first.forEach((T) => fired.add(T));
  assert.deepEqual(first, [60]);
  assert.deepEqual(pendingThresholds(45, [60, 30], fired), []); // second mirror
});

test("pendingThresholds: equal thresholds de-duped within one call", () => {
  assert.deepEqual(pendingThresholds(25, [60, 60], new Set()), [60]);
});

test("pendingThresholds: null / ended / non-positive thresholds excluded", () => {
  assert.deepEqual(pendingThresholds(null, [60, 30], new Set()), []);
  assert.deepEqual(pendingThresholds(0, [60, 30], new Set()), []);
  assert.deepEqual(pendingThresholds(-5, [60, 30], new Set()), []);
  assert.deepEqual(pendingThresholds(25, [0, 30], new Set()), [30]); // drop the 0
});

// --- tickAlerts: arming (seed-suppression) + one-shot ending transition ------
test("tickAlerts: countdown watched from above fires each threshold in turn", () => {
  const s = freshState();
  assert.deepEqual(tickAlerts(90, [60, 30], s).fire, []); // arm tick: none reached
  assert.deepEqual(tickAlerts(55, [60, 30], s).fire, [60]); // crosses 60
  assert.deepEqual(tickAlerts(50, [60, 30], s).fire, []); // 60 already fired
  assert.deepEqual(tickAlerts(28, [60, 30], s).fire, [30]); // crosses 30
});

test("tickAlerts: threshold already passed on arrival is suppressed, not retro-fired", () => {
  // Tab opened at 45s: the 60s alert is already past, so it never fires; only the
  // 30s alert (genuinely crossed while watching) fires. Matches the ask exactly.
  const s = freshState();
  assert.deepEqual(tickAlerts(45, [60, 30], s).fire, []); // arm: 60 seeded-suppressed
  assert.deepEqual(tickAlerts(44, [60, 30], s).fire, []); // still no retro-60
  assert.deepEqual(tickAlerts(29, [60, 30], s).fire, [30]); // 30 fires normally
});

test("tickAlerts: mirrored timers at arm time don't double-fire a crossed threshold", () => {
  // Several .ux-timer__text mirrors -> repeated equal `secs` per tick; the shared
  // notified Set collapses them to one fire.
  const s = freshState();
  tickAlerts(90, [60, 30], s); // arm
  assert.deepEqual(tickAlerts(58, [60, 30], s).fire, [60]);
  assert.deepEqual(tickAlerts(58, [60, 30], s).fire, []); // second mirror, same tick
});

test("tickAlerts: ending transition flags exactly once, only after arming", () => {
  const s = freshState();
  tickAlerts(90, [60, 30], s); // arm
  assert.equal(tickAlerts(null, [60, 30], s).ended, true); // countdown gone -> ended
  assert.equal(tickAlerts(null, [60, 30], s).ended, false); // one-shot
});

test("tickAlerts: never armed (opened after end) does not flag ended", () => {
  const s = freshState();
  assert.equal(tickAlerts(null, [60, 30], s).ended, false);
  assert.equal(tickAlerts(0, [60, 30], s).ended, false);
});

test("tickAlerts: ending detected even with no thresholds enabled", () => {
  // The persistent-ended badge is independent of the threshold alerts.
  const s = freshState();
  tickAlerts(90, [], s); // arm with no thresholds
  assert.equal(tickAlerts(null, [], s).ended, true);
});
