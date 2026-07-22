// The landing-page demo controller. The math it leans on is covered in
// extension-calc.test.ts; what is untested without this file is the DOM shell —
// which elements get written, the panel/stepper/ship wiring, the bidirectional
// bid<->total sync, and that teardown really unhooks every listener. Driven
// through the extension's dependency-free fake DOM (../../test/fake-dom.cjs).
import { test, expect } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { initDemo } from "../src/components/demo-controller.ts";

const { el } = createRequire(import.meta.url)("../../test/fake-dom.cjs");

// Mirrors the markup DemoWidgets.tsx renders, with the data-* inputs made
// configurable so shipping/tax variants can be exercised.
function fixture({ item = "49.24", ship = "0", tax = "0.0825" } = {}) {
  const input = (cls, value = "") => el("input", { class: cls, value, attrs: { type: "text" } });

  const amount = el("span", { class: "ebay-estimation__amount" });
  const sub = el("span", { class: "ebay-estimation__sub" });
  const perunit = el("div", { class: "ebay-estimation__perunit" });
  const count = input("ebay-estimation__count", "1");
  const stepDown = el("button", { class: "ebay-estimation__step", attrs: { "data-step": "-1" } });
  const stepUp = el("button", { class: "ebay-estimation__step", attrs: { "data-step": "1" } });
  const shipBtn = el("button", {
    class: "ebay-estimation__ship",
    attrs: { "aria-pressed": "true" },
  });
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

  // The placeholders match DemoWidgets.tsx: the bid one is captured at init and
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
// fixture() is a hand-written copy of DemoWidgets.tsx's markup, so on its own it
// would keep passing at 100% coverage after a class rename in the JSX while the
// live page went dead. This reads both sources and asserts every class the
// controller queries still exists in the markup that ships.
test("every selector the controller queries exists in DemoWidgets.tsx", () => {
  const read = (f) => readFileSync(new URL(`../src/components/${f}`, import.meta.url), "utf8");
  const controller = read("demo-controller.ts");
  const widgets = read("DemoWidgets.tsx");

  const selectors = [...controller.matchAll(/querySelector(?:All)?<?[^(]*\("([^"]+)"\)/g)].map(
    (m) => m[1],
  );
  expect(selectors.length).toBeGreaterThanOrEqual(15);

  for (const sel of new Set(selectors)) {
    const cls = sel.replace(/^\./, "");
    // Whole-token match, not a substring: "ebay-estimation__step" occurs inside
    // "ebay-estimation__stepper", so a plain includes() would keep passing after
    // the step buttons were deleted and the stepper wrapper left behind.
    const present = new RegExp(`(?<![\\w-])${cls}(?![\\w-])`).test(widgets);
    expect(present, `DemoWidgets.tsx no longer renders "${sel}"`).toBe(true);
  }
});

// --- guard clause ----------------------------------------------------------
test("initDemo: a missing root yields a callable no-op teardown", () => {
  expect(() => initDemo(null, null)()).not.toThrow();
  expect(() => initDemo(fixture().box, null)()).not.toThrow();
});

// --- estimation box: initial paint -----------------------------------------
test("initDemo: paints the landed total, and flags free shipping", () => {
  const f = mount();
  expect(f.amount.innerHTML).toMatch(/^US \$53\.30 /);
  expect(f.amount.innerHTML).toMatch(/ebay-estimation__flag/);
  expect(f.sub.textContent).toBe("US $49.24 + (8.25% tax → $4.06) + free ship");
});

test("initDemo: paid shipping is priced in and carries no free-ship flag", () => {
  const f = mount({ item: "100", ship: "10", tax: "0.10" });
  expect(f.amount.innerHTML).toBe("US $120.00");
  expect(f.sub.textContent).toBe("US $100.00 + (10.00% tax → $10.00) + $10.00 ship");
});

// --- estimation box: per-unit panel ----------------------------------------
test("toggle: opening reveals the panel and flips the affordance", () => {
  const f = plain();
  f.toggle.dispatch("click");
  expect(f.panel.hasAttribute("hidden")).toBe(false);
  expect(f.toggle.textContent).toBe("⏴");
  expect(f.toggle.getAttribute("aria-expanded")).toBe("true");
  expect(f.perunit.textContent).toBe("1 @ $100.00/unit");

  f.toggle.dispatch("click");
  expect(f.panel.hasAttribute("hidden")).toBe(true);
  expect(f.toggle.textContent).toBe("⏵");
  expect(f.toggle.getAttribute("aria-expanded")).toBe("false");
});

test("count input: divides the total across the typed count", () => {
  const f = plain();
  f.count.value = "4";
  f.count.dispatch("input");
  expect(f.perunit.textContent).toBe("4 @ $25.00/unit");
});

test("count input: a =formula count is evaluated", () => {
  const f = plain();
  f.count.value = "=2*2";
  f.count.dispatch("input");
  expect(f.perunit.textContent).toBe("4 @ $25.00/unit");
});

test("count change/blur: commits the clamped value back into the field", () => {
  const f = plain();
  f.count.value = "0";
  f.count.dispatch("change");
  expect(f.count.value).toBe("1");
  expect(f.perunit.textContent).toBe("1 @ $100.00/unit");

  f.count.value = "junk";
  f.count.dispatch("blur");
  expect(f.count.value).toBe("1");
});

test("steppers: step the count and never fall below one", () => {
  const f = plain();
  f.stepUp.dispatch("click");
  expect(f.count.value).toBe("2");
  expect(f.perunit.textContent).toBe("2 @ $50.00/unit");

  f.stepDown.dispatch("click");
  f.stepDown.dispatch("click");
  expect(f.count.value).toBe("1");
});

test("ship toggle: swaps the per-unit basis between incl. and excl. shipping", () => {
  const f = plain({ ship: "20" });
  f.count.value = "2";
  f.count.dispatch("input");
  expect(f.perunit.textContent).toBe("2 @ $60.00/unit (incl. ship)");

  f.shipBtn.dispatch("click");
  expect(f.shipBtn.getAttribute("aria-pressed")).toBe("false");
  expect(f.perunit.textContent).toBe("2 @ $50.00/unit (excl. ship)");

  f.shipBtn.dispatch("click");
  expect(f.shipBtn.getAttribute("aria-pressed")).toBe("true");
  expect(f.perunit.textContent).toBe("2 @ $60.00/unit (incl. ship)");
});

test("ship toggle: free shipping adds no incl./excl. note", () => {
  const f = plain();
  f.toggle.dispatch("click");
  expect(f.perunit.textContent).toBe("1 @ $100.00/unit");

  // The toggle still flips its own pressed state, but with nothing to include
  // or exclude the per-unit line must stay noteless.
  f.shipBtn.dispatch("click");
  expect(f.shipBtn.getAttribute("aria-pressed")).toBe("false");
  expect(f.perunit.textContent).toBe("1 @ $100.00/unit");
});

// --- bid calculator: bid -> total ------------------------------------------
test("bid input: computes the landed total and its tax breakdown", () => {
  const f = mount({ item: "100", ship: "10", tax: "0.10" });
  f.bidIn.value = "50";
  f.bidIn.dispatch("input");
  expect(f.totIn.value).toBe("65.00");
  expect(f.bidSubEl.textContent).toBe("incl. 10.00% tax ($5.00) + $10.00 ship");
});

test("bid input: a =formula echoes its value and marks the field", () => {
  const f = plain();
  f.bidIn.value = "=2*4";
  f.bidIn.dispatch("input");
  expect(f.calcEl.hasAttribute("hidden")).toBe(false);
  expect(f.calcEl.textContent).toBe("= $8.00");
  expect(f.totIn.value).toBe("8.00");
  expect(f.bidField.classList.contains("ebay-bid-calc__field--formula")).toBe(true);
});

test("bid input: unparseable text invalidates the field and clears the total", () => {
  const f = plain();
  f.bidIn.value = "abc";
  f.bidIn.dispatch("input");
  expect(f.totIn.value).toBe("");
  expect(f.bidIn.classList.contains("ebay-bid-calc__field--invalid")).toBe(true);
  expect(f.calcEl.hasAttribute("hidden")).toBe(true);
});

test("bid input: an empty field is not flagged invalid", () => {
  const f = plain();
  f.bidIn.value = "";
  f.bidIn.dispatch("input");
  expect(f.bidIn.classList.contains("ebay-bid-calc__field--invalid")).toBe(false);
  expect(f.bidSubEl.textContent).toBe("incl. 0.00% tax + free ship");
});

// --- bid calculator: total -> bid ------------------------------------------
test("total input: back-solves the bid from a target landed total", () => {
  const f = mount({ item: "100", ship: "10", tax: "0.10" });
  f.totIn.value = "65";
  f.totIn.dispatch("input");
  expect(f.bidIn.value).toBe("50.00");
  expect(f.bidSubEl.textContent).toBe("incl. 10.00% tax ($5.00) + $10.00 ship");
});

test("total input: a target under the shipping cost is called out", () => {
  const f = mount({ item: "100", ship: "10", tax: "0.10" });
  f.totIn.value = "5";
  f.totIn.dispatch("input");
  expect(f.bidIn.value).toBe("");
  expect(f.bidSubEl.textContent).toBe("target below $10.00 shipping");
});

test("total input: a =formula echoes on the total side only", () => {
  const f = plain();
  f.totIn.value = "=10+5";
  f.totIn.dispatch("input");
  expect(f.totalCalcEl.hasAttribute("hidden")).toBe(false);
  expect(f.totalCalcEl.textContent).toBe("= $15.00");
  expect(f.calcEl.hasAttribute("hidden")).toBe(true);
  expect(f.bidIn.value).toBe("15.00");
  expect(f.totalField.classList.contains("ebay-bid-calc__field--formula")).toBe(true);
});

// A target below shipping is refused, not calculated. The formula echo stays
// hidden even though "=2+3" parses fine: echoing "= $5.00" would present a
// resolved value for an input that yields no bid. Mirrors bid-calc.js:151-167.
test("total input: a =formula below the shipping cost is refused, not echoed", () => {
  const f = mount({ item: "100", ship: "10", tax: "0.10" });
  f.totIn.value = "=2+3";
  f.totIn.dispatch("input");
  expect(f.totalCalcEl.hasAttribute("hidden")).toBe(true);
  expect(f.bidIn.value).toBe("");
  expect(f.bidSubEl.textContent).toBe("target below $10.00 shipping");
});

test("total input: a below-shipping target warns on both fields", () => {
  const f = mount({ item: "100", ship: "10", tax: "0.10" });
  f.totIn.value = "5";
  f.totIn.dispatch("input");
  expect(f.bidIn.getAttribute("placeholder")).toBe("⚠️ target ≤ shipping");
  expect(f.bidIn.classList.contains("ebay-bid-calc__field--warn")).toBe(true);
  expect(f.totIn.classList.contains("ebay-bid-calc__field--warn")).toBe(true);
  expect(f.totIn.classList.contains("ebay-bid-calc__field--invalid")).toBe(true);
});

test("total input: a workable target clears the warning and restores the hint", () => {
  const f = mount({ item: "100", ship: "10", tax: "0.10" });
  f.totIn.value = "5";
  f.totIn.dispatch("input");
  f.totIn.value = "65";
  f.totIn.dispatch("input");
  expect(f.bidIn.getAttribute("placeholder")).toBe("bid or =2*4");
  expect(f.bidIn.classList.contains("ebay-bid-calc__field--warn")).toBe(false);
  expect(f.totIn.classList.contains("ebay-bid-calc__field--warn")).toBe(false);
  expect(f.bidIn.value).toBe("50.00");
});

test("total input: unparseable text invalidates the total and clears the bid", () => {
  const f = plain();
  f.totIn.value = "abc";
  f.totIn.dispatch("input");
  expect(f.bidIn.value).toBe("");
  expect(f.totIn.classList.contains("ebay-bid-calc__field--invalid")).toBe(true);
});

// --- bid calculator: per-unit readout --------------------------------------
test("bid per-unit: stays hidden until the panel is opened", () => {
  const f = plain();
  f.bidIn.value = "100";
  f.bidIn.dispatch("input");
  expect(f.bidPerEl.hasAttribute("hidden")).toBe(true);

  f.toggle.dispatch("click");
  expect(f.bidPerEl.hasAttribute("hidden")).toBe(false);
  expect(f.bidPerEl.textContent).toBe("($100.00/unit)");
});

test("bid per-unit: follows the count and the shipping basis", () => {
  const f = plain({ ship: "20" });
  f.bidIn.value = "80";
  f.bidIn.dispatch("input");
  f.count.value = "2";
  f.count.dispatch("input");
  expect(f.bidPerEl.textContent).toBe("($50.00/unit)");

  f.shipBtn.dispatch("click");
  expect(f.bidPerEl.textContent).toBe("($40.00/unit)");
});

test("bid per-unit: re-hides when the bid becomes invalid", () => {
  const f = plain();
  f.toggle.dispatch("click");
  f.bidIn.value = "100";
  f.bidIn.dispatch("input");
  expect(f.bidPerEl.hasAttribute("hidden")).toBe(false);

  f.bidIn.value = "abc";
  f.bidIn.dispatch("input");
  expect(f.bidPerEl.hasAttribute("hidden")).toBe(true);
});

// --- reset + teardown ------------------------------------------------------
test("reset: clears both fields and refocuses the bid", () => {
  const f = plain();
  f.bidIn.value = "50";
  f.bidIn.dispatch("input");
  f.reset.dispatch("click");
  expect(f.bidIn.value).toBe("");
  expect(f.totIn.value).toBe("");
  expect(f.bidIn._focused).toBe(true);
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

  expect(f.panel.hasAttribute("hidden")).toBe(before.panelHidden);
  expect(f.perunit.textContent).toBe(before.perunit);
  expect(f.count.value).toBe("9");
  expect(f.bidIn.value).toBe("50");
  expect(f.totIn.value).toBe("75");
});
