// eBay Σummer. Copyright (C) 2026 lvuCodes. Licensed under GPL-3.0-or-later; see LICENSE.md.
//
// The listing-page (/itm/) renderer and its overlay modals: the main est-total
// box (with live price refresh), the dual-format Buy It Now box, the orange bid
// calculator, the related-item carousel sweeps, and the Best-Offer / place-bid
// modal injections. Pulls the shared builders (makeBox/makeBidCalc) and
// findShipping (render-cards.js) off ES — those modules load first.
(function () {
  "use strict";
  const ES = (globalThis.ES = globalThis.ES || {});
  const { parseMoney, parseMoneyUS, parseMoneyRange, firstAmount, modalOfferUSD, bidModalFigures, makeBox, makeBidCalc, findShipping, isPickupOnly, listingIsPickupOnly, CARD_SEL, CARD_PRICE_SEL, cardPriceText, insertCardBox } =
    ES;

  // A price "leaf" such as "$12.34", "US $1,200", or a "$171 - $796" range.
  const MONEY_LEAF = /^\s*(?:US\s*)?\$\d[\d.,]*(?:\s*(?:to|-)\s*(?:US\s*)?\$\d[\d.,]*)?\s*$/i;

  // The main listing's shipping cost, in USD. Reads the VALUES side of the shipping
  // row (not the bold green "delivery in 2–4 days" span). On international listings
  // the row reads "AU $24.65 (approx US $16.99)", so prefer the explicit "US $…";
  // domestic rows have only "US $6.83" / "Free delivery", so fall back to the first
  // amount ("Free delivery" -> 0, no amount -> null). Shared by the main price box
  // and the bid calculator so both fold in the same shipping figure.
  function findListingShipping() {
    const shipWrap = document.querySelector(".ux-labels-values--shipping");
    const shipVals =
      shipWrap && (shipWrap.querySelector(".ux-labels-values__values-content") || shipWrap);
    const text = shipVals && shipVals.textContent;
    const us = parseMoneyUS(text);
    return us != null ? us : parseMoney(text);
  }

  // The listing's currency conversion, for translating a USD bid back to what the
  // seller quotes. International listings show the seller-currency primary price
  // ("GBP 7.00") plus a US equivalent ("Approximately US $9.37"); the ratio of the
  // two is the live FX rate eBay is using. Returns { code, rate } with rate = USD
  // per 1 seller-currency unit, or null on a domestic (USD-primary, no approx)
  // listing — where the bid calculator stays plain USD. `code` is the seller's
  // display prefix as eBay writes it ("GBP", "AU $", "C $"). Shared by every bid
  // calculator (listing auction/offer + both Best-Offer modals).
  function listingFx() {
    const priceDiv =
      document.querySelector('[data-testid="x-price-primary"]') ||
      document.querySelector(".x-price-primary");
    const primaryEl = priceDiv && priceDiv.querySelector(".ux-textspans");
    const approxEl = document.querySelector(".x-price-approx__price");
    if (!primaryEl || !approxEl) return null; // no approx line -> domestic USD listing
    const primaryText = primaryEl.textContent || "";
    if (/\bUS\s*\$/i.test(primaryText)) return null; // primary already USD -> no conversion
    const usd = parseMoneyUS(approxEl.textContent);
    const foreign = firstAmount(primaryText);
    if (usd == null || !foreign) return null;
    const code = (primaryText.match(/^[^\d]*/)[0] || "").replace(/\s+/g, " ").trim();
    return { code: code, rate: usd / foreign };
  }

  // --- Listing page (/itm/) --------------------------------------------------
  // Read the listing's main price as { low, high, mainPriceEl }. On international
  // listings the primary span shows the seller's local currency ("AU $79.43") with
  // a US equivalent in the adjacent "Approximately US $56.24" line — prefer the US
  // amount when present. Shared by renderListing and the live price refresh.
  // `root` scopes the read to a subtree — defaults to the whole document (the main/
  // auction price, whose x-price-primary is first in DOM), or the `x-bin-price` block
  // to read the Buy It Now price on a dual-format listing (both blocks nest their own
  // x-price-primary, so an unscoped read would always return the auction one).
  function readListingPrice(root) {
    root = root || document;
    const priceDiv =
      root.querySelector('[data-testid="x-price-primary"]') ||
      root.querySelector(".x-price-primary");
    const mainPriceEl = priceDiv && priceDiv.querySelector(".ux-textspans");
    const approxEl = root.querySelector(".x-price-approx__price");
    const priceSrc =
      approxEl && /\bUS\s*\$/i.test(approxEl.textContent) ? approxEl : mainPriceEl;
    const { low, high } = parseMoneyRange(priceSrc && priceSrc.textContent);
    return { low, high, mainPriceEl };
  }

  // Repaint the main est-total box from the current live price WITHOUT the heavy
  // full render (no carousel sweeps). Called by the price observer below so the
  // auction bid/tax/total track eBay's price poll immediately.
  function refreshListingPrice() {
    // The auction box only — the Buy It Now box (--bin) totals a static Buy It Now price
    // that never polls, so the live-price observer must not repaint it with the bid.
    const box = document.querySelector(".ebay-estimation--lg:not(.ebay-estimation--bin)");
    if (!box || !box._refresh) return;
    const { low, high, mainPriceEl } = readListingPrice();
    if (low != null && mainPriceEl) box._refresh(low, findListingShipping(), high);
  }

  // Wire a dedicated MutationObserver to a STABLE price ancestor (the price section
  // persists while eBay tears down and rebuilds the inner price node each poll), so
  // the box repaints the moment the price changes — coalesced to one repaint per
  // frame, and bypassing the global 350ms render debounce. Stored on the box so
  // clearBoxes disconnects it on a settings-driven rebuild.
  function observeListingPrice(box) {
    if (typeof MutationObserver !== "function") return;
    const container =
      document.querySelector(".x-price-section") ||
      document.querySelector('[data-testid="x-buybox"], .x-buybox');
    if (!container) return;
    let scheduled = false;
    const obs = new MutationObserver(function () {
      if (scheduled) return; // one repaint per frame no matter how many mutations
      scheduled = true;
      requestAnimationFrame(function () {
        scheduled = false;
        refreshListingPrice();
      });
    });
    obs.observe(container, { childList: true, subtree: true, characterData: true });
    box._priceObs = obs;
  }

  // A listing is "unavailable" — sold out, auction ended/lost, or the listing was
  // ended/removed — when eBay renders the terminal status banner (the `d-statusmessage`
  // VIM region, e.g. "You didn't win this auction." / "This listing was ended."). The
  // price element and the CTA button group both PERSIST on these pages, so that banner
  // is the only stable signal; without gating on it the est-total box totals a price you
  // can no longer act on. But `d-statusmessage` ALSO wraps benign top-panel notices on
  // LIVE listings — e.g. the "You received an offer of GBP 6.00…" banner on a purchasable
  // Best-Offer page — so keying off the region alone false-suppresses the boxes there.
  // The terminal state renders its status section at ALERT severity
  // (`ux-layout-section--ALERT`), while the informational offer/notice banners render at
  // INFO (`--INFO`); gate on the ALERT descendant so only the true dead-listing state
  // suppresses. Confirmed: ended sample = ALERT, review-offer sample = INFO, all other
  // live samples have no status message. Pure/DOM-light so it's unit-testable with a
  // querySelector stub.
  function listingUnavailable(root) {
    return !!(
      root &&
      typeof root.querySelector === "function" &&
      root.querySelector(
        '[data-testid="d-statusmessage"] .ux-layout-section--ALERT, .d-statusmessage .ux-layout-section--ALERT'
      )
    );
  }

  // Dual-format = auction AND Buy It Now on one listing: eBay renders both an
  // x-bid-price block (current bid) and an x-bin-price block (fixed Buy It Now price), each
  // nesting its own x-price-primary. Gates the second "Buy It Now" est-total box. Pure/DOM-
  // light so it's unit-testable with a querySelector stub.
  function dualFormatListing(root) {
    if (!root || typeof root.querySelector !== "function") return false;
    return !!(
      root.querySelector('[data-testid="x-bid-price"], .x-bid-price') &&
      root.querySelector('[data-testid="x-bin-price"], .x-bin-price')
    );
  }

  // --- Best-Offer modals (/itm/ overlay) -------------------------------------
  // Clicking "Make offer" opens the redesigned Best-Offer lightbox, hydrated into
  // `.bo-main-container` in the TOP document (not an iframe). It has two steps:
  //  - Price-entry step: an item summary ("Buy it now: $24.99"), a price input where
  //    you type YOUR offer (`.bo-offer-section__wrapper .app-input-price__wrapper`),
  //    eBay's quick-offer buttons, an optional message box, and a "Continue" footer.
  //    We seat the orange calculator right below the price input (above the message
  //    box) so the landed total (offer + tax + shipping) updates as you type — a USD
  //    helper for the offer, mirroring the on-listing calc-above-the-CTA placement.
  //    Shipping + FX come from the listing behind the overlay (this modal lists none).
  //  - Review/checkout step: renders inside a cross-origin `.bo-offer-checkout` iframe
  //    (eBayPay); the top-document `.bo-main-container__body` is emptied. A content
  //    script in the top frame can't reach that iframe, so there's nothing to inject —
  //    the price-entry step is the only injectable one.
  // The modal overlays the listing page, so this runs inside renderListing.
  //
  // Legacy fallback: the older seller-initiated-offer lightbox (`.app-siolayer-main-
  // container`, ending in `.app-sio-ctas`) with a "Review offer" details table or a
  // "Make counteroffer" price input. Kept for any listing still served that flow.

  // Read a details-row value by its `dt` label text (row order isn't guaranteed).
  function offerModalRowText(dl, label) {
    const wrappers = dl.querySelectorAll(".ui-component-label-value-list__label-value-wrapper");
    for (let i = 0; i < wrappers.length; i++) {
      const dt = wrappers[i].querySelector(".ui-component-label-value-list__label");
      if (dt && dt.textContent.trim().toLowerCase() === label) {
        const dd = wrappers[i].querySelector(".ui-component-label-value-list__value");
        return dd ? dd.textContent : null;
      }
    }
    return null;
  }

  // True when the redesigned "Make offer" modal is on its price-entry step — the only
  // step we can inject into. Keyed on the price-input block inside the offer section;
  // the review/checkout step empties the body (content moves to the cross-origin
  // iframe), so it reads false. DOM-light so it's unit-testable with a querySelector stub.
  function offerEntryStep(root) {
    return !!(
      root &&
      typeof root.querySelector === "function" &&
      root.querySelector(".bo-offer-section__wrapper .app-input-price__wrapper")
    );
  }

  function renderOfferModal() {
    // Redesigned buyer "Make offer" modal (top-document `.bo-main-container`). Only its
    // price-entry step is injectable (the review step lives in a cross-origin iframe).
    const bo = document.querySelector(".bo-main-container");
    if (bo) {
      if (!offerEntryStep(bo)) return 0; // review/checkout step, or still spinner-only
      if (bo.querySelector("[data-ebay-total]")) return 0; // idempotent: already injected
      const section = bo.querySelector(".bo-offer-section__wrapper");
      const calc = makeBidCalc(findListingShipping(), listingFx());
      // Anchor above the message box, not below the price input: the price-input wrapper
      // re-renders on every focus change (toggling focus-within/error classes), which
      // flashed a calc seated beneath it. The message box is stable. Fall back to the
      // section end when the optional message box is absent. Shipping + FX come from the
      // listing behind the overlay (this modal lists none).
      const msg = section.querySelector(".app-input-message__wrapper");
      if (msg) msg.insertAdjacentElement("beforebegin", calc);
      else section.appendChild(calc);
      return 1;
    }

    const modal = document.querySelector(".app-siolayer-main-container");
    if (!modal) return 0; // no offer modal open (or still spinner-only, no content yet)
    const ctas = modal.querySelector(".app-sio-ctas");
    if (!ctas) return 0; // not fully rendered yet — wait for the next observer tick
    if (modal.querySelector("[data-ebay-total]")) return 0; // idempotent: already injected

    // Counteroffer modal: a price input, no populated offer-details table. Seat the
    // calculator directly beneath the price input (where you type your counter), not
    // down by the CTA. Shipping comes from the listing behind the overlay (this modal
    // lists none and states "doesn't include shipping").
    const priceInput = modal.querySelector(".app-sio-make-offer--priceinput");
    if (priceInput) {
      priceInput.insertAdjacentElement("afterend", makeBidCalc(findListingShipping(), listingFx()));
      return 1;
    }

    // Review-offer modal: read the offer + shipping figures and box the offer price.
    const dl = modal.querySelector(".ui-component-label-value-list");
    if (!dl) return 0;
    const o = modalOfferUSD(
      offerModalRowText(dl, "seller offer"),
      offerModalRowText(dl, "shipping")
    );
    if (!o || o.itemUSD == null) return 0; // no parseable offer price
    const shipping = o.shipUSD != null ? o.shipUSD : findListingShipping();

    // Purple est-total box on the offer price (large: eager per-unit panel + toggle),
    // then the orange offer/counter calculator — both above the modal's CTA buttons.
    // The offer is a fixed amount (no live poll), so no price observer here.
    const box = makeBox(o.itemUSD, shipping, true, null, undefined, false, "Offer");
    ctas.insertAdjacentElement("beforebegin", box);
    ctas.insertAdjacentElement("beforebegin", makeBidCalc(shipping, listingFx()));
    return 1;
  }

  // --- Place-bid modal (/itm/ overlay) ---------------------------------------
  // Clicking "Place bid" / "Increase bid" on an auction opens a lightbox hydrated
  // into `[data-testid="placebid-main-container"]`; its rendered body is
  // `[data-testid="place-bid-view"]`, which carries a `[data-testid="bid-summary"]`
  // line ("$10.50 current bid + $8 shipping · 3 bids · 1d 6h left"). We seat our
  // widgets just below that summary (above the bid input), mirroring the on-listing
  // and Best-Offer-modal placements:
  //  - a purple est-total box on the CURRENT bid, folding in the user's sales tax
  //    (which eBay's modal, like the Best-Offer one, omits) — the true landed floor;
  //  - the orange bid calculator, so you can total a HIGHER max bid before placing it.
  // The stack overlays the listing page, so this runs inside renderListing. Uses the
  // modal's own summary shipping when present, else the listing's findListingShipping().
  function renderBidModal() {
    const view = document.querySelector('[data-testid="place-bid-view"]');
    if (!view) return 0; // modal not open, or still the skeleton/spinner (no rendered body)
    const summary = view.querySelector('[data-testid="bid-summary"]');
    if (!summary) return 0; // not fully hydrated yet — wait for the next observer tick
    if (view.querySelector("[data-ebay-total]")) return 0; // idempotent: already injected

    const fig = bidModalFigures(summary.textContent);
    const shipping = fig.shipping != null ? fig.shipping : findListingShipping();

    // Orange calculator always (the primary tool — works even on a foreign listing
    // whose "$"-less bid the box can't box); the purple current-bid box only when the
    // summary yields a parseable USD bid. Static figures (no live poll), like the
    // Best-Offer modal. Insert order keeps the box above the calc, both below summary.
    if (fig.bid != null) {
      const box = makeBox(fig.bid, shipping, true, null, undefined, false, "Current bid");
      summary.insertAdjacentElement("afterend", box);
      box.insertAdjacentElement("afterend", makeBidCalc(shipping, listingFx()));
    } else {
      summary.insertAdjacentElement("afterend", makeBidCalc(shipping, listingFx()));
    }
    return 1;
  }

  // Four passes: main price box, the orange bid calculator (auction pages), the
  // .su-item-card carousels, and a structural sweep for the class-obfuscated
  // related-item carousels.
  function renderListing() {
    let count = 0;

    // The Best-Offer "Review offer" and auction "Place bid" modals are overlays on
    // this same page — inject into them first (idempotent, no-op when not open).
    count += renderOfferModal();
    count += renderBidModal();

    // Where the stacked estimators land: the CTA button group (Place bid / Buy It
    // Now / Add to Watchlist), which is present on EVERY listing type — auctions,
    // fixed-price, trading-card and eBay-Live listings alike (some swap the
    // condition field for other info but always keep the buttons). The purple
    // estimation box and the orange bid calculator are inserted just ABOVE the
    // buttons, so the estimate sits right where you act on it. isBiddable gates the
    // bid calculator to auction / Best-Offer listings.
    const isBiddable = document.querySelector(
      '[data-testid="x-bid-price"], .x-bid-price, [data-testid="x-bid-action"], .x-bid-action,' +
      ' [data-testid="x-offer-action"], .x-offer-action'
    );
    const ctaAnchor = document.querySelector('[data-testid="x-buybox-cta"], .x-buybox-cta');

    // When both an auction bid block and a Buy It Now price block are present, the
    // auction box is labelled "Bid" and a second "Buy It Now" box is stacked below it (1a).
    const binBlock = document.querySelector('[data-testid="x-bin-price"], .x-bin-price');
    const dualFormat = dualFormatListing(document);

    // Sold/ended/lost listings still render a price AND the CTA button group, so gate
    // both estimators on the item being purchasable — there's no live price to total.
    const unavailable = listingUnavailable(document);

    // 1. Main listing price. On international listings the primary span shows the
    // seller's local currency ("AU $79.43") with a US equivalent in the adjacent
    // "Approximately US $56.24" line — compute from the US price when present.
    // Idempotency guard: the --lg variant is unique to this main box, so its
    // presence means the box already exists (wherever it was placed).
    const { low, high, mainPriceEl } = readListingPrice();
    // Match the auction box specifically — the Buy It Now box (step 1a) also carries --lg.
    const existingBox = document.querySelector(".ebay-estimation--lg:not(.ebay-estimation--bin)");
    if (low != null && mainPriceEl && existingBox && existingBox._refresh) {
      // Box already placed (it now survives eBay's price-poll teardowns since it's
      // anchored to the CTA buttons, not the price DOM). Re-read the live price and
      // repaint in place so the auction bid/tax/total track the current bid.
      existingBox._refresh(low, findListingShipping(), high);
    } else if (low != null && mainPriceEl && !existingBox && !unavailable) {
      const shipping = findListingShipping();
      // On dual-format listings this main box totals the BID; label it so it's distinct
      // from the "Buy It Now" box stacked below (step 1a). Auction-only listings pass no prefix.
      const box = makeBox(low, shipping, true, high, undefined, false, dualFormat ? "Bid" : undefined, listingIsPickupOnly());
      if (ctaAnchor) {
        // Seat the purple estimation box just above the CTA buttons; the orange bid
        // calc goes below it (also above the buttons), so the two stack
        // purple-over-orange right on top of the action buttons.
        ctaAnchor.insertAdjacentElement("beforebegin", box);
        // The box is out of the price DOM now, so the global 350ms-debounced render
        // isn't tight enough to track a live auction — give it a dedicated observer
        // on the price container that repaints the instant the price polls.
        observeListingPrice(box);
      } else {
        // No CTA button group found: fall back to gluing the price text + box into
        // one
        // nowrap "priceline" so the box opens to the RIGHT of the price without
        // dropping to a new row, and a trailing "or Best Offer" (a sibling of the
        // price) wraps to the next line instead of being crammed beside the box.
        // The flexrow marker lets the shared CSS lay this out WITHOUT a universal
        // :has() rule (resize-recalc jank). Idempotent: reuse an existing priceline
        // so a settings-driven clear+rebuild doesn't orphan empty wrappers.
        const priceParent = mainPriceEl.parentElement;
        if (priceParent) {
          let line = priceParent.querySelector(".ebay-total-priceline");
          if (!line) {
            line = document.createElement("span");
            line.className = "ebay-total-priceline";
            priceParent.insertBefore(line, mainPriceEl);
            line.appendChild(mainPriceEl);
          }
          line.appendChild(box);
          priceParent.classList.add("ebay-total-flexrow");
        } else {
          mainPriceEl.insertAdjacentElement("afterend", box);
        }
      }
      count++;
    }

    // 1a. Second main box for the Buy It Now price on a dual-format (auction + Buy It Now)
    // listing. The box above totals the current BID; this one totals the fixed Buy It Now
    // price, read from the x-bin-price block (which nests its own x-price-primary, so
    // an unscoped read would return the auction price instead). Seated directly below
    // the auction box, still above the CTA — both stacked purple boxes sit where you
    // act. Static price, so no live observer. Own --bin idempotency guard, and gated on
    // the CTA anchor so it can't land inside the no-CTA priceline fallback above.
    const auctionBox = document.querySelector(".ebay-estimation--lg:not(.ebay-estimation--bin)");
    if (
      dualFormat &&
      !unavailable &&
      ctaAnchor &&
      auctionBox &&
      !document.querySelector(".ebay-estimation--bin")
    ) {
      const { low: binLow, high: binHigh } = readListingPrice(binBlock);
      if (binLow != null) {
        const binBox = makeBox(binLow, findListingShipping(), true, binHigh, "bin", false, "Buy It Now", listingIsPickupOnly());
        auctionBox.insertAdjacentElement("afterend", binBox);
        count++;
      }
    }

    // 1b. Bid / offer calculator. A full-width orange box inserted just above the
    // CTA buttons, directly below the purple estimation box (both are inserted
    // beforebegin the button group, so the later insert — this one — lands between
    // the estimation box and the buttons): type a bid or offer (or an "=expr" formula)
    // and see the estimated landed total. Gated on an auction's bid UI OR a Best
    // Offer's make-offer action, so it stays off plain fixed-price Buy-It-Now
    // listings. Guarded on the single page-wide instance, so a settings-triggered
    // clear+rebuild re-adds it without duplicating.
    if (isBiddable && ctaAnchor && !unavailable && !document.querySelector(".ebay-bid-calc")) {
      // Currency-aware on foreign listings: the mid slot shows the bid translated to
      // the seller's currency (the amount to enter in eBay's bid/offer field).
      ctaAnchor.insertAdjacentElement("beforebegin", makeBidCalc(findListingShipping(), listingFx()));
      count++;
    }

    // 2. Search-style card carousels (both the old .su-item-card markup and the
    // .s-card reskin — CARD_SEL matches either; see render-cards.js).
    document.querySelectorAll(CARD_SEL).forEach((card) => {
      if (card.querySelector("[data-ebay-total]")) return; // already done
      const priceEl = card.querySelector(CARD_PRICE_SEL);
      const { low, high } = parseMoneyRange(cardPriceText(priceEl));
      if (low == null) return;
      // No per-unit toggle on the listing page's non-main cards — their panel is
      // unreachable (eBay's card-click navigation can't be reliably suppressed).
      const box = makeBox(low, findShipping(card), false, high, undefined, true, undefined, isPickupOnly(card));
      insertCardBox(card, priceEl, box);
      count++;
    });

    // 3. All other related-item carousels ("Similar Items", "Explore related
    // items", "Inspired by your recent views", "Sponsored", …). Their cards are
    // class-obfuscated (UUID in server HTML, hashed live) with an unclassed price
    // leaf, so nothing is class-selectable. Sweep every item-link: climb from each
    // a[href*="/itm/"] to the smallest ancestor that also holds a bare-"$" price
    // leaf; that ancestor is the card. Guards keep this off the main price and the
    // pass-2 cards.
    const mainPrice =
      document.querySelector(".x-price-section") ||
      document.querySelector('[data-testid="x-price-primary"]');
    const seen = new Set();
    document.querySelectorAll('a[href*="/itm/"]').forEach((link) => {
      let card = link,
        priceEl = null;
      for (let i = 0; i < 8 && card && card !== document.body; i++) {
        priceEl = [...card.querySelectorAll("span, div")].find(
          (e) => e.children.length === 0 && MONEY_LEAF.test(e.textContent)
        );
        if (priceEl) break;
        card = card.parentElement;
      }
      if (!priceEl || !card || card === document.body || seen.has(card)) return;
      if (mainPrice && mainPrice.contains(priceEl)) return; // skip the main listing price
      if (card.closest(CARD_SEL)) return; // handled in pass 2
      if (card.querySelector("[data-ebay-total]")) return;
      const { low, high } = parseMoneyRange(priceEl.textContent);
      if (low == null) return;
      seen.add(card);
      // No per-unit toggle on these obfuscated related-item cards either (same reason).
      priceEl.insertAdjacentElement(
        "beforebegin",
        makeBox(low, findShipping(card), false, high, undefined, true, undefined, isPickupOnly(card))
      );
      count++;
    });

    return count;
  }

  Object.assign(ES, {
    renderListing,
    renderOfferModal,
    renderBidModal,
    offerEntryStep,
    listingFx,
    listingUnavailable,
    dualFormatListing,
  });
})();
