// The bid calculator's pure core: the safe "=expr" evaluator, input grammar,
// the forward (bid -> total) and reverse (target total -> bid) computations,
// the FX translation, and the per-unit line.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { evalExpr, bidCalcInput, bidCalcParts, bidFromTotalParts, bidPerUnitText, boxParts } = require("./load-es.js");

const close = (a, b) => Math.abs(a - b) < 1e-9;

// --- evalExpr: safe arithmetic for the bid calculator's "=" mode -----------
test("evalExpr: precedence and grouping", () => {
  assert.equal(evalExpr("2*40+15"), 95);
  assert.equal(evalExpr("2+40*15"), 602);
  assert.equal(evalExpr("(3+4)/2"), 3.5);
  assert.equal(evalExpr(" 10 - 3 - 2 "), 5); // left-associative
});

test("evalExpr: unary sign and decimals", () => {
  assert.equal(evalExpr("-5+8"), 3);
  assert.equal(evalExpr("3.5*2"), 7);
  assert.equal(evalExpr("-(2+3)"), -5);
});

test("evalExpr: rejects malformed / unsafe input -> null", () => {
  assert.equal(evalExpr("2+"), null); // dangling operator
  assert.equal(evalExpr("(1+2"), null); // unbalanced paren
  assert.equal(evalExpr("1+2)"), null); // trailing garbage
  assert.equal(evalExpr("5/0"), null); // divide by zero
  assert.equal(evalExpr("alert(1)"), null); // non-math characters
  assert.equal(evalExpr(""), null);
  assert.equal(evalExpr("   "), null);
  assert.equal(evalExpr(null), null);
});

// --- bidCalcInput: number vs. "=expr" --------------------------------------
test("bidCalcInput: plain number (with $ and commas tolerated)", () => {
  assert.deepEqual(bidCalcInput("40"), { isFunction: false, value: 40 });
  assert.deepEqual(bidCalcInput("$1,250.50"), { isFunction: false, value: 1250.5 });
});

test("bidCalcInput: '=' switches to expression mode", () => {
  assert.deepEqual(bidCalcInput("=2*40+15"), { isFunction: true, value: 95 });
  assert.deepEqual(bidCalcInput("= (3+4)/2"), { isFunction: true, value: 3.5 });
});

test("bidCalcInput: empty / unparseable -> null value", () => {
  assert.deepEqual(bidCalcInput(""), { isFunction: false, value: null });
  assert.deepEqual(bidCalcInput("abc"), { isFunction: false, value: null });
  assert.deepEqual(bidCalcInput("=2*"), { isFunction: true, value: null });
});

// --- bidCalcParts: bid -> estimated landed total ---------------------------
test("bidCalcParts: number mode folds tax + shipping into the total", () => {
  const p = bidCalcParts("100", 10, 0.0825);
  assert.equal(p.valid, true);
  assert.equal(p.isFunction, false);
  assert.equal(p.value, 100);
  assert.equal(p.totalText, "US $118.25"); // 100 + 8.25 tax + 10 ship
  assert.ok(close(p.totalNoShip, 108.25));
});

test("bidCalcParts: function mode exposes the evaluated amount", () => {
  const p = bidCalcParts("=2*40+15", 0, 0.0825);
  assert.equal(p.isFunction, true);
  assert.equal(p.value, 95);
  assert.equal(p.calcText, "$95.00");
  assert.equal(p.totalText, "US $102.84"); // 95 * 1.0825, free ship
});

test("bidCalcParts: sub line matches the purple box's format", () => {
  // Same phrasing as boxParts: "incl. X% tax ($amount) + $ship ship".
  const p = bidCalcParts("143.50", 14.18, 0.0825);
  assert.equal(p.sub, "incl. 8.25% tax ($11.84) + $14.18 ship");
  assert.equal(boxParts(143.5, 14.18, 0.0825).sub, p.sub);
});

test("bidCalcParts: empty still describes rate + shipping (no amount)", () => {
  assert.equal(bidCalcParts("", 0, 0.0825).sub, "incl. 8.25% tax + free ship");
});

