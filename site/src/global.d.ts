// eBay Σummer. Copyright (C) 2026 lvuCodes. Licensed under GPL-3.0-or-later; see LICENSE.md.

declare module "*.css";
declare module "virtual:extension-widget-css.css";

// The extension's calculator/stylesheets are classic scripts (no exports) that
// seed globalThis.ES as a side effect. They are imported only for that side
// effect, so their modules need no shape beyond being resolvable.
declare module "*/calculator/calc.js";
declare module "*/calculator/css-box.js";
declare module "*/calculator/css-widgets.js";

// Shape of the extension's shared calculator namespace, exposed on globalThis.ES
// by the classic scripts above and re-exported through the bridge modules.
interface ExtensionBidParts {
  isFunction: boolean;
  valid: boolean;
  calcText: string;
  total: number;
  totalNoShip: number;
  sub: string;
  bid?: number;
  belowShipping?: boolean;
}

interface ExtensionCalc {
  fmtMoney(n?: unknown): string;
  pctText(rate: number): string;
  calcTotal(item: number, ship: number, tax: number): { tax: number; total: number };
  shipLabel(ship: number): string;
  clampCount(n: number): number;
  parseCount(v: string): number;
  perUnitText(basis: number, totalNoShip: number | null, count: number): string;
  evalExpr(expr: string): number;
  bidCalcInput(v: string): { isFunction: boolean; value: number };
  bidCalcParts(v: string, ship: number, tax: number): ExtensionBidParts;
  bidFromTotalParts(v: string, ship: number, tax: number): ExtensionBidParts;
  bidPerUnitText(
    total: number,
    totalNoShip: number | null,
    includeShip: boolean,
    count: number,
  ): string;
  BOX_CSS: string;
  WIDGET_CSS: string;
}

// `var` is required for an ambient declaration that also exposes globalThis.ES.
// eslint-disable-next-line no-var
declare var ES: ExtensionCalc | undefined;
