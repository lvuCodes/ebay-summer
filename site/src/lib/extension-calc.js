// Bridges the extension's calculator math into the site's ESM world, so the
// landing-page demo and the shipped extension compute from ONE implementation
// instead of two hand-synced ports.
//
// src/calculator/calc.js is a classic script (no exports) that seeds
// globalThis.ES as a side effect — see its IIFE wrapper. Both Vite and Node's
// ESM loader execute it on a bare side-effect import, so re-exporting off the
// namespace afterwards is all the adaptation needed: no bundler for the
// extension, no globals leaking into site code. Import order matters — the
// import is hoisted, so ES is populated before the destructure below runs.
import "../../../src/calculator/calc.js";

const ES = globalThis.ES;

if (!ES || typeof ES.calcTotal !== "function") {
  throw new Error("extension-calc: src/calculator/calc.js did not populate globalThis.ES");
}

export const {
  fmtMoney,
  pctText,
  calcTotal,
  shipLabel,
  clampCount,
  evalExpr,
  bidCalcInput,
  bidCalcParts,
  bidFromTotalParts,
} = ES;
