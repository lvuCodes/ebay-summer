// Seam test for the site -> extension CSS bridge. Like extension-calc.test.js,
// this does not re-test the extension's styling; it pins the two transforms the
// site applies (strip !important, filter to demo classes) and — most importantly
// — keeps DEMO_CLASSES honest against the demo's actual markup, since a stale
// allowlist would silently drop a widget's styling from the built page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DEMO_CLASSES, filterToDemoClasses, loadWidgetCss } from "../src/lib/extension-css.js";

const widgetCss = await loadWidgetCss();

const src = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

function classesIn(text) {
  return new Set([...text.matchAll(/["'\s](ebay-[a-z0-9-]+(?:__[a-z0-9-]+)?(?:--[a-z0-9-]+)?)["'\s]/g)].map((m) => m[1]));
}

test("DEMO_CLASSES covers every class the demo markup renders", () => {
  const rendered = classesIn(src("../src/components/DemoWidgets.jsx"));
  const missing = [...rendered].filter((c) => !DEMO_CLASSES.has(c));
  assert.deepEqual(missing, [], `DemoWidgets.jsx renders classes absent from DEMO_CLASSES: ${missing}`);
});

test("DEMO_CLASSES covers every class the controller toggles at runtime", () => {
  const toggled = classesIn(src("../src/components/demo-controller.js"));
  const missing = [...toggled].filter((c) => !DEMO_CLASSES.has(c));
  assert.deepEqual(missing, [], `demo-controller.js toggles classes absent from DEMO_CLASSES: ${missing}`);
});

test("filter keeps selectors whose classes the demo produces", () => {
  const css = ".ebay-estimation { color: red } .ebay-estimation__amount { font-size: 1rem }";
  const out = filterToDemoClasses(css);
  assert.match(out, /\.ebay-estimation \{/);
  assert.match(out, /\.ebay-estimation__amount \{/);
});

test("filter drops eBay host selectors and unused variants", () => {
  const css = ".vi-grid .ebay-estimation { color: red } .ebay-bid-calc__fxline { display: none }";
  assert.equal(filterToDemoClasses(css), "");
});

test("filter keeps the usable half of a comma-separated selector list", () => {
  const css = ".ebay-estimation--wide .ebay-estimation__main, .ebay-estimation__main { min-width: 0 }";
  const out = filterToDemoClasses(css);
  assert.match(out, /^\.ebay-estimation__main \{/);
  assert.doesNotMatch(out, /--wide/);
});

test("the built stylesheet is layered, !important-free, and non-empty", () => {
  assert.match(widgetCss, /^@layer extension \{/);
  assert.doesNotMatch(widgetCss, /!important/);
  assert.match(widgetCss, /\.ebay-bid-calc__input/);
  assert.doesNotMatch(widgetCss, /vi-grid|home-item-carousel|__fxline|--amber/);
});
