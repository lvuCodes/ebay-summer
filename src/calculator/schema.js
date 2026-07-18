// Estimated Total Calculator — persisted-settings schema. Loaded (before
// core/defaults.js) in both the content-script bundle and popup.html.
(function () {
  "use strict";
  const ES = (globalThis.ES = globalThis.ES || {});
  const { sanitizeNonNeg } = ES;

  // The tax rate with its 8.25% default. Lives next to the taxRate key it guards;
  // exposed on ES for the popup's shared sanitize path and the settings tests.
  function sanitizeTaxRate(v) {
    return sanitizeNonNeg(v, 0.0825);
  }
  ES.sanitizeTaxRate = sanitizeTaxRate;

  const defaults = {
    // Section master: the estimation boxes + bid calculator. On by default —
    // the boxes show immediately (that's the extension's core purpose).
    estTotal: true,

    // Estimation rates: sales-tax rate, the shipping estimate as a % of item price,
    // and the floor (dollars) that estimate never drops below.
    taxRate: 0.0825,
    shipPct: 0.5,
    shipFloor: 10,

    // Shipping-cost flag: the 🟢/🟡/🔴 dot trailing the estimation-box amount that
    // rates the listing's shipping cost against the flat floor + % thresholds above
    // (see shipFlag in calc.js). A sub-toggle of the Estimated Total Calculator
    // section; on by default. When off, the dot is suppressed and the popup collapses
    // the "Flag shipping when it exceeds…" threshold rows.
    flagShipping: true,

    // Per-unit ("cost per item") basis: true folds shipping into the per-unit
    // price (whole landed total / count); false divides only item + tax. Applies
    // to both the estimation box's per-unit panel and the orange bid calculator.
    perUnitShipping: true,

    // Per-page master enables for the estimation box — "show" semantics
    // (true = boxes injected on that page type). Listing and search default on;
    // the rest default off. The popup's "Pages" section flips them, and the
    // calculator's run() skips a page whose toggle is off.
    pageListing: true,
    pageSearch: true,
    pageBidsOffers: false,
    pageWatchlist: false,
    pageHome: false,
    pageSummary: false,
    pageRecentView: false,
    pageSaved: false,
  };

  const sanitizers = {
    taxRate: (v) => sanitizeTaxRate(v),
    shipPct: (v) => sanitizeNonNeg(v, defaults.shipPct),
    shipFloor: (v) => sanitizeNonNeg(v, defaults.shipFloor),
  };

  ES.registerSettings({
    defaults,
    sanitizers,
    // perUnitShipping only affects LIVE-rendered per-unit lines (open panels /
    // the bid calculator), so it refreshes in place instead of rebuilding —
    // see core/config.js LIVE_ONLY_KEYS and feature.js's onLiveOnlyChange.
    liveOnlyKeys: ["perUnitShipping"],
  });
})();
