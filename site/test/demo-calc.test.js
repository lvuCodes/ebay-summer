import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fmt,
  pctText,
  calcTotal,
  shipLabel,
  clampCount,
  evalExpr,
  readInput,
} from "../src/lib/demo-calc.js";

// --- fmt / pctText: display formatting -------------------------------------
test("fmt: always two decimals with thousands grouping", () => {
  assert.equal(fmt(1234.5), "1,234.50");
  assert.equal(fmt(0), "0.00");
  assert.equal(fmt(9.999), "10.00");
});

test("pctText: a rate becomes its X% label", () => {
  assert.equal(pctText(0.0825), "8.25%");
  assert.equal(pctText(0.1), "10.00%");
  assert.equal(pctText(0), "0.00%");
});

// --- calcTotal: item + tax + shipping --------------------------------------
test("calcTotal: total = item + item*tax + ship", () => {
  const r = calcTotal(100, 10, 0.0825);
  assert.equal(r.tax, 8.25);
  assert.equal(r.total, 118.25);
});

test("calcTotal: missing/zero shipping is treated as 0", () => {
  assert.equal(calcTotal(100, 0, 0.1).total, 110);
  assert.equal(calcTotal(100, undefined, 0.1).total, 110);
});

// --- shipLabel: paid / free / unknown --------------------------------------
test("shipLabel: >0 paid, 0 free, <0 n/a", () => {
  assert.equal(shipLabel(5), "+ $5.00 ship");
  assert.equal(shipLabel(0), "+ free ship");
  assert.equal(shipLabel(-1), "+ ship n/a");
});

// --- clampCount: whole number >= 1 -----------------------------------------
test("clampCount: floors to a whole number, min 1", () => {
  assert.equal(clampCount(3.9), 3);
  assert.equal(clampCount(0), 1);
  assert.equal(clampCount(-4), 1);
  assert.equal(clampCount("abc"), 1);
});

// --- evalExpr: arithmetic, precedence, safety ------------------------------
test("evalExpr: precedence and parentheses", () => {
  assert.equal(evalExpr("2 + 3 * 4"), 14);
  assert.equal(evalExpr("(2 + 3) * 4"), 20);
  assert.equal(evalExpr("-3 + 5"), 2);
  assert.equal(evalExpr("10 / 4"), 2.5);
});

test("evalExpr: division by zero rejected", () => {
  assert.equal(evalExpr("5 / 0"), null);
});

test("evalExpr: malformed / unsafe input rejected", () => {
  assert.equal(evalExpr("2 +"), null); // dangling operator
  assert.equal(evalExpr("(2 + 3"), null); // unbalanced parens
  assert.equal(evalExpr("alert(1)"), null); // illegal chars
  assert.equal(evalExpr(""), null); // no digits
  assert.equal(evalExpr("2 3"), null); // trailing junk
  assert.equal(evalExpr(null), null);
});

// --- readInput: plain numbers vs =formulas ---------------------------------
test("readInput: plain number", () => {
  assert.deepEqual(readInput("42.50"), { isFunction: false, value: 42.5 });
  assert.deepEqual(readInput("$1,299.00"), { isFunction: false, value: 1299 });
});

test("readInput: =formula routes through evalExpr", () => {
  assert.deepEqual(readInput("=2*3"), { isFunction: true, value: 6 });
  assert.deepEqual(readInput("=5/0"), { isFunction: true, value: null });
});

test("readInput: empty and non-numeric", () => {
  assert.deepEqual(readInput(""), { isFunction: false, value: null });
  assert.deepEqual(readInput("  "), { isFunction: false, value: null });
  assert.deepEqual(readInput("abc"), { isFunction: false, value: null });
  assert.deepEqual(readInput(null), { isFunction: false, value: null });
});
