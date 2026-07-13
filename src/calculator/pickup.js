// Pickup-only detection for the estimation box's shipping-flag slot. Detects
// items whose only fulfilment is local pickup — no shipping/delivery option.
// eBay phrases these as "Free local pickup" / "Local pickup only" / "Collection
// in person" in the card's logistics line; a shipping item instead shows a
// "$X shipping" / "delivery in N days" / "Free Shipping" line. So a card is
// pickup-only when a leaf mentions pickup AND no leaf mentions
// shipping/delivery. The estimation box (box.js) surfaces this as a 📍🏃 in
// its shipping-flag slot, in place of a 🟢/🟡/🔴 circle (a pickup-only card
// has no shipping figure).
(function () {
  "use strict";
  const ES = (globalThis.ES = globalThis.ES || {});

  const PICKUP_RE = /\b(local pickup|pickup only|collection in person)\b/i;
  const SHIP_RE = /\b(shipping|delivery|postage|freight)\b/i;

  // Pure predicate over a card's leaf text strings — the unit-tested seam.
  // Pickup wins only when some leaf names pickup and NONE names shipping/delivery.
  function pickupOnlyFromLeaves(leaves) {
    let pickup = false;
    let ships = false;
    for (let i = 0; i < leaves.length; i++) {
      const t = leaves[i];
      if (!t) continue;
      if (PICKUP_RE.test(t)) pickup = true;
      else if (SHIP_RE.test(t)) ships = true;
    }
    return pickup && !ships;
  }

  // Collect a card's leaf-node text and run the predicate. Scanning only leaves
  // (no-children elements) mirrors findShipping — it avoids double-counting the
  // concatenated text of ancestors and keeps our own injected est-total box
  // ("+ ship n/a", no full "shipping"/pickup wording) from tripping either signal.
  function isPickupOnly(card) {
    const leaves = [];
    card.querySelectorAll("*").forEach((e) => {
      if (e.children.length === 0) leaves.push(e.textContent);
    });
    return pickupOnlyFromLeaves(leaves);
  }

  // The listing page's delivery module tells pickup-only from shippable by CLASS,
  // not text: eBay renders a ".ux-labels-values--localPickup" row ("Pickup: Free
  // local pickup over 60 mi…") in place of the ".ux-labels-values--shipping" row.
  // So the listing is pickup-only when the localPickup row exists and no shipping
  // row does (an item offering both would still show the shipping row).
  function listingIsPickupOnly() {
    return (
      !!document.querySelector(".ux-labels-values--localPickup") &&
      !document.querySelector(".ux-labels-values--shipping")
    );
  }

  Object.assign(ES, { isPickupOnly, listingIsPickupOnly, pickupOnlyFromLeaves });
})();
