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

// The trailing delimiter is a lookahead, not a match: consuming it would swallow
// the space between back-to-back classes in one className, so the second of each
// pair went unseen — ebay-estimation--lg and both bid-calc field variants were
// invisible to this guard while appearing to be covered by it.
function classesIn(text) {
  return new Set([...text.matchAll(/["'\s](ebay-[a-z0-9-]+(?:__[a-z0-9-]+)?(?:--[a-z0-9-]+)?)(?=["'\s])/g)].map((m) => m[1]));
}

for (const file of ["DemoWidgets.jsx", "demo-controller.js"]) {
  test(`DEMO_CLASSES covers every class ${file} names`, () => {
    const missing = [...classesIn(src(`../src/components/${file}`))].filter((c) => !DEMO_CLASSES.has(c));
    assert.deepEqual(missing, [], `${file} names classes absent from DEMO_CLASSES: ${missing}`);
  });
}

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

// The extension stylesheets are commented, and a comment body can hold braces
// and class names — left in, it would be parsed as a rule and its classes would
// decide whether a real selector survives the filter.
test("filter strips comments before splitting into rules", () => {
  const css = "/* .vi-grid { x } */ .ebay-estimation { color: red }";
  assert.equal(filterToDemoClasses(css), ".ebay-estimation { color: red }");
});

test("filter drops empty rules and trailing text outside any block", () => {
  assert.equal(filterToDemoClasses(".ebay-estimation { }"), "");
  assert.equal(filterToDemoClasses(".ebay-estimation"), "");
});

// Relies on the ESM registry having already cached both stylesheet imports, so
// the re-import inside loadWidgetCss is a no-op and cannot repopulate ES. If the
// plugin ever gains a cachebusting import to fix dev-server staleness, this test
// starts passing for the wrong reason and needs rewriting against a stub.
test("loadWidgetCss reports a stylesheet that failed to populate globalThis.ES", async () => {
  const saved = globalThis.ES;
  delete globalThis.ES;
  try {
    await assert.rejects(loadWidgetCss(), /did not populate globalThis\.ES/);
  } finally {
    globalThis.ES = saved;
  }
});

test("the built stylesheet is layered, !important-free, and non-empty", () => {
  assert.match(widgetCss, /^@layer extension \{/);
  assert.doesNotMatch(widgetCss, /!important/);
  assert.match(widgetCss, /\.ebay-bid-calc__input/);
  assert.doesNotMatch(widgetCss, /vi-grid|home-item-carousel|__fxline|--amber/);
});