test("bidCalcParts: empty / invalid -> not valid", () => {
  assert.equal(bidCalcParts("", 0, 0.0825).valid, false);
  assert.equal(bidCalcParts("=1/0", 0, 0.0825).valid, false);
  assert.equal(bidCalcParts("-5", 0, 0.0825).valid, false); // negative bid rejected
});

// --- bidFromTotalParts: reverse solve (target total -> bid) ----------------
test("bidFromTotalParts: back-solves the bid from a target landed total", () => {
  // Inverse of boxParts(100, 0, .0825) whose total is 108.25.
  const p = bidFromTotalParts("108.25", 0, 0.0825);
  assert.equal(p.valid, true);
  assert.equal(p.bidText, "US $100.00");
  assert.equal(p.total, 108.25);
  assert.equal(p.sub, "incl. 8.25% tax ($8.25) + free ship");
});

test("bidFromTotalParts: subtracts shipping before dividing out the tax", () => {
  // Round-trip of bidCalcParts(143.5, 14.18, .0825) whose total is 169.52.
  const p = bidFromTotalParts("169.52", 14.18, 0.0825);
  assert.equal(p.bidText, "US $143.50");
  assert.equal(p.totalNoShip, 169.52 - 14.18); // bid + tax, shipping stripped
});

test("bidFromTotalParts: '=' expression mode is honored", () => {
  const p = bidFromTotalParts("=100+8.25", 0, 0.0825);
  assert.equal(p.isFunction, true);
  assert.equal(p.bidText, "US $100.00");
});

test("bidFromTotalParts: target below shipping alone is invalid", () => {
  const p = bidFromTotalParts("5", 14.18, 0.0825);
  assert.equal(p.valid, false);
  assert.equal(p.belowShipping, true);
});

test("bidFromTotalParts: empty / unparseable / negative -> not valid", () => {
  assert.equal(bidFromTotalParts("", 0, 0.0825).valid, false);
  assert.equal(bidFromTotalParts("abc", 0, 0.0825).valid, false);
  assert.equal(bidFromTotalParts("-5", 0, 0.0825).valid, false);
});

// --- currency-aware bid calc: fx translates the USD bid to seller currency ---
// fx.rate is USD per 1 seller-currency unit (GBP -> 1.3386). fxBidText is the
// seller-currency amount to enter in eBay's offer field. Absent fx -> null.
test("bidCalcParts: fx translates the USD bid back to the seller's currency", () => {
  const p = bidCalcParts("10", 5, 0.0825, { code: "GBP", rate: 1.3386 });
  assert.equal(p.valid, true);
  assert.equal(p.totalText, "US $15.83"); // 10 + 0.825 tax + 5 ship, USD (unchanged)
  assert.equal(p.fxBidText, "GBP 7.47"); // 10 / 1.3386
});

test("bidCalcParts: no fx -> fxBidText null (plain USD calc, domestic)", () => {
  assert.equal(bidCalcParts("10", 0, 0.0825).fxBidText, null);
  assert.equal(bidCalcParts("10", 0, 0.0825, { code: "GBP", rate: 0 }).fxBidText, null);
});

test("bidFromTotalParts: fx translates the back-solved USD bid to seller currency", () => {
  // Target $15.83 total, $5 ship, 8.25% tax -> bid $10.00 -> GBP 10/1.3386 = 7.47.
  const p = bidFromTotalParts("15.825", 5, 0.0825, { code: "GBP", rate: 1.3386 });
  assert.equal(p.bidText, "US $10.00");
  assert.equal(p.fxBidText, "GBP 7.47");
});

// --- bidPerUnitText: per-unit line for the bid calculator ------------------
test("bidPerUnitText: includes or excludes shipping by flag", () => {
  // total 118.25 (with ship), noShip 108.25, count 2.
  assert.equal(bidPerUnitText(118.25, 108.25, true, 2), "$59.13/unit");
  assert.equal(bidPerUnitText(118.25, 108.25, false, 2), "$54.13/unit");
});

test("bidPerUnitText: guards a bad count to 1", () => {
  assert.equal(bidPerUnitText(100, 90, true, 0), "$100.00/unit");
});
