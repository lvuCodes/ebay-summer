// Seam test for the site -> extension calculator bridge. The math itself is
// covered once, in the extension's own suite (test/bid-calc.test.js) — asserting
// it again here would rebuild the duplication the bridge exists to remove. What
// is site-specific, and what actually breaks silently, is the seam: that the
// classic-script import still populates globalThis.ES and still exposes every
// binding demo-controller.js destructures.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as calc from "../src/lib/extension-calc.js";

const REQUIRED = [
  "fmtMoney",
  "pctText",
  "calcTotal",
  "shipLabel",
  "clampCount",
  "evalExpr",
  "bidCalcInput",
  "bidCalcParts",
  "bidFromTotalParts",
];

test("bridge: every binding demo-controller.js imports resolves to a function", () => {
  for (const name of REQUIRED) {
    assert.equal(typeof calc[name], "function", `${name} missing from the bridge`);
  }
});

test("bridge: exports are the extension's own functions, not a re-implementation", () => {
  // globalThis.ES is the extension's namespace, seeded by the side-effect import.
  for (const name of REQUIRED) {
    assert.equal(calc[name], globalThis.ES[name], `${name} is not the extension's function`);
  }
});

test("bridge: non-finite money uses the extension's 0.00 guard", () => {
  // The site's old fork rendered "NaN" here. Pinning it catches a regression to
  // any local re-implementation, which would not carry this guard.
  assert.equal(calc.fmtMoney(NaN), "0.00");
  assert.equal(calc.fmtMoney(undefined), "0.00");
});

test("bridge: the demo's own call shapes still behave", () => {
  // One spot-check per function the demo calls, guarding signature drift (e.g.
  // shipLabel gaining a required second arg) rather than re-testing the math.
  assert.equal(calc.fmtMoney(1234.5), "1,234.50");
  assert.equal(calc.pctText(0.0825), "8.25%");
  assert.deepEqual(calc.calcTotal(100, 10, 0.0825), { tax: 8.25, total: 118.25 });
  assert.equal(calc.shipLabel(0), "+ free ship");
  assert.equal(calc.shipLabel(-1), "+ ship n/a");
  assert.equal(calc.clampCount(0), 1);
  assert.equal(calc.evalExpr("2 + 3 * 4"), 14);
  assert.deepEqual(calc.bidCalcInput("$1,299.00"), { isFunction: false, value: 1299 });
});
