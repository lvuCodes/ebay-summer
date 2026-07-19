// The landing-page demo controller. The math it leans on is covered in
// demo-calc.test.js; what is untested without this file is the DOM shell —
// which elements get written, the panel/stepper/ship wiring, the bidirectional
// bid<->total sync, and that teardown really unhooks every listener. Driven
// through the extension's dependency-free fake DOM (../../test/fake-dom.cjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { initDemo } from "../src/components/demo-controller.js";

const { el } = createRequire(import.meta.url)("../../test/fake-dom.cjs");

// Mirrors the markup DemoWidgets.jsx renders, with the data-* inputs made
// configurable so shipping/tax variants can be exercised.
function fixture({ item = "49.24", ship = "0", tax = "0.0825" } = {}) {
  const input = (cls, value = "") => el("input", { class: cls, value, attrs: { type: "text" } });

  const amount = el("span", { class: "ebay-estimation__amount" });
  const sub = el("span", { class: "ebay-estimation__sub" });
  const perunit = el("div", { class: "ebay-estimation__perunit" });
  const count = input("ebay-estimation__count", "1");
  const stepDown = el("button", { class: "ebay-estimation__step", attrs: { "data-step": "-1" } });
  const stepUp = el("button", { class: "ebay-estimation__step", attrs: { "data-step": "1" } });
  const shipBtn = el("button", { class: "ebay-estimation__ship", attrs: { "aria-pressed": "true" } });
  const panel = el("div", {
    class: "ebay-estimation__panel",
    attrs: { hidden: "" },
    children: [stepDown, count, stepUp, perunit, shipBtn],
  });
  const toggle = el("button", {
    class: "ebay-estimation__toggle",
    text: "⏵",
    attrs: { "aria-expanded": "false" },
  });
  const box = el("div", {
    class: "ebay-estimation ebay-estimation--lg",
    attrs: { "data-item": item, "data-ship": ship, "data-tax": tax },
    children: [
      el("div", {
        class: "ebay-estimation__body",
        children: [el("div", { class: "ebay-estimation__main", children: [amount, sub] }), panel],
      }),
      toggle,
    ],
  });

  // The placeholders match DemoWidgets.jsx: the bid one is captured at init and
  // restored after a below-shipping warning, so a bare fixture would not catch a
  // regression in that round-trip.
  const bidIn = input("ebay-bid-calc__input");
  bidIn.setAttribute("placeholder", "bid or =2*4");
  const totIn = input("ebay-bid-calc__total");
  totIn.setAttribute("placeholder", "target total");
  const calcEl = el("span", { class: "ebay-bid-calc__calc", attrs: { hidden: "" } });
  const totalCalcEl = el("span", { class: "ebay-bid-calc__total-calc", attrs: { hidden: "" } });
  const bidPerEl = el("span", { class: "ebay-bid-calc__perunit", attrs: { hidden: "" } });
  const bidSubEl = el("span", { class: "ebay-bid-calc__sub" });
  const reset = el("button", { class: "ebay-bid-calc__reset" });
  const bidField = el("span", {
    class: "ebay-bid-calc__field ebay-bid-calc__field--bid",
    children: [bidIn],
  });
  const totalField = el("span", {
    class: "ebay-bid-calc__field ebay-bid-calc__field--total",
    children: [totIn],
  });
  const calc = el("div", {
    class: "ebay-bid-calc",
    children: [
      el("div", { class: "ebay-bid-calc__head", children: [reset] }),
      el("div", {
        class: "ebay-bid-calc__row",
        children: [
          bidField,
          el("span", { class: "ebay-bid-calc__mid", children: [calcEl] }),
          el("span", {
            class: "ebay-bid-calc__total-line",
            children: [totalField, totalCalcEl, bidPerEl],
          }),
          bidSubEl,
        ],
      }),
    ],
  });

  return {
    box,
    calc,
    amount,
    sub,
    panel,
    toggle,
    count,
    perunit,
    shipBtn,
    stepUp,
    stepDown,
    bidIn,
    totIn,
    bidField,
    totalField,
    calcEl,
    totalCalcEl,
    bidPerEl,
    bidSubEl,
    reset,
  };
}

// Wire a fixture and return it alongside its teardown.
function mount(opts) {
  const f = fixture(opts);
  return { ...f, teardown: initDemo(f.box, f.calc) };
}

// Round-number listing: $100, no tax, free shipping — so an assertion states the
// behavior under test rather than the arithmetic. Override one field to vary it.
const plain = (opts) => mount({ item: "100", ship: "0", tax: "0", ...opts });

