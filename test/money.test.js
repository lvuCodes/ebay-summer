// Money parsing: price/shipping cell text -> numbers, plus the modal-summary
// figure readers and display formatting.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { fmtMoney, parseMoney, parseMoneyUS, parseMoneyRange, shippingFromText, resolveShipping, firstAmount, modalOfferUSD, bidModalFigures, calcTotal } = require("./load-es.js");

const close = (a, b) => Math.abs(a - b) < 1e-9;

// --- parseMoney ------------------------------------------------------------
test("parseMoney: standard price cell", () => {
  assert.equal(parseMoney("US $143.50"), 143.5);
});

test("parseMoney: shipping cell with leading +", () => {
  assert.equal(parseMoney("+US $14.18 Shipping"), 14.18);
});

test("parseMoney: thousands separator", () => {
  assert.equal(parseMoney("US $1,411.00"), 1411);
});

test("parseMoney: free shipping -> 0", () => {
  assert.equal(parseMoney("Free Shipping"), 0);
});

test("parseMoney: empty / no amount -> null", () => {
  assert.equal(parseMoney(""), null);
  assert.equal(parseMoney(null), null);
  assert.equal(parseMoney("Shipping"), null);
});

// --- shippingFromText: amount beats a stray "free" -------------------------
test("shippingFromText: explicit amount wins over a 'free' mention", () => {
  // A leaf/parent that contains BOTH "free" and a dollar amount must report the
  // amount — the inverse of parseMoney's free-first rule.
  assert.equal(shippingFromText("+$16.45 delivery in 2-4 days"), 16.45);
  assert.equal(shippingFromText("+$16.45 delivery · Free returns"), 16.45);
  assert.equal(shippingFromText("Pokemon TCG Chaos Rising Free Shipping"), 0); // no amount -> free
  assert.equal(shippingFromText("Free delivery"), 0);
  assert.equal(shippingFromText("delivery in 2-4 days"), null); // no amount, no free
  assert.equal(shippingFromText(""), null);
});

// --- resolveShipping: a title's "Free Shipping" must not mask a paid line ----
test("resolveShipping: real paid delivery beats a title 'Free Shipping'", () => {
  // Mirrors the Chaos Rising card: the title leaf matches /shipping/ and is 'free',
  // but the true shipping is a later "+$16.45" split across sibling spans.
  const candidates = [
    { text: "Pokemon TCG Chaos Rising Etb Brand New Sealed Free Shipping", parentText: null },
    { text: "delivery in 2-4 days", parentText: "+$16.45 delivery in 2-4 days" },
  ];
  assert.equal(resolveShipping(candidates), 16.45);
});

test("resolveShipping: all-free -> 0, no candidates -> null", () => {
  assert.equal(resolveShipping([{ text: "Free delivery", parentText: null }]), 0);
  assert.equal(
    resolveShipping([{ text: "Sealed Free Shipping", parentText: null }, { text: "Free delivery", parentText: null }]),
    0,
  );
  assert.equal(resolveShipping([]), null);
  assert.equal(resolveShipping([{ text: "delivery soon", parentText: "delivery soon" }]), null);
});

// --- firstAmount: first bare numeric in a currency string ---------------------
test("firstAmount: reads the seller-currency primary, ignoring later numbers", () => {
  assert.equal(firstAmount("GBP 6.00 (14.29% off) (Approx. $8.02)"), 6.0);
  assert.equal(firstAmount("US $8.02"), 8.02);
  assert.equal(firstAmount("GBP 23.21"), 23.21);
  assert.equal(firstAmount("1,234.50 kr"), 1234.5);
  assert.equal(firstAmount("Free"), null);
  assert.equal(firstAmount(""), null);
  assert.equal(firstAmount(null), null);
});

// --- modalOfferUSD: resolve USD offer + USD shipping from the modal rows ------
// International (GBP-primary): the offer row carries a US approx, so parseMoney
// lifts $8.02; the shipping row is GBP-only, so scale it via the offer's own
// US/primary ratio (8.02/6.00 = 1.3367) -> 23.21 * 1.3367 = $31.02.
test("modalOfferUSD: international offer scales GBP shipping onto USD via the offer ratio", () => {
  const o = modalOfferUSD("GBP 6.00 (14.29% off) (Approx. $8.02)", "GBP 23.21 eBay shipping");
  assert.equal(o.itemUSD, 8.02);
  assert.equal(o.shipUSD, 31.02);
});

// Domestic (USD-primary): both rows carry "$" directly, so no ratio is needed.
test("modalOfferUSD: domestic offer reads USD shipping directly (no scaling)", () => {
  const o = modalOfferUSD("US $18.00 (10% off)", "US $5.00");
  assert.equal(o.itemUSD, 18.0);
  assert.equal(o.shipUSD, 5.0);
});

// Free shipping -> 0 even when stated in the seller's currency (no "$").
test("modalOfferUSD: free shipping resolves to 0", () => {
  const o = modalOfferUSD("GBP 6.00 (Approx. $8.02)", "Free");
  assert.equal(o.itemUSD, 8.02);
  assert.equal(o.shipUSD, 0);
});

// No ratio derivable (offer USD present but shipping has no number and isn't free)
// -> shipUSD null, so the caller falls back to the listing's own shipping.
test("modalOfferUSD: unparseable shipping -> shipUSD null (caller falls back)", () => {
  const o = modalOfferUSD("US $8.02", "Calculated at checkout");
  assert.equal(o.itemUSD, 8.02);
  assert.equal(o.shipUSD, null);
});

