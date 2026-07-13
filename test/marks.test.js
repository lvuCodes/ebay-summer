// Listing-state gates: the pickup-only predicate and the listing-state gates
// (unavailable / dual-format) that decide whether the est-total boxes show.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { pickupOnlyFromLeaves, listingUnavailable, dualFormatListing } = require("./load-es.js");

// --- pickupOnlyFromLeaves: pickup wins only with no shipping/delivery leaf --
test("pickupOnlyFromLeaves: pickup mention, no shipping -> true", () => {
  assert.equal(pickupOnlyFromLeaves(["$120.00", "Free local pickup"]), true);
  assert.equal(pickupOnlyFromLeaves(["Local pickup only"]), true);
  assert.equal(pickupOnlyFromLeaves(["Collection in person over 60 mi from 77057."]), true);
});

test("pickupOnlyFromLeaves: any shipping/delivery leaf suppresses the badge", () => {
  // Ships as well as offers pickup -> not pickup-ONLY.
  assert.equal(pickupOnlyFromLeaves(["Free local pickup", "+$14.95 delivery in 2-4 days"]), false);
  assert.equal(pickupOnlyFromLeaves(["Local pickup", "Free Shipping"]), false);
});

test("pickupOnlyFromLeaves: no pickup mention -> false", () => {
  assert.equal(pickupOnlyFromLeaves(["$65.00", "+$5.72 Shipping"]), false);
  assert.equal(pickupOnlyFromLeaves([]), false);
  assert.equal(pickupOnlyFromLeaves(["", null, "Sealed New"]), false);
});

test("pickupOnlyFromLeaves: our own '+ ship n/a' box text does not count as shipping", () => {
  // The amber est-total box injected into a pickup-only card must not suppress it:
  // its "ship" fragment is not the whole word "shipping"/"delivery".
  assert.equal(pickupOnlyFromLeaves(["Free local pickup", "+ ship n/a"]), true);
  assert.equal(pickupOnlyFromLeaves(["Free local pickup", "incl. 8.25% tax (+$9.90) + ship n/a"]), true);
});

// --- listingUnavailable: gate the est-total box off sold/ended/lost listings --
// A minimal querySelector stub. The gate matches a `d-statusmessage` region ONLY
// when it carries an ALERT-severity section (`ux-layout-section--ALERT`) — the
// terminal ended/sold/lost state. `severity` picks which modifier the fake status
// section carries: "ALERT" (dead listing) vs "INFO" (a benign live-listing notice
// like the "You received an offer…" banner), or null for no status message at all.
function fakeRoot(severity) {
  return {
    querySelector: (sel) => {
      if (!severity) return null;
      const wantsAlert = /--ALERT/.test(sel);
      return wantsAlert === (severity === "ALERT") && /d-statusmessage/.test(sel)
        ? { tagName: "DIV" }
        : null;
    },
  };
}

test("listingUnavailable: ALERT status banner present -> unavailable (box suppressed)", () => {
  assert.equal(listingUnavailable(fakeRoot("ALERT")), true);
});

test("listingUnavailable: INFO offer/notice banner on a live listing -> available (box shown)", () => {
  assert.equal(listingUnavailable(fakeRoot("INFO")), false);
});

test("listingUnavailable: live listing (no banner) -> available (box shown)", () => {
  assert.equal(listingUnavailable(fakeRoot(null)), false);
});

test("listingUnavailable: missing/invalid root -> false (fail open, don't suppress)", () => {
  assert.equal(listingUnavailable(null), false);
  assert.equal(listingUnavailable(undefined), false);
  assert.equal(listingUnavailable({}), false);
});

// --- dualFormatListing: gate the second Buy It Now box to auction + Buy It Now listings --
// A querySelector stub that reports which of the two price blocks exist.
function fakeListing({ bid = false, bin = false } = {}) {
  return {
    querySelector: (sel) => {
      if (/x-bid-price/.test(sel)) return bid ? { tag: "bid" } : null;
      if (/x-bin-price/.test(sel)) return bin ? { tag: "bin" } : null;
      return null;
    },
  };
}

test("dualFormatListing: both bid + Buy It Now blocks -> true (second box shown)", () => {
  assert.equal(dualFormatListing(fakeListing({ bid: true, bin: true })), true);
});

test("dualFormatListing: auction-only or Buy It Now-only -> false (no second box)", () => {
  assert.equal(dualFormatListing(fakeListing({ bid: true })), false);
  assert.equal(dualFormatListing(fakeListing({ bin: true })), false);
  assert.equal(dualFormatListing(fakeListing()), false);
});

test("dualFormatListing: missing/invalid root -> false", () => {
  assert.equal(dualFormatListing(null), false);
  assert.equal(dualFormatListing({}), false);
});