// --- fixture drift guard ---------------------------------------------------
// fixture() is a hand-written copy of DemoWidgets.jsx's markup, so on its own it
// would keep passing at 100% coverage after a class rename in the JSX while the
// live page went dead. This reads both sources and asserts every class the
// controller queries still exists in the markup that ships.
test("every selector the controller queries exists in DemoWidgets.jsx", () => {
  const read = (f) => readFileSync(new URL(`../src/components/${f}`, import.meta.url), "utf8");
  const controller = read("demo-controller.js");
  const widgets = read("DemoWidgets.jsx");

  const selectors = [...controller.matchAll(/querySelector(?:All)?\("([^"]+)"\)/g)].map((m) => m[1]);
  assert.ok(selectors.length >= 15, `expected the controller to query many classes, saw ${selectors.length}`);

  for (const sel of new Set(selectors)) {
    const cls = sel.replace(/^\./, "");
    // Whole-token match, not a substring: "ebay-estimation__step" occurs inside
    // "ebay-estimation__stepper", so a plain includes() would keep passing after
    // the step buttons were deleted and the stepper wrapper left behind.
    const present = new RegExp(`(?<![\\w-])${cls}(?![\\w-])`).test(widgets);
    assert.ok(present, `DemoWidgets.jsx no longer renders "${sel}", which demo-controller.js queries`);
  }
});

// --- guard clause ----------------------------------------------------------
test("initDemo: a missing root yields a callable no-op teardown", () => {
  assert.doesNotThrow(() => initDemo(null, null)());
  assert.doesNotThrow(() => initDemo(fixture().box, null)());
});

// --- estimation box: initial paint -----------------------------------------
test("initDemo: paints the landed total, and flags free shipping", () => {
  const f = mount();
  assert.match(f.amount.innerHTML, /^US \$53\.30 /);
  assert.match(f.amount.innerHTML, /ebay-estimation__flag/);
  assert.equal(f.sub.textContent, "US $49.24 + (8.25% tax → $4.06) + free ship");
});

test("initDemo: paid shipping is priced in and carries no free-ship flag", () => {
  const f = mount({ item: "100", ship: "10", tax: "0.10" });
  assert.equal(f.amount.innerHTML, "US $120.00");
  assert.equal(f.sub.textContent, "US $100.00 + (10.00% tax → $10.00) + $10.00 ship");
});

// --- estimation box: per-unit panel ----------------------------------------
test("toggle: opening reveals the panel and flips the affordance", () => {
  const f = plain();
  f.toggle.dispatch("click");
  assert.equal(f.panel.hasAttribute("hidden"), false);
  assert.equal(f.toggle.textContent, "⏴");
  assert.equal(f.toggle.getAttribute("aria-expanded"), "true");
  assert.equal(f.perunit.textContent, "1 @ $100.00/unit");

  f.toggle.dispatch("click");
  assert.equal(f.panel.hasAttribute("hidden"), true);
  assert.equal(f.toggle.textContent, "⏵");
  assert.equal(f.toggle.getAttribute("aria-expanded"), "false");
});

test("count input: divides the total across the typed count", () => {
  const f = plain();
  f.count.value = "4";
  f.count.dispatch("input");
  assert.equal(f.perunit.textContent, "4 @ $25.00/unit");
});

test("count input: a =formula count is evaluated", () => {
  const f = plain();
  f.count.value = "=2*2";
  f.count.dispatch("input");
  assert.equal(f.perunit.textContent, "4 @ $25.00/unit");
});

test("count change/blur: commits the clamped value back into the field", () => {
  const f = plain();
  f.count.value = "0";
  f.count.dispatch("change");
  assert.equal(f.count.value, "1");
  assert.equal(f.perunit.textContent, "1 @ $100.00/unit");

  f.count.value = "junk";
  f.count.dispatch("blur");
  assert.equal(f.count.value, "1");
});

test("steppers: step the count and never fall below one", () => {
  const f = plain();
  f.stepUp.dispatch("click");
  assert.equal(f.count.value, "2");
  assert.equal(f.perunit.textContent, "2 @ $50.00/unit");

  f.stepDown.dispatch("click");
  f.stepDown.dispatch("click");
  assert.equal(f.count.value, "1");
});

test("ship toggle: swaps the per-unit basis between incl. and excl. shipping", () => {
  const f = plain({ ship: "20" });
  f.count.value = "2";
  f.count.dispatch("input");
  assert.equal(f.perunit.textContent, "2 @ $60.00/unit (incl. ship)");

  f.shipBtn.dispatch("click");
  assert.equal(f.shipBtn.getAttribute("aria-pressed"), "false");
  assert.equal(f.perunit.textContent, "2 @ $50.00/unit (excl. ship)");

  f.shipBtn.dispatch("click");
  assert.equal(f.shipBtn.getAttribute("aria-pressed"), "true");
  assert.equal(f.perunit.textContent, "2 @ $60.00/unit (incl. ship)");
});

test("ship toggle: free shipping adds no incl./excl. note", () => {
  const f = plain();
  f.toggle.dispatch("click");
  assert.equal(f.perunit.textContent, "1 @ $100.00/unit");

  // The toggle still flips its own pressed state, but with nothing to include
  // or exclude the per-unit line must stay noteless.
  f.shipBtn.dispatch("click");
  assert.equal(f.shipBtn.getAttribute("aria-pressed"), "false");
  assert.equal(f.perunit.textContent, "1 @ $100.00/unit");
});

// --- bid calculator: bid -> total ------------------------------------------
test("bid input: computes the landed total and its tax breakdown", () => {
  const f = mount({ item: "100", ship: "10", tax: "0.10" });
  f.bidIn.value = "50";
  f.bidIn.dispatch("input");
  assert.equal(f.totIn.value, "65.00");
  assert.equal(f.bidSubEl.textContent, "incl. 10.00% tax ($5.00) + $10.00 ship");
});

test("bid input: a =formula echoes its value and marks the field", () => {
  const f = plain();
  f.bidIn.value = "=2*4";
  f.bidIn.dispatch("input");
  assert.equal(f.calcEl.hasAttribute("hidden"), false);
  assert.equal(f.calcEl.textContent, "= $8.00");
  assert.equal(f.totIn.value, "8.00");
  assert.equal(f.bidField.classList.contains("ebay-bid-calc__field--formula"), true);
});

test("bid input: unparseable text invalidates the field and clears the total", () => {
  const f = plain();
  f.bidIn.value = "abc";
  f.bidIn.dispatch("input");
  assert.equal(f.totIn.value, "");
  assert.equal(f.bidIn.classList.contains("ebay-bid-calc__field--invalid"), true);
  assert.equal(f.calcEl.hasAttribute("hidden"), true);
});

test("bid input: an empty field is not flagged invalid", () => {
  const f = plain();
  f.bidIn.value = "";
  f.bidIn.dispatch("input");
  assert.equal(f.bidIn.classList.contains("ebay-bid-calc__field--invalid"), false);
  assert.equal(f.bidSubEl.textContent, "incl. 0.00% tax + free ship");
});

// --- bid calculator: total -> bid ------------------------------------------
test("total input: back-solves the bid from a target landed total", () => {
  const f = mount({ item: "100", ship: "10", tax: "0.10" });
  f.totIn.value = "65";
  f.totIn.dispatch("input");
  assert.equal(f.bidIn.value, "50.00");
  assert.equal(f.bidSubEl.textContent, "incl. 10.00% tax ($5.00) + $10.00 ship");
});

test("total input: a target under the shipping cost is called out", () => {
  const f = mount({ item: "100", ship: "10", tax: "0.10" });
  f.totIn.value = "5";
  f.totIn.dispatch("input");
  assert.equal(f.bidIn.value, "");
  assert.equal(f.bidSubEl.textContent, "target below $10.00 shipping");
});

test("total input: a =formula echoes on the total side only", () => {
  const f = plain();
  f.totIn.value = "=10+5";
  f.totIn.dispatch("input");
  assert.equal(f.totalCalcEl.hasAttribute("hidden"), false);
  assert.equal(f.totalCalcEl.textContent, "= $15.00");
  assert.equal(f.calcEl.hasAttribute("hidden"), true);
  assert.equal(f.bidIn.value, "15.00");
  assert.equal(f.totalField.classList.contains("ebay-bid-calc__field--formula"), true);
});

// A target below shipping is refused, not calculated. The formula echo stays
// hidden even though "=2+3" parses fine: echoing "= $5.00" would present a
// resolved value for an input that yields no bid. Mirrors bid-calc.js:151-167.
test("total input: a =formula below the shipping cost is refused, not echoed", () => {
  const f = mount({ item: "100", ship: "10", tax: "0.10" });
  f.totIn.value = "=2+3";
  f.totIn.dispatch("input");
  assert.equal(f.totalCalcEl.hasAttribute("hidden"), true);
  assert.equal(f.bidIn.value, "");
  assert.equal(f.bidSubEl.textContent, "target below $10.00 shipping");
});

test("total input: a below-shipping target warns on both fields", () => {
  const f = mount({ item: "100", ship: "10", tax: "0.10" });
  f.totIn.value = "5";
  f.totIn.dispatch("input");
  assert.equal(f.bidIn.getAttribute("placeholder"), "⚠️ target ≤ shipping");
  assert.equal(f.bidIn.classList.contains("ebay-bid-calc__field--warn"), true);
  assert.equal(f.totIn.classList.contains("ebay-bid-calc__field--warn"), true);
  assert.equal(f.totIn.classList.contains("ebay-bid-calc__field--invalid"), true);
});

test("total input: a workable target clears the warning and restores the hint", () => {
  const f = mount({ item: "100", ship: "10", tax: "0.10" });
  f.totIn.value = "5";
  f.totIn.dispatch("input");
  f.totIn.value = "65";
  f.totIn.dispatch("input");
  assert.equal(f.bidIn.getAttribute("placeholder"), "bid or =2*4");
  assert.equal(f.bidIn.classList.contains("ebay-bid-calc__field--warn"), false);
  assert.equal(f.totIn.classList.contains("ebay-bid-calc__field--warn"), false);
  assert.equal(f.bidIn.value, "50.00");
});

test("total input: unparseable text invalidates the total and clears the bid", () => {
  const f = plain();
  f.totIn.value = "abc";
  f.totIn.dispatch("input");
  assert.equal(f.bidIn.value, "");
  assert.equal(f.totIn.classList.contains("ebay-bid-calc__field--invalid"), true);
});

// --- bid calculator: per-unit readout --------------------------------------
test("bid per-unit: stays hidden until the panel is opened", () => {
  const f = plain();
  f.bidIn.value = "100";
  f.bidIn.dispatch("input");
  assert.equal(f.bidPerEl.hasAttribute("hidden"), true);

  f.toggle.dispatch("click");
  assert.equal(f.bidPerEl.hasAttribute("hidden"), false);
  assert.equal(f.bidPerEl.textContent, "($100.00/unit)");
});

test("bid per-unit: follows the count and the shipping basis", () => {
  const f = plain({ ship: "20" });
  f.bidIn.value = "80";
  f.bidIn.dispatch("input");
  f.count.value = "2";
  f.count.dispatch("input");
  assert.equal(f.bidPerEl.textContent, "($50.00/unit)");

  f.shipBtn.dispatch("click");
  assert.equal(f.bidPerEl.textContent, "($40.00/unit)");
});

test("bid per-unit: re-hides when the bid becomes invalid", () => {
  const f = plain();
  f.toggle.dispatch("click");
  f.bidIn.value = "100";
  f.bidIn.dispatch("input");
  assert.equal(f.bidPerEl.hasAttribute("hidden"), false);

  f.bidIn.value = "abc";
  f.bidIn.dispatch("input");
  assert.equal(f.bidPerEl.hasAttribute("hidden"), true);
});

// --- reset + teardown ------------------------------------------------------
test("reset: clears both fields and refocuses the bid", () => {
  const f = plain();
  f.bidIn.value = "50";
  f.bidIn.dispatch("input");
  f.reset.dispatch("click");
  assert.equal(f.bidIn.value, "");
  assert.equal(f.totIn.value, "");
  assert.equal(f.bidIn._focused, true);
});

test("teardown: every listener is unhooked, so the DOM goes inert", () => {
  const f = plain();
  f.teardown();

  const before = {
    panelHidden: f.panel.hasAttribute("hidden"),
    perunit: f.perunit.textContent,
    total: f.totIn.value,
  };
  // Every event initDemo wires, not just a sample — a teardown that misses one
  // registration should fail here rather than pass on the ones it did unhook.
  f.toggle.dispatch("click");
  f.stepUp.dispatch("click");
  f.stepDown.dispatch("click");
  f.shipBtn.dispatch("click");
  f.reset.dispatch("click");
  f.count.value = "9";
  f.count.dispatch("input");
  f.count.dispatch("change");
  f.count.dispatch("blur");
  f.bidIn.value = "50";
  f.bidIn.dispatch("input");
  f.totIn.value = "75";
  f.totIn.dispatch("input");

  assert.equal(f.panel.hasAttribute("hidden"), before.panelHidden);
  assert.equal(f.perunit.textContent, before.perunit);
  assert.equal(f.count.value, "9");
  assert.equal(f.bidIn.value, "50");
  assert.equal(f.totIn.value, "75");
});
