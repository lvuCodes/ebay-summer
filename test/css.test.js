// The injected stylesheets: the shared box CSS invariants and early.js's
// FOUC-replay helpers.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { assembleSharedCss, foucStyleSpecs, foucPageKind } = require("./load-es.js");

// The one shared stylesheet, assembled from the registered features' sharedCss
// contributions (calculator box + widgets) in manifest load order.
const SHARED_CSS = assembleSharedCss();

// --- bid calculator: size-contained so typing can't reflow the listing grid --
test("SHARED_CSS: bid calculator is inline-size contained (no typing-driven reflow)", () => {
  // The .ebay-bid-calc box must not feed a variable intrinsic width back into
  // eBay's content-sized .vi-grid track — otherwise a long formula re-proportions
  // the whole listing (gallery vs details) as you type. Guard the fix.
  const block = SHARED_CSS.slice(SHARED_CSS.indexOf(".ebay-bid-calc {"));
  assert.match(block, /contain:\s*inline-size/);
});

// --- home item-carousel un-clip: box's lower lines must not be cut off ------
test("SHARED_CSS: home item-carousels release eBay's pinned .carousel__list height", () => {
  // eBay's carousel JS pins the flex-row height before our amber box is injected;
  // combined with the row's overflow-y:hidden that clips the box's amount/sub
  // lines. The fix forces the row back to height:auto so it grows to fit the box.
  const block = SHARED_CSS.slice(SHARED_CSS.indexOf(".dp-item-carousel-module__container .carousel__list"));
  assert.match(block, /\.dp-item-carousel-module__container \.carousel__list/);
  assert.match(block, /\.home-item-carousel \.carousel__list/);
  assert.match(block.slice(0, block.indexOf("}")), /height:\s*auto\s*!important/);
});

// --- ranged totals: italic, mirroring eBay's own ranged prices -------------
test("SHARED_CSS: a ranged total is italic but its flag emoji is not", () => {
  // The italic is the range's spelling, not the 🚦 warning — it must not be
  // gated behind flagRange. An italicised emoji renders as a glitch, so the
  // flag is explicitly restored to upright inside the italic amount.
  const block = SHARED_CSS.slice(SHARED_CSS.indexOf(".ebay-estimation__amount--range"));
  assert.match(block.slice(0, block.indexOf("}")), /font-style:\s*italic\s*!important/);
  const flag = block.slice(block.indexOf(".ebay-estimation__amount--range .ebay-estimation__flag"));
  assert.match(flag.slice(0, flag.indexOf("}")), /font-style:\s*normal\s*!important/);
});

// --- foucStyleSpecs: early.js document_start replay ------------------------
test("foucStyleSpecs: emits both styles with the css.js style ids", () => {
  const specs = foucStyleSpecs("SHARED", "PAGE");
  assert.deepEqual(specs, [
    { id: "ebay-total-style", css: "SHARED" },
    { id: "ebay-total-page-style", css: "PAGE" },
  ]);
});

test("foucStyleSpecs: skips empty/missing cached blobs (cleared cache -> nothing)", () => {
  assert.deepEqual(foucStyleSpecs("", ""), []);
  assert.deepEqual(foucStyleSpecs("SHARED", ""), [{ id: "ebay-total-style", css: "SHARED" }]);
  assert.deepEqual(foucStyleSpecs("", "PAGE"), [
    { id: "ebay-total-page-style", css: "PAGE" },
  ]);
});

test("foucPageKind: the one URL dispatch (routing + per-page cache key)", () => {
  assert.equal(foucPageKind("/itm/123"), "listing");
  assert.equal(foucPageKind("/sch/i.html?_nkw=x"), "search");
  assert.equal(foucPageKind("/mye/myebay/watchlist"), "watchlist");
  assert.equal(foucPageKind("/mye/myebay/bidsoffers"), "bids");
  assert.equal(foucPageKind("/mye/myebay/summary"), "summary");
  assert.equal(foucPageKind("/mye/myebay/rvi"), "rvi");
  assert.equal(foucPageKind("/mye/myebay/saved"), "saved");
  assert.equal(foucPageKind("/"), "home");
  assert.equal(foucPageKind("/str/some-store"), "other");
});
