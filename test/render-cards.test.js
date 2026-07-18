// Search-result card selectors and box placement, against both eBay markups.
//
// eBay reskinned the result card in July 2026 (.su-item-card -> .s-card, price
// moved out of .su-item-card__price-container into a .s-card__attribute-row).
// Nothing here caught it: the card selectors had no unit test, and the only real
// markup on hand was a snapshot taken before the change, so every check kept
// passing while boxes silently stopped appearing on live search for every
// released version.
//
// These tests cover the seam that broke — which cards are found, where their
// price is read from, and where the box is inserted — for BOTH variants, so a
// refactor cannot quietly drop support for one. They do NOT call makeBox (that
// needs a real DOM; see the totals tests for the box's own contents), and they
// cannot detect a FUTURE eBay reskin: that still needs a fresh page capture.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { makeDoc, installGlobals, el } = require("./fake-dom.cjs");

installGlobals();
const ES = require("./load-es.js");

// A card in the pre-July-2026 markup: price inside a __price-container, with
// .su-item-card__header as the insert anchor.
function oldCard(price, shipText) {
  const kids = [
    el("div", {
      class: "su-item-card__header", children: [
        el("div", { class: "su-item-card__title", text: "A thing" }),
      ]
    }),
    el("div", {
      class: "su-item-card__price-container", children: [
        el("span", { class: "su-item-card__price", text: price }),
      ]
    }),
  ];
  if (shipText) kids.push(el("div", { children: [el("span", { text: shipText })] }));
  return el("li", {
    class: "su-item-card", children: [
      el("div", { class: "su-card-container__content", children: kids }),
    ]
  });
}

// A card in the current markup: price in an attribute row, header supplied only
// by the shared .su-card-container__header wrapper.
function newCard(price, shipText) {
  const rows = [
    el("div", {
      class: "s-card__attribute-row", children: [
        el("span", { class: "s-card__price", text: price }),
      ]
    }),
  ];
  if (shipText) {
    rows.push(el("div", {
      class: "s-card__attribute-row", children: [
        el("span", { text: shipText }),
      ]
    }));
  }
  return el("li", {
    class: "s-card s-card--vertical", children: [
      el("div", {
        class: "su-card-container__content", children: [
          el("div", {
            class: "su-card-container__header", children: [
              el("div", { class: "s-card__title", text: "A thing" }),
            ]
          }),
          el("div", { class: "su-card-container__attributes", children: rows }),
        ]
      }),
    ]
  });
}

function pageOf(cards) {
  const doc = makeDoc();
  global.document = doc;
  cards.forEach((c) => doc.body.appendChild(c));
  return doc;
}

test("the card selector matches both the old and the reskinned markup", () => {
  assert.ok(ES.CARD_SEL.includes(".su-item-card"), "old card class dropped from CARD_SEL");
  assert.ok(ES.CARD_SEL.includes(".s-card"), "reskinned card class missing from CARD_SEL");
  assert.ok(ES.CARD_PRICE_SEL.includes(".su-item-card__price"));
  assert.ok(ES.CARD_PRICE_SEL.includes(".s-card__price"));
});

// The regression that shipped: a page of reskinned cards matched nothing.
test("both card markups are found on the page, together and apart", () => {
  assert.equal(pageOf([oldCard("$20.00")]).querySelectorAll(ES.CARD_SEL).length, 1);
  assert.equal(pageOf([newCard("$20.00")]).querySelectorAll(ES.CARD_SEL).length, 1,
    "reskinned card was not matched");
  assert.equal(pageOf([oldCard("$20.00"), newCard("$30.00")]).querySelectorAll(ES.CARD_SEL).length, 2);
});

test("the price is readable from either markup", () => {
  for (const [make, label] of [[oldCard, "old"], [newCard, "reskinned"]]) {
    const card = make("$20.00");
    pageOf([card]);
    const priceEl = card.querySelector(ES.CARD_PRICE_SEL);
    assert.ok(priceEl, `${label} card: no price element matched`);
    const { low } = ES.parseMoneyRange(priceEl.textContent);
    assert.equal(low, 20, `${label} card: price did not parse`);
  }
});

// Asserts the EXACT anchor class, not /header/ — both anchors contain "header",
// so the loose form passed even when the box landed in the wrong one.
test("insertCardBox lands the box in each markup's own header", () => {
  for (const [make, label, want] of [
    [oldCard, "old", "su-item-card__header"],
    [newCard, "reskinned", "su-card-container__header"],
  ]) {
    const card = make("$20.00");
    pageOf([card]);
    const box = el("div", { attrs: { "data-ebay-total": "" } });
    ES.insertCardBox(card, card.querySelector(ES.CARD_PRICE_SEL), box);
    assert.equal(box.parentElement.className, want,
      `${label} card: box landed in .${box.parentElement.className}`);
  }
});