// No parseable offer price at all -> null (no box).
test("modalOfferUSD: no offer price -> null", () => {
  assert.equal(modalOfferUSD("Best offer pending", "GBP 23.21"), null);
  assert.equal(modalOfferUSD(null, null), null);
});

// --- bidModalFigures: read current bid + shipping from the place-bid summary ---

// The real summary text: "$X current bid + $Y shipping · N bids · time left".
test("bidModalFigures: parses current bid and paid shipping from the summary", () => {
  const f = bidModalFigures("$10.50 current bid + $8 shipping 3 bids · 1d 6h left");
  assert.equal(f.bid, 10.5);
  assert.equal(f.shipping, 8);
});

// The bid amount must not be mistaken for the shipping (both are "$…"): shipping is
// read only from the slice AFTER the "current bid" label.
test("bidModalFigures: bid is not double-counted as shipping", () => {
  const f = bidModalFigures("$15.50 current bid + $5.62 shipping 5 bids · 3h 46m left");
  assert.equal(f.bid, 15.5);
  assert.equal(f.shipping, 5.62);
});

// Free shipping -> 0 (a real amount would win, but there's none here).
test("bidModalFigures: free shipping resolves to 0", () => {
  const f = bidModalFigures("$42.00 current bid + Free shipping 2 bids · 45s left");
  assert.equal(f.bid, 42);
  assert.equal(f.shipping, 0);
});

// An oddly-labelled summary ("Starting bid", no "current bid") still yields the bid;
// shipping falls back to null so the caller uses the listing's own shipping.
test("bidModalFigures: no 'current bid' label -> bid parsed, shipping null", () => {
  const f = bidModalFigures("$5.00 Starting bid + $4 shipping");
  assert.equal(f.bid, 5);
  assert.equal(f.shipping, null);
});

// Nothing parseable (e.g. a foreign "$"-less primary) -> both null; the caller then
// skips the purple box and still renders the FX-aware calculator.
test("bidModalFigures: empty/unparseable -> both null", () => {
  assert.deepEqual(bidModalFigures(""), { bid: null, shipping: null });
  assert.deepEqual(bidModalFigures(null), { bid: null, shipping: null });
});

// --- parseMoneyUS: US amount on international listings ----------------------
test("parseMoneyUS: pulls the US amount from a local-currency string", () => {
  assert.equal(parseMoneyUS("AU $24.65 (approx US $16.99) Australia Post"), 16.99);
  assert.equal(parseMoneyUS("Approximately US $56.24"), 56.24);
  assert.equal(parseMoneyUS("US $1,845.98"), 1845.98);
});

test("parseMoneyUS: no explicit US amount -> null", () => {
  assert.equal(parseMoneyUS("AU $24.65"), null);
  assert.equal(parseMoneyUS("Free delivery"), null);
  assert.equal(parseMoneyUS(""), null);
  assert.equal(parseMoneyUS(null), null);
});

test("parseMoneyUS: does not false-match letters before 'US'", () => {
  // "Australia" contains "us" but not "US $"; must not match.
  assert.equal(parseMoneyUS("Australia Post $9.99"), null);
});

// --- parseMoneyRange -------------------------------------------------------
test("parseMoneyRange: a range keeps both ends", () => {
  assert.deepEqual(parseMoneyRange("$46.79 - $92.49"), { low: 46.79, high: 92.49 });
});

test("parseMoneyRange: single price -> high null", () => {
  assert.deepEqual(parseMoneyRange("US $71.99"), { low: 71.99, high: null });
});

test("parseMoneyRange: thousands separators in both ends", () => {
  assert.deepEqual(parseMoneyRange("$1,200 - $3,400"), { low: 1200, high: 3400 });
});

test("parseMoneyRange: empty / no amount -> nulls", () => {
  assert.deepEqual(parseMoneyRange(""), { low: null, high: null });
  assert.deepEqual(parseMoneyRange("Buy It Now"), { low: null, high: null });
});

// --- fmtMoney: display formatting with thousands separators ----------------
test("fmtMoney: two decimals, no grouping below 1000", () => {
  assert.equal(fmtMoney(12), "12.00");
  assert.equal(fmtMoney(143.5), "143.50");
  assert.equal(fmtMoney(0), "0.00");
});
test("fmtMoney: groups thousands with commas", () => {
  assert.equal(fmtMoney(1234.5), "1,234.50");
  assert.equal(fmtMoney(1000000), "1,000,000.00");
});
test("fmtMoney: rounds to two decimals", () => {
  assert.equal(fmtMoney(1234.567), "1,234.57");
});
test("fmtMoney: non-finite input falls back to 0.00", () => {
  assert.equal(fmtMoney(NaN), "0.00");
  assert.equal(fmtMoney(null), "0.00");
  assert.equal(fmtMoney(undefined), "0.00");
});

// --- integration -----------------------------------------------------------
test("integration: parse both cells then total", () => {
  const item = parseMoney("US $143.50");
  const ship = parseMoney("+US $14.18 Shipping");
  const { total } = calcTotal(item, ship, 0.0825);
  assert.ok(close(total, 143.5 + 143.5 * 0.0825 + 14.18)); // 169.517...
});
