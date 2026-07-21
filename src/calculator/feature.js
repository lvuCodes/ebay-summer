// eBay Σummer. Copyright (C) 2026 lvuCodes. Licensed under GPL-3.0-or-later; see LICENSE.md.
//
// Estimated Total Calculator — feature glue. Owns the page-kind → renderer
// route table, the box clear, the Summary page-CSS pin, and the registry
// registration that plugs the calculator into core/content.js. Loads after
// every other calculator module.
(function () {
  "use strict";
  const ES = (globalThis.ES = globalThis.ES || {});
  const {
    config,
    refreshLive,
    renderListing,
    renderSearch,
    renderWatchlist,
    renderBids,
    renderSummary,
    renderRvi,
    renderSaved,
    renderHome,
  } = ES;

  // Route by page kind (early.js's foucPageKind). Each route names the box
  // renderer and the config key whose per-page toggle enables boxes there.
  const ROUTES = {
    listing: { renderer: renderListing, pageKey: "pageListing" },
    search: { renderer: renderSearch, pageKey: "pageSearch" },
    watchlist: { renderer: renderWatchlist, pageKey: "pageWatchlist" },
    bids: { renderer: renderBids, pageKey: "pageBidsOffers" },
    summary: { renderer: renderSummary, pageKey: "pageSummary" },
    rvi: { renderer: renderRvi, pageKey: "pageRecentView" },
    saved: { renderer: renderSaved, pageKey: "pageSaved" },
    home: { renderer: renderHome, pageKey: "pageHome" },
  };

  // Remove every injected box — used before a settings change so the guarded,
  // idempotent renderers rebuild the boxes with fresh totals.
  function clearBoxes() {
    document.querySelectorAll("[data-ebay-total]").forEach((el) => {
      // The main listing box carries a ResizeObserver (--wide split) and a price
      // MutationObserver (live refresh); disconnect them before dropping the node
      // so a settings-driven clear+rebuild doesn't leak observers.
      if (el._ro) el._ro.disconnect();
      if (el._priceObs) el._priceObs.disconnect();
      el.remove();
    });
  }

  // My eBay Summary column-alignment fix. Summary rows are flexbox, but several
  // columns are content-sized or come in width variants, so rows don't line up
  // vertically — and infinite scroll keeps loading more variants in:
  //   - order-total (container-item-col-orderTotal): min-width 152, NO max → grows
  //     to fit content, and our estimation box (wider, and varying per row) made
  //     each row's column a different width.
  //   - cta (the action-button column): a variant drops the fixed 231px for
  //     width:auto, so the button column width tracks its button text.
  //   - the time column uses different classes at different widths depending on the
  //     row: time-left-info (98) for a date vs timer (106) for a live countdown.
  // Pin every variable column to a fixed width so all rows align top-to-bottom;
  // item-info stays flex-grow:1 and absorbs the leftover slack, so it too is
  // uniform across rows. Only injected when boxes are on (see pageCss below), so
  // it changes nothing when the feature is off. Scoped to Summary — Bids has its
  // own full-width refit (custom-view). The estimation box wraps to fit the
  // pinned order-total width.
  function summaryCss() {
    // Cap each variable column's flex-basis and max-width so content length
    // (long prices, auto-width CTAs, timer vs time-left) can't widen it — that
    // was the row-to-row misalignment. min-width:0 overrides eBay's per-column
    // floors (orderTotal ships min-width:152) so the columns can actually
    // compress at narrow viewport widths instead of summing past the viewport
    // and shoving the CTA column off-screen. The name column (item-info) also
    // gets min-width:0 so a long title wraps/shrinks rather than forcing the
    // whole row wide.
    const pin = (w) =>
      `flex: 0 1 ${w}px !important; max-width: ${w}px !important; min-width: 0 !important;`;
    return `
    .m-container-item-layout-row .container-item-col-orderTotal { ${pin(210)} }
    .m-container-item-layout-row .container-item-col-cta { ${pin(231)} }
    .m-container-item-layout-row .container-item-col-time-left-info,
    .m-container-item-layout-row .container-item-col-timer { ${pin(106)} }
    .m-container-item-layout-row .container-item-col-item-info { min-width: 0 !important; }
  `;
  }

  ES.registerFeature({
    key: "calculator",
    // The calculator's static stylesheet: the purple/amber box + per-unit panel
    // (css-box.js) and the orange bid calculator + modal seatings (css-widgets.js).
    sharedCss: ES.BOX_CSS + ES.WIDGET_CSS,
    // Summary's column-pin is only needed when boxes actually inject there, so
    // it's gated on the est-total masters. Every other page's layout CSS is
    // custom-view's business.
    pageCss(kind, cfg) {
      return kind === "summary" && cfg.estTotal && cfg.pageSummary ? summaryCss() : "";
    },
    // One render pass: boxes + bid calculator, gated on the Estimated Total
    // Calculator master (estTotal) and the per-page toggle.
    run(kind) {
      const route = ROUTES[kind];
      if (route && config.estTotal && config[route.pageKey]) route.renderer();
    },
    clear: clearBoxes,
    // Settings edits bake into the boxes at build time (totals, tax, flags), so
    // wipe and let run() rebuild.
    onSettingsChanged: clearBoxes,
    // Live-only keys (perUnitShipping) re-render the open per-unit panels / bid
    // calculators in place — rebuilding would collapse an expanded panel.
    onLiveOnlyChange: refreshLive,
  });

  Object.assign(ES, { clearBoxes });
})();