// A selector list resolves in DOCUMENT order, not list order, so the outer
// container header would win over the inner one on an old card carrying both —
// silently moving the box relative to where v1.1.0 put it.
test("insertCardBox prefers the inner header when a card carries both", () => {
  const card = el("li", {
    class: "su-item-card", children: [
      el("div", {
        class: "su-card-container__header", children: [
          el("div", {
            class: "su-item-card__header", children: [
              el("div", { class: "su-item-card__title", text: "A thing" }),
            ]
          }),
          el("div", {
            class: "su-item-card__price-container", children: [
              el("span", { class: "su-item-card__price", text: "$20.00" }),
            ]
          }),
        ]
      }),
    ]
  });
  pageOf([card]);
  const box = el("div", { attrs: { "data-ebay-total": "" } });
  ES.insertCardBox(card, card.querySelector(ES.CARD_PRICE_SEL), box);
  assert.equal(box.parentElement.className, "su-item-card__header");
});

// Every anchor missing — the shape a further reskin would take. The box must
// still land somewhere inside the card rather than being dropped.
test("insertCardBox falls back into the card when no anchor is recognised", () => {
  const card = el("li", {
    class: "s-card", children: [
      el("div", {
        class: "su-card-container__content", children: [
          el("span", { class: "s-card__price", text: "$20.00" }),
        ]
      }),
    ]
  });
  pageOf([card]);
  const box = el("div", { attrs: { "data-ebay-total": "" } });
  ES.insertCardBox(card, card.querySelector(ES.CARD_PRICE_SEL), box);
  assert.ok(card.querySelector("[data-ebay-total]"), "box was dropped entirely");
});

// --- price ranges ----------------------------------------------------------
// Shapes copied from debug/search-with-range.html. The reskin splits a range
// across three sibling .s-card__price spans in ONE attribute row, so reading a
// single element drops the high end and understates the estimate.
function rangeCard(low, high) {
  return el("li", {
    class: "s-card", children: [
      el("div", {
        class: "su-card-container__content", children: [
          el("div", { class: "su-card-container__header" }),
          el("div", {
            class: "s-card__attribute-row", children: [
              el("span", { class: "su-styled-text primary bold large-1 s-card__price", text: low }),
              el("span", { class: "su-styled-text primary bold default s-card__price", text: " to " }),
              el("span", { class: "su-styled-text primary bold large-1 s-card__price", text: high }),
            ]
          }),
          el("div", {
            class: "s-card__attribute-row", children: [
              el("span", { class: "su-styled-text secondary large", text: "Buy It Now" }),
            ]
          }),
        ]
      }),
    ]
  });
}

test("a split range reads both ends, not just the low span", () => {
  const card = rangeCard("$10.75", "$30.93");
  pageOf([card]);
  const text = ES.cardPriceText(card.querySelector(ES.CARD_PRICE_SEL));
  const { low, high } = ES.parseMoneyRange(text);
  assert.equal(low, 10.75);
  assert.equal(high, 30.93, "high end dropped — the box would understate the range");
});

test("a single-price card is unaffected by the range join", () => {
  const card = newCard("$20.00");
  pageOf([card]);
  assert.equal(ES.cardPriceText(card.querySelector(ES.CARD_PRICE_SEL)), "$20.00");
});

// An auction+BIN card carries two unrelated prices in SEPARATE rows. Joining
// across the whole card would invent a range spanning two different offers.
test("a second price in another row is not folded into the range", () => {
  const card = el("li", {
    class: "s-card", children: [
      el("div", {
        class: "su-card-container__content", children: [
          el("div", {
            class: "s-card__attribute-row", children: [
              el("span", { class: "s-card__price", text: "$10.00" }),
            ]
          }),
          el("div", {
            class: "s-card__attribute-row", children: [
              el("span", { text: "0 bids" }),
            ]
          }),
          el("div", {
            class: "s-card__attribute-row", children: [
              el("span", { class: "s-card__price", text: "$13.00" }),
            ]
          }),
        ]
      }),
    ]
  });
  pageOf([card]);
  const { low, high } = ES.parseMoneyRange(ES.cardPriceText(card.querySelector(ES.CARD_PRICE_SEL)));
  assert.equal(low, 10);
  assert.equal(high, null, "the Buy It Now price was folded in as a range end");
});

test("old markup keeps its single-element range string", () => {
  const card = oldCard("$171 - $796");
  pageOf([card]);
  const { low, high } = ES.parseMoneyRange(ES.cardPriceText(card.querySelector(ES.CARD_PRICE_SEL)));
  assert.equal(low, 171);
  assert.equal(high, 796);
});

test("cardPriceText tolerates a card with no price element", () => {
  assert.equal(ES.cardPriceText(null), null);
});

test("shipping is read off the reskinned card's attribute row", () => {
  const card = newCard("$20.00", "+$1.36 delivery");
  pageOf([card]);
  assert.equal(ES.findShipping(card), 1.36);
});

test("a card with no shipping line reports none rather than zero", () => {
  const card = newCard("$20.00");
  pageOf([card]);
  assert.equal(ES.findShipping(card), null);
});
