// Landed-total math and the estimation box's text parts: calcTotal, shipLabel,
// boxParts (amounts, sub lines, breakdowns, ranges, per-unit bases), the
// shipping-cost flag dot, and the per-unit count/line helpers.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { boxParts, calcTotal, shipLabel, shipFlag, clampCount, perUnitText, parseCount, pctText } = require("./load-es.js");

const close = (a, b) => Math.abs(a - b) < 1e-9;

test("boxParts: large totals render grouped in the amount and sub", () => {
  const p = boxParts(1500, 200, 0.0825);
  // 1500 + 123.75 tax + 200 ship = 1823.75
  assert.equal(p.amount, "US $1,823.75");
  assert.ok(p.sub.includes("$123.75"));
});

// --- calcTotal -------------------------------------------------------------
test("calcTotal: tax on item only, plus shipping", () => {
  const { tax, total } = calcTotal(100, 10, 0.0825);
  assert.ok(close(tax, 8.25));
  assert.ok(close(total, 118.25)); // 100 + 8.25 tax + 10 ship
});

test("calcTotal: free shipping (0) not taxed", () => {
  const { total } = calcTotal(143.5, 0, 0.0825);
  assert.ok(close(total, 143.5 * 1.0825));
});

test("calcTotal: null/undefined shipping treated as 0", () => {
  const { total } = calcTotal(50, null, 0.0825);
  assert.ok(close(total, 50 * 1.0825));
});

// --- shipLabel: the unified three-state label ------------------------------
test("shipLabel: paid shipping", () => {
  assert.equal(shipLabel(14.18), "+ $14.18 ship");
});

test("shipLabel: free shipping (0)", () => {
  assert.equal(shipLabel(0), "+ free ship");
});

test("shipLabel: unknown shipping (null) -> n/a, or a custom label", () => {
  assert.equal(shipLabel(null), "+ ship n/a");
  assert.equal(shipLabel(null, "TBD"), "+ ship TBD"); // home/amber box
  assert.equal(shipLabel(14.18, "TBD"), "+ $14.18 ship"); // known ship ignores it
});

test("boxParts: shipUnknownText flows into the sub (amber home box)", () => {
  const p = boxParts(100, null, 0.0825, null, "TBD");
  assert.match(p.sub, /\+ ship TBD$/);
  const dflt = boxParts(100, null, 0.0825);
  assert.match(dflt.sub, /\+ ship n\/a$/);
});

// --- pctText: the tax-rate label -------------------------------------------
// Exported off ES so the site's landing-page demo renders the same rate label
// as the extension instead of re-deriving one; pinned here because the site
// consumes it directly and a format change there would be invisible.
test("pctText: a rate becomes a two-decimal percent label", () => {
  assert.equal(pctText(0.0825), "8.25%");
  assert.equal(pctText(0.07), "7.00%");
  assert.equal(pctText(0), "0.00%");
});

test("pctText: the label matches the one boxParts renders", () => {
  assert.ok(boxParts(100, 10, 0.0825).sub.includes(pctText(0.0825)));
});

// --- boxParts: text the box renders, across shipping states ----------------
test("boxParts: paid shipping folds tax + ship into the sub line", () => {
  const p = boxParts(143.5, 14.18, 0.0825);
  assert.equal(p.label, "Est. total");
  assert.equal(p.amount, "US $169.52"); // 143.5 + 11.83875 tax + 14.18, rounded
  assert.equal(p.sub, "incl. 8.25% tax ($11.84) + $14.18 ship");
});

test("boxParts: free shipping", () => {
  const p = boxParts(100, 0, 0.0825);
  assert.equal(p.amount, "US $108.25");
  assert.equal(p.sub, "incl. 8.25% tax ($8.25) + free ship");
});

test("boxParts: unknown shipping excluded from total, labeled n/a", () => {
  const p = boxParts(100, null, 0.0825);
  assert.equal(p.amount, "US $108.25"); // shipping excluded
  assert.equal(p.sub, "incl. 8.25% tax ($8.25) + ship n/a");
});

test("boxParts: price range shows total range, tax range, and range flag", () => {
  const p = boxParts(46.79, 0, 0.0825, 92.49);
  assert.equal(p.range, true);
  assert.equal(p.amount, "US $50.65 - $100.12");
  assert.equal(p.sub, "incl. 8.25% tax ($3.86 - $7.63) + free ship");
});

// --- boxParts: the main listing box's base-price breakdown sub -------------
test("boxParts: breakdown lays out base + (tax% tax -> tax $) + shipping", () => {
  const p = boxParts(143.5, 14.18, 0.0825);
  // "{base} + ({tax %} tax → {tax}) + {shipping}" — the addends sum to the total.
  assert.equal(p.breakdown, "US $143.50 + (8.25% tax → $11.84) + $14.18 ship");
});

test("boxParts: breakdown with free and unknown shipping", () => {
  assert.equal(boxParts(100, 0, 0.0825).breakdown, "US $100.00 + (8.25% tax → $8.25) + free ship");
  assert.equal(
    boxParts(100, null, 0.0825).breakdown,
    "US $100.00 + (8.25% tax → $8.25) + ship n/a"
  );
  assert.equal(
    boxParts(100, null, 0.0825, null, "TBD").breakdown,
    "US $100.00 + (8.25% tax → $8.25) + ship TBD"
  );
});

test("boxParts: breakdown ranges the base and tax when the price is a range", () => {
  const p = boxParts(46.79, 0, 0.0825, 92.49);
  assert.equal(
    p.breakdown,
    "US $46.79 - $92.49 + (8.25% tax → $3.86 - $7.63) + free ship"
  );
});

