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
const { makeDoc, installGlobals, el } = require("./fake-dom.js");

installGlobals();
const ES = require("./load-es.js");

// A card in the pre-July-2026 markup: price inside a __price-container, with
// .su-item-card__header as the insert anchor.
function oldCard(price, shipText) {
  const kids = [
    el("div", { class: "su-item-card__header", children: [
      el("div", { class: "su-item-card__title", text: "A thing" }),
    ] }),
    el("div", { class: "su-item-card__price-container", children: [
      el("span", { class: "su-item-card__price", text: price }),
    ] }),
  ];
  if (shipText) kids.push(el("div", { children: [el("span", { text: shipText })] }));
  return el("li", { class: "su-item-card", children: [
    el("div", { class: "su-card-container__content", children: kids }),
  ] });
}

// A card in the current markup: price in an attribute row, header supplied only
// by the shared .su-card-container__header wrapper.
function newCard(price, shipText) {
  const rows = [
    el("div", { class: "s-card__attribute-row", children: [
      el("span", { class: "s-card__price", text: price }),
    ] }),
  ];
  if (shipText) {
    rows.push(el("div", { class: "s-card__attribute-row", children: [
      el("span", { text: shipText }),
    ] }));
  }
  return el("li", { class: "s-card s-card--vertical", children: [
    el("div", { class: "su-card-container__content", children: [
      el("div", { class: "su-card-container__header", children: [
        el("div", { class: "s-card__title", text: "A thing" }),
      ] }),
      el("div", { class: "su-card-container__attributes", children: rows }),
    ] }),
  ] });
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

test("insertCardBox lands the box in the card header for either markup", () => {
  for (const [make, label] of [[oldCard, "old"], [newCard, "reskinned"]]) {
    const card = make("$20.00");
    pageOf([card]);
    const box = el("div", { attrs: { "data-ebay-total": "" } });
    ES.insertCardBox(card, card.querySelector(ES.CARD_PRICE_SEL), box);
    assert.match(box.parentElement.className, /header/,
      `${label} card: box landed in .${box.parentElement.className}`);
  }
});

// Every anchor missing — the shape a further reskin would take. The box must
// still land somewhere inside the card rather than being dropped.
test("insertCardBox falls back into the card when no anchor is recognised", () => {
  const card = el("li", { class: "s-card", children: [
    el("div", { class: "su-card-container__content", children: [
      el("span", { class: "s-card__price", text: "$20.00" }),
    ] }),
  ] });
  pageOf([card]);
  const box = el("div", { attrs: { "data-ebay-total": "" } });
  ES.insertCardBox(card, card.querySelector(ES.CARD_PRICE_SEL), box);
  assert.ok(card.querySelector("[data-ebay-total]"), "box was dropped entirely");
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
