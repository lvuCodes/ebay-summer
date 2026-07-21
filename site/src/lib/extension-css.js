// eBay Σummer. Copyright (C) 2026 lvuCodes. Licensed under GPL-3.0-or-later; see LICENSE.md.
//
// Bridges the extension's widget CSS into the site, the visual counterpart to
// extension-calc.js. css-box.js / css-widgets.js are classic scripts that seed
// globalThis.ES with their stylesheets as template-literal strings, so the same
// side-effect-import trick applies here.
//
// Two transforms make eBay-targeted CSS safe to serve on our own page:
//
//   !important — the extension carries ~314 of them purely to outrank eBay's
//   high-specificity stylesheet. Nothing here needs outranking, and leaving them
//   would make every site override require !important of its own.
//
//   @layer — unlayered declarations beat layered ones at ANY specificity, so
//   wrapping the shared rules in a layer lets index.css override whichever ones
//   are hand-tuned (sizing, box-shadow, the __step:hover tint) without depending
//   on injection order, which differs between Vite dev and the production build.
//
// Roughly half the extension's rules target things this page never renders —
// eBay host containers (.vi-grid, .home-item-carousel, …) and widget variants
// the demo doesn't use (--wide, --amber, __fxline). Shipping them unfiltered
// cost ~6 kB gzip, so selectors are filtered against DEMO_CLASSES below.
//
// The filter is an allowlist, not a denylist: a selector survives only if every
// class it names is one the demo can actually produce. A new extension variant
// therefore drops out on its own instead of needing this list updated, and
// extension-css.test.js pins DEMO_CLASSES against the demo's real sources so
// adding a class to the markup without listing it here fails the build.
// This module is pure — it does NOT import the extension stylesheets itself.
// The extraction runs once in vite.config.js at build time (see loadWidgetCss),
// so the raw CSS strings never enter the JS bundle and the result is emitted as
// a real stylesheet: smaller, preloadable, and no flash of unstyled widgets.

// Every class DemoWidgets.jsx renders or demo-controller.js toggles at runtime.
export const DEMO_CLASSES = new Set([
  "ebay-estimation",
  "ebay-estimation--lg",
  "ebay-estimation__body",
  "ebay-estimation__main",
  "ebay-estimation__label",
  "ebay-estimation__amount",
  "ebay-estimation__flag",
  "ebay-estimation__sub",
  "ebay-estimation__toggle",
  "ebay-estimation__panel",
  "ebay-estimation__stepper",
  "ebay-estimation__step",
  "ebay-estimation__count",
  "ebay-estimation__field-label",
  "ebay-estimation__perunit",
  "ebay-estimation__ship",
  "ebay-estimation__ship-box",
  "ebay-bid-calc",
  "ebay-bid-calc__head",
  "ebay-bid-calc__label",
  "ebay-bid-calc__reset",
  "ebay-bid-calc__row",
  "ebay-bid-calc__field",
  "ebay-bid-calc__field--bid",
  "ebay-bid-calc__field--total",
  "ebay-bid-calc__field--formula",
  "ebay-bid-calc__field--invalid",
  "ebay-bid-calc__field--warn",
  "ebay-bid-calc__dollar",
  "ebay-bid-calc__input",
  "ebay-bid-calc__total",
  "ebay-bid-calc__mid",
  "ebay-bid-calc__arrow",
  "ebay-bid-calc__calc",
  "ebay-bid-calc__total-calc",
  "ebay-bid-calc__total-line",
  "ebay-bid-calc__perunit",
  "ebay-bid-calc__sub",
]);

// The extension stylesheets are flat — no @media/@supports/@keyframes — so
// splitting on "}" is sufficient and avoids pulling in a CSS parser.
export function filterToDemoClasses(css) {
  const out = [];
  for (const block of css.replace(/\/\*[\s\S]*?\*\//g, "").split("}")) {
    const brace = block.indexOf("{");
    if (brace === -1) continue;
    const body = block.slice(brace + 1).trim();
    if (!body) continue;
    const kept = block
      .slice(0, brace)
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && [...s.matchAll(/\.([A-Za-z0-9_-]+)/g)].every((m) => DEMO_CLASSES.has(m[1])));
    if (kept.length) out.push(`${kept.join(", ")} { ${body} }`);
  }
  return out.join("\n");
}

// Build-time only: pulls the extension's stylesheets in via their globalThis.ES
// side effect, then strips and filters them. Called from the Vite plugin, never
// from browser code.
export async function loadWidgetCss() {
  await import("../../../src/calculator/css-box.js");
  await import("../../../src/calculator/css-widgets.js");
  const ES = globalThis.ES;
  if (typeof ES?.BOX_CSS !== "string" || typeof ES?.WIDGET_CSS !== "string") {
    throw new Error("extension-css: the calculator stylesheets did not populate globalThis.ES");
  }
  const stripped = (ES.BOX_CSS + ES.WIDGET_CSS).replace(/\s*!important/g, "");
  return `@layer extension {\n${filterToDemoClasses(stripped)}\n}`;
}