test("boxParts: high equal to/below low is not treated as a range", () => {
  assert.equal(boxParts(50, 0, 0.0825, 50).range, false);
  assert.equal(boxParts(50, 0, 0.0825, null).range, false);
});

test("boxParts: honors a non-default tax rate", () => {
  const p = boxParts(100, 0, 0.1);
  assert.equal(p.amount, "US $110.00");
  assert.equal(p.sub, "incl. 10.00% tax ($10.00) + free ship");
});

// --- shipFlag: the colored shipping dot ------------------------------------
// Defaults used below: shipPct = 0.5 (50% of item), shipFloor = 10 ($).
test("shipFlag: free shipping -> green", () => {
  assert.equal(shipFlag(100, 0, 0.5, 10), "🟢");
});

test("shipFlag: unknown shipping -> no dot", () => {
  assert.equal(shipFlag(100, null, 0.5, 10), "");
});

test("shipFlag: paid but within both thresholds -> no dot", () => {
  // $5 ship on a $100 item: under the $10 floor AND under 50% ($50).
  assert.equal(shipFlag(100, 5, 0.5, 10), "");
});

test("shipFlag: over the flat floor only -> yellow", () => {
  // $15 ship on a $200 item: over $10 floor but only 7.5% (< 50%).
  assert.equal(shipFlag(200, 15, 0.5, 10), "🟡");
});

test("shipFlag: over the % of item only (cheap-item ripoff) -> yellow", () => {
  // $6 ship on an $8 item: 75% > 50% but under the $10 floor.
  assert.equal(shipFlag(8, 6, 0.5, 10), "🟡");
});

test("shipFlag: over BOTH the floor and the % -> red", () => {
  // $15 ship on a $20 item: over $10 floor AND 75% > 50%.
  assert.equal(shipFlag(20, 15, 0.5, 10), "🔴");
});

test("shipFlag: thresholds are strict (equal is not over)", () => {
  // $10 ship on a $20 item: equals both the $10 floor and 50% ($10) -> no dot.
  assert.equal(shipFlag(20, 10, 0.5, 10), "");
});

test("shipFlag: pickup-only -> pin+runner, filling the otherwise-empty (null shipping) slot", () => {
  assert.equal(shipFlag(100, null, 0.5, 10), "");
  assert.equal(shipFlag(100, null, 0.5, 10, true), "📍🏃");
});

test("shipFlag: pickup-only wins over any shipping-cost dot", () => {
  // Even if a stray shipping figure is present, pickup-only takes the slot.
  assert.equal(shipFlag(20, 15, 0.5, 10, true), "📍🏃");
  assert.equal(shipFlag(100, 0, 0.5, 10, true), "📍🏃");
});

// --- clampCount / perUnitText: the per-unit breakdown ----------------------
test("clampCount: floors to a whole number >= 1", () => {
  assert.equal(clampCount(1), 1);
  assert.equal(clampCount(3.9), 3);
  assert.equal(clampCount(0), 1);
  assert.equal(clampCount(-5), 1);
  assert.equal(clampCount("4"), 4);
  assert.equal(clampCount("abc"), 1);
  assert.equal(clampCount(undefined), 1);
});

test("boxParts: exposes numeric totals for the per-unit divide", () => {
  const single = boxParts(100, 0, 0.0825);
  assert.ok(Math.abs(single.totalLow - 108.25) < 1e-9);
  assert.equal(single.totalHigh, null);
  const ranged = boxParts(46.79, 0, 0.0825, 92.49);
  assert.ok(ranged.totalHigh > ranged.totalLow);
});

test("perUnitText: '<count> @ $X.XX/unit'", () => {
  // 108.25 / 1 and / 4
  assert.equal(perUnitText(108.25, null, 1), "1 @ $108.25/unit");
  assert.equal(perUnitText(108.25, null, 4), "4 @ $27.06/unit");
});

test("perUnitText: a range divides both ends", () => {
  assert.equal(perUnitText(100, 200, 4), "4 @ $25.00 - $50.00/unit");
});

test("perUnitText: guards a bad count to 1", () => {
  assert.equal(perUnitText(50, null, 0), "1 @ $50.00/unit");
  assert.equal(perUnitText(50, null, "x"), "1 @ $50.00/unit");
});

test("parseCount: plain numbers, formulas, and fallbacks", () => {
  assert.equal(parseCount("1"), 1);
  assert.equal(parseCount("12"), 12);
  assert.equal(parseCount("=12*18"), 216); // formula like the bid calc
  assert.equal(parseCount("=2*(3+4)"), 14);
  assert.equal(parseCount("3.9"), 3); // floored
  assert.equal(parseCount("=10/3"), 3); // 3.33 -> floored
  assert.equal(parseCount("0"), 1); // clamped up
  assert.equal(parseCount("=1-5"), 1); // negative -> clamp to 1
  assert.equal(parseCount("=2*"), 1); // malformed formula -> 1
  assert.equal(parseCount(""), 1);
  assert.equal(parseCount("abc"), 1);
});

// --- boxParts: no-shipping totals for the per-unit toggle ------------------
test("boxParts: totalNoShip excludes shipping (item + tax only)", () => {
  const p = boxParts(100, 10, 0.0825);
  assert.ok(close(p.totalLow, 118.25)); // includes $10 ship
  assert.ok(close(p.totalNoShipLow, 108.25)); // item + tax, no ship
  assert.equal(p.totalNoShipHigh, null);
});

test("boxParts: totalNoShip ranges when the price is a range", () => {
  const p = boxParts(46.79, 5, 0.0825, 92.49);
  assert.ok(close(p.totalNoShipLow, 46.79 * 1.0825));
  assert.ok(close(p.totalNoShipHigh, 92.49 * 1.0825));
});
