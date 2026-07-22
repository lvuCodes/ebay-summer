// Seam test for the site -> extension calculator bridge. The math itself is
// covered once, in the extension's own suite (test/bid-calc.test.js) — asserting
// it again here would rebuild the duplication the bridge exists to remove. What
// is site-specific, and what actually breaks silently, is the seam: that the
// classic-script import still populates globalThis.ES and still exposes every
// binding demo-controller.ts destructures.
import { test, expect } from "vitest";
import * as calc from "../src/lib/extension-calc.ts";

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

test("bridge: every binding demo-controller.ts imports resolves to a function", () => {
  for (const name of REQUIRED) {
    expect(typeof calc[name], `${name} missing from the bridge`).toBe("function");
  }
});

test("bridge: exports are the extension's own functions, not a re-implementation", () => {
  // globalThis.ES is the extension's namespace, seeded by the side-effect import.
  for (const name of REQUIRED) {
    expect(calc[name], `${name} is not the extension's function`).toBe(globalThis.ES[name]);
  }
});

test("bridge: non-finite money uses the extension's 0.00 guard", () => {
  // The site's old fork rendered "NaN" here. Pinning it catches a regression to
  // any local re-implementation, which would not carry this guard.
  expect(calc.fmtMoney(NaN)).toBe("0.00");
  expect(calc.fmtMoney(undefined)).toBe("0.00");
});

test("bridge: the demo's own call shapes still behave", () => {
  // One spot-check per function the demo calls, guarding signature drift (e.g.
  // shipLabel gaining a required second arg) rather than re-testing the math.
  expect(calc.fmtMoney(1234.5)).toBe("1,234.50");
  expect(calc.pctText(0.0825)).toBe("8.25%");
  expect(calc.calcTotal(100, 10, 0.0825)).toEqual({ tax: 8.25, total: 118.25 });
  expect(calc.shipLabel(0)).toBe("+ free ship");
  expect(calc.shipLabel(-1)).toBe("+ ship n/a");
  expect(calc.clampCount(0)).toBe(1);
  expect(calc.evalExpr("2 + 3 * 4")).toBe(14);
  expect(calc.bidCalcInput("$1,299.00")).toEqual({ isFunction: false, value: 1299 });
});
