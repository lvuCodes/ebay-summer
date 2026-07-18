// Card-page renderers, ported from the console scripts in chrome-scripts.md.
// One renderer per card-grid/row page: search, watchlist, bids & offers, My eBay
// summary, recently viewed, saved feed, and the home feed. They use the shared
// makeBox/parseMoney helpers pulled off ES below, inject NO CSS and set up NO
// observer (content.js owns both), and guard on the unified [data-ebay-total]
// attribute. Each returns how many boxes it added and is idempotent — safe to
// re-run as lazy-loaded content hydrates. Selectors and structural-climb logic
// are preserved verbatim; they encode hard-won eBay-DOM knowledge.
// The listing-page renderer (which reuses findShipping) lives in
// render-listing.js; the highlight/badge markers in highlights/render.js.
(function () {
  "use strict";
  const ES = (globalThis.ES = globalThis.ES || {});
  const { parseMoney, parseMoneyRange, resolveShipping, makeBox, isPickupOnly } = ES;

  // Find the shipping cost within a card. null if none.
  // eBay splits paid shipping across two sibling spans: "+$14.95 " then
  // "delivery in 2-4 days". The leaf that matches /deliver|shipping/ is the
  // wordy one with NO amount, so when it has no parsable $ we fall back to its
  // parent's text (which includes the adjacent amount span).
  // We collect EVERY matching leaf (not just the first) and let resolveShipping
  // pick: a seller can put "Free Shipping" in the item TITLE, which also matches
  // /shipping/ and would otherwise mask the true paid "+$16.45 delivery" line —
  // resolveShipping makes a real amount on any candidate win over that stray free.
  function findShipping(card) {
    const candidates = [];
    card.querySelectorAll("*").forEach((e) => {
      if (e.children.length === 0 && /deliver|shipping/i.test(e.textContent)) {
        candidates.push({
          text: e.textContent,
          parentText: e.parentElement ? e.parentElement.textContent : null,
        });
      }
    });
    return resolveShipping(candidates);
  }

  // Inject an estimation box under each shipping-cost cell of the container-item-col
  // component. Shared by the Bids & Offers page and the My eBay Summary dashboard,
  // which build their rows from the same component. Idempotent — the guard skips a
  // cell that already has a box. Returns how many boxes were added.
  function injectColTotals() {
    let count = 0;
    document.querySelectorAll(".container-item-col__info-logisticsCost").forEach((log) => {
      if (log.parentElement.querySelector("[data-ebay-total]")) return; // guard
      const col = log.closest(".container-item-col-orderTotal") || log.parentElement;
      const priceEl = col.querySelector(".container-item-col__info-displayPrice");
      const { low, high } = parseMoneyRange(priceEl && priceEl.textContent);
      if (low == null) return; // no parseable item price -> skip
      const shipping = parseMoney(log.textContent); // "+US $14.18 Shipping" or "Free"
      // Pickup-only rows carry no shipping figure; flag them 📍🏃 in place of a circle.
      // isPickupOnly is a harmless false on the summary rows (no pickup wording there).
      const pickup = isPickupOnly(log.closest(".m-container-item-layout-row__body") || col);
      log.insertAdjacentElement("afterend", makeBox(low, shipping, false, high, undefined, false, undefined, pickup));
      count++;
    });
    return count;
  }

  // --- Bids & Offers (/mye/myebay/bidsoffers) -------------------------------
  // Inject an estimated total under each shipping-cost cell. Totals only — the
  // full-width layout refit and Offers-hiding from the console script are dropped.
  // Totals only — the .ebay-sec-* section tagging that drives the Custom View
  // hides lives in custom-view/render.js (it must work with the boxes off).
  function renderBids() {
    return injectColTotals();
  }

  // --- My eBay Summary (/mye/myebay/summary) --------------------------------
  // The summary dashboard aggregates purchase / bid / watchlist rows built from
  // the SAME container-item-col component as the Bids & Offers page, so reuse the
  // shared injector. No section-tagging here — that's a bids-page layout concern.
  function renderSummary() {
    return injectColTotals();
  }

  // --- Search-result card markup -------------------------------------------
  // eBay reskinned the result card in July 2026: .su-item-card became .s-card,
  // .su-item-card__price became .s-card__price, and the price moved out of a
  // .su-item-card__price-container into one of several .s-card__attribute-row
  // siblings. The old markup is still served on some surfaces (and on the
  // listing page's related-items carousels), so BOTH are matched rather than
  // swapped — a card is whichever of the two it happens to be. The old
  // selectors stay first in each list so a page serving the old markup lands
  // the box exactly where it always did.
  const CARD_SEL = ".su-item-card, .s-card";
  const CARD_PRICE_SEL = ".su-item-card__price, .s-card__price";
  // Row wrapping the price, used as the insert anchor when no header exists.
  const CARD_PRICE_ROW_SEL = ".su-item-card__price-container, .s-card__attribute-row";
  // The card's header block. .su-card-container__header exists in both variants
  // and is the new markup's only header, but the old markup's own
  // .su-item-card__header is a different (inner) element — prefer it so the old
  // layout is untouched.
  const CARD_HEADER_SEL = ".su-item-card__header, .su-card-container__header";

  // Place an estimation box inside a search-style card. Falls back down the
  // three anchors so a further reskin degrades to "somewhere sensible in the
  // card" instead of dropping the box. Shared with render-listing.js's carousel
  // pass, which injects into the same card component.
  function insertCardBox(card, priceEl, box) {
    const header = card.querySelector(CARD_HEADER_SEL);
    const row = priceEl.closest(CARD_PRICE_ROW_SEL);
    if (header) header.appendChild(box);
    else if (row && row.parentElement) row.parentElement.insertBefore(box, row);
    else (card.querySelector(".su-card-container__content") || card).appendChild(box);
  }

  // --- Search results (/sch/) -----------------------------------------------
  // For a price range ("$171 - $796") parseMoneyRange takes both ends.
  function renderSearch() {
    let count = 0;
    document.querySelectorAll(CARD_SEL).forEach((card) => {
      if (card.querySelector("[data-ebay-total]")) return; // already done
      const priceEl = card.querySelector(CARD_PRICE_SEL);
      const { low, high } = parseMoneyRange(priceEl && priceEl.textContent);
      if (low == null) return;
      const shipping = findShipping(card);
      const box = makeBox(low, shipping, false, high, undefined, false, undefined, isPickupOnly(card));
      insertCardBox(card, priceEl, box);
      count++;
    });
    return count;
  }

  // --- Watchlist (/mye/myebay/watchlist) ------------------------------------
  // Each saved item is an .m-item-3-col card. Price and shipping use stable
  // data-testid hooks: "price" (span.BOLD, "US $3.99") and "logistics-cost"
  // ("+US $5.72" with a clipped "Shipping" word, or "Free Shipping"). Inject the
  // box directly under the price, above the buying-format / shipping lines.
  function renderWatchlist() {
    let count = 0;
    document.querySelectorAll(".m-item-3-col").forEach((card) => {
      if (card.querySelector("[data-ebay-total]")) return; // already done
      const priceEl = card.querySelector('[data-testid="price"] .BOLD') ||
        card.querySelector('[data-testid="price"]');
      const { low, high } = parseMoneyRange(priceEl && priceEl.textContent);
      if (low == null) return;
      const logEl = card.querySelector('[data-testid="logistics-cost"] .m-item-3-col__text') ||
        card.querySelector('[data-testid="logistics-cost"]');
      const shipping = parseMoney(logEl && logEl.textContent);
      const priceRow = card.querySelector('[data-testid="price"]');
      priceRow.insertAdjacentElement(
        "afterend",
        makeBox(low, shipping, false, high, undefined, false, undefined, isPickupOnly(card))
      );
      count++;
    });
    return count;
  }

  // --- Recently Viewed (/mye/myebay/rvi) ------------------------------------
  // Each viewed item is a .container-item card: title in .container-item__title,
  // price in the first .container-item__locator .BOLD ("US $85.00"), and shipping
  // in a sibling .container-item__locator ("+US $10.00" with a clipped "shipping
  // cost" span, read via findShipping). Insert the box after the price locator.
  function renderRvi() {
    let count = 0;
    document.querySelectorAll(".container-item").forEach((card) => {
      if (card.querySelector("[data-ebay-total]")) return; // already done
      const priceEl = card.querySelector(".container-item__locator .BOLD");
      const { low, high } = parseMoneyRange(priceEl && priceEl.textContent);
      if (low == null) return;
      const shipping = findShipping(card);
      const locator = priceEl.closest(".container-item__locator") || priceEl;
      locator.insertAdjacentElement(
        "afterend",
        makeBox(low, shipping, false, high, undefined, false, undefined, isPickupOnly(card))
      );
      count++;
    });
    return count;
  }

  // --- Saved Feed (/mye/myebay/saved) ---------------------------------------
  // The saved/recommended feed is a grid of .item-card tiles: price in
  // .item-card__content-info__price ("$65.00"), with NO per-card shipping — so the
  // box is the AMBER variant (item + tax only, "+ ship TBD"). The price sits inside
  // the card's <a> link, so insert the box after that anchor to stay outside the
  // click target (same pattern as the home feed).
  function renderSaved() {
    let count = 0;
    document.querySelectorAll(".item-card").forEach((card) => {
      if (card.querySelector("[data-ebay-total]")) return; // already done
      const priceEl = card.querySelector(".item-card__content-info__price");
      const { low, high } = parseMoneyRange(priceEl && priceEl.textContent);
      if (low == null) return; // recommendation tile with no price -> skip
      const anchor = priceEl.closest("a") || priceEl;
      anchor.insertAdjacentElement("afterend", makeBox(low, null, false, high, "amber"));
      count++;
    });
    return count;
  }

  // Home recommendation rows (Recently viewed, Your watched items, …) are
  // horizontal carousels whose flex row (.carousel__list) eBay's carousel JS
  // MEASURES and pins to a fixed pixel height at init — before our amber box is
  // injected into each card. That row also carries overflow-y:hidden (its scroll
  // gutter), so once the box is appended the card is taller than the pinned
  // height and the box's lower lines get clipped, leaving only the "EST. TOTAL"
  // label. CSS !important can't be relied on here (eBay sets the height inline,
  // possibly with its own !important), so we clear the pin directly on any row
  // that now holds a box: writing height:auto to the element's own inline style
  // wins outright (our render runs after eBay's init pin, while content.js's
  // observer is disconnected). height:auto only grows the row to fit its content
  // and leaves the horizontal scroll (overflow-x) untouched, so it's a no-op on
  // rows without a box. Idempotent — safe to re-run every render pass.
  function unclipHomeCarousels() {
    document
      .querySelectorAll(".home-item-carousel .carousel__list, .dp-item-carousel-module__container .carousel__list")
      .forEach((list) => {
        if (!list.querySelector("[data-ebay-total]")) return; // no box in this row
        list.style.setProperty("height", "auto", "important");
        list.style.setProperty("max-height", "none", "important");
      });
  }

  // --- Home page (www.ebay.com/) --------------------------------------------
  // The feed is a grid of article[__typename="GridItemModule"] cards, each with a
  // price (.bc-item-detail-price, or .bc-item-detail-price-discounted whose <ins>
  // holds the current price) and NO per-card shipping. So the box is the AMBER
  // variant (item + tax only, shipping "TBD"). The price sits inside the card's
  // <a>, so the box is inserted AFTER that anchor to stay outside the click target.
  function renderHome() {
    let count = 0;
    document.querySelectorAll('article[__typename="GridItemModule"]').forEach((card) => {
      if (card.querySelector("[data-ebay-total]")) return; // already done
      const disc = card.querySelector(".bc-item-detail-price-discounted");
      const priceEl = disc
        ? disc.querySelector("ins") || disc
        : card.querySelector(".bc-item-detail-price");
      const { low, high } = parseMoneyRange(priceEl && priceEl.textContent);
      if (low == null) return; // promo/banner tile with no price -> skip
      // Shipping is unknown on the home feed; pass null so the box shows item + tax
      // only ("+ ship TBD" via the amber variant).
      const anchor = priceEl.closest('a[href*="/itm/"]') || priceEl.closest("a");
      const box = makeBox(low, null, false, high, "amber");
      // Place the box INSIDE the card's content column, directly above the price
      // block, instead of after the card's <a>. The card is
      //   <a> <div.flex.flex-col.items-start.h-full> <span.title> <div.price> </div> </a>
      // and the flex column is the height the carousel measures; a box appended
      // AFTER the anchor lands in a separately-clipped zone (only "EST. TOTAL"
      // survives eBay's pinned row height). Inserting it as a child of the column,
      // before the price block, keeps it in the measured, non-clipped content flow.
      // The box's interactive controls already preventDefault+stopPropagation
      // (box.js), so living inside the card link is safe — clicks won't navigate.
      const column = anchor && (anchor.querySelector(".flex.flex-col.items-start") || anchor.firstElementChild);
      if (column && column.contains(priceEl)) {
        let priceBlock = priceEl;
        while (priceBlock.parentElement && priceBlock.parentElement !== column) priceBlock = priceBlock.parentElement;
        column.insertBefore(box, priceBlock);
      } else if (anchor) {
        anchor.insertAdjacentElement("afterend", box); // fallback: after the link
      } else {
        priceEl.insertAdjacentElement("afterend", box);
      }
      count++;
    });
    // Release eBay's JS-pinned carousel-row height so the just-added boxes aren't
    // clipped by the row's overflow-y:hidden. Runs every pass (idempotent).
    unclipHomeCarousels();
    return count;
  }

  Object.assign(ES, {
    CARD_SEL,
    CARD_PRICE_SEL,
    insertCardBox,
    findShipping,
    renderBids,
    renderSummary,
    renderSearch,
    renderWatchlist,
    renderRvi,
    renderSaved,
    renderHome,
  });
})();
