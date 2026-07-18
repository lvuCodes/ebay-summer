// Estimation-box CSS: the box half of the calculator's static stylesheet — the
// purple/amber .ebay-estimation widget, its per-unit panel, and the
// listing-page placement helpers. css-widgets.js holds the bid-calculator
// half; feature.js concatenates the two into the calculator's sharedCss
// contribution. Pure data, no dependencies.
(function () {
  "use strict";
  const ES = (globalThis.ES = globalThis.ES || {});

  // Base is the compact card look (search cards, listing carousels, bids rows);
  // the --lg modifier bumps the main listing-page price box. eBay's own CSS is
  // high-specificity, so !important.
  //
  // Two palette custom properties carry every colour: --ink (borders, text,
  // fills) and --surface (the box background + button-hover tint). Children read
  // them by inheritance, so the amber variant is a two-line override of the pair
  // rather than a duplicate of every coloured rule. Hover/divider tints are
  // color-mixed from the same two so no third colour is ever hardcoded.
  const BOX_CSS = `
  .ebay-estimation {
    --ink: #4b2e83 !important;
    --surface: #eee8f4 !important;
    display: block !important;
    position: relative !important;
    width: auto !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    margin: 2px 0 3px !important;
    /* extra right room reserves space for the per-unit toggle button */
    padding: 3px 22px 3px 6px !important;
    border: 1px dashed var(--ink) !important;
    border-radius: 6px !important;
    background: var(--surface) !important;
    color: var(--ink) !important;
    line-height: 1.2 !important;
  }
  /* Per-unit toggle button, pinned to the box's top-right corner. */
  .ebay-estimation .ebay-estimation__toggle {
    position: absolute !important;
    top: 2px !important;
    right: 3px !important;
    width: 16px !important;
    height: 16px !important;
    padding: 0 !important;
    margin: 2px !important;
    border: 1px solid var(--ink) !important;
    border-radius: 4px !important;
    background: #fff !important;
    color: var(--ink) !important;
    font-size: .78rem !important;
    line-height: 1 !important;
    cursor: pointer !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }
  .ebay-estimation .ebay-estimation__toggle:hover { background: color-mix(in srgb, var(--ink) 12%, var(--surface)) !important; }
  /* No per-unit toggle (listing-page non-main cards) — reclaim the reserved right
     padding that would have held the toggle button. */
  .ebay-estimation--no-toggle { padding-right: 6px !important; }
  /* Lazily-built per-unit panel and its item-count stepper. Stacked vertically
     (stepper, label, value) at every width — works in the widest card and the
     slimmest Bids column alike, and needs NO container query (container-type on
     the box inflated eBay's card grids and caused horizontal page scroll). */
  .ebay-estimation .ebay-estimation__panel[hidden] { display: none !important; }
  .ebay-estimation .ebay-estimation__panel {
    display: flex !important;
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 3px !important;
    margin-top: 4px !important;
    padding-top: 4px !important;
    border-top: 1px dashed color-mix(in srgb, var(--ink) 35%, var(--surface)) !important;
  }
  .ebay-estimation .ebay-estimation__field-label {
    font-size: .68rem !important;
    font-weight: 700 !important;
    letter-spacing: .03em !important;
    text-transform: uppercase !important;
    color: var(--ink) !important;
  }
  .ebay-estimation .ebay-estimation__stepper {
    display: inline-flex !important;
    align-items: center !important;
    gap: 4px !important;
    /* Never exceed the box; shrink the count field first (below) so the − / +
       buttons and input stay inside a narrow card. */
    max-width: 100% !important;
  }
  .ebay-estimation .ebay-estimation__step {
    flex: 0 0 auto !important;
    width: 20px !important;
    height: 20px !important;
    padding: 0 !important;
    margin: 0 !important;
    border: 1px solid var(--ink) !important;
    border-radius: 4px !important;
    background: #fff !important;
    color: var(--ink) !important;
    font-size: .95rem !important;
    line-height: 1 !important;
    cursor: pointer !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
  }
  .ebay-estimation .ebay-estimation__step:hover { background: color-mix(in srgb, var(--ink) 12%, var(--surface)) !important; }
  .ebay-estimation .ebay-estimation__count {
    width: 3.4em !important;
    min-width: 0 !important;
    height: 20px !important;
    box-sizing: border-box !important;
    padding: 0 4px !important;
    margin: 0 !important;
    border: 1px solid var(--ink) !important;
    border-radius: 4px !important;
    background: #fff !important;
    line-height: 1 !important;
    text-align: center !important;
    font-size: .9rem !important;
    font-weight: 800 !important;
    color: var(--ink) !important;
    -moz-appearance: textfield !important;
    appearance: textfield !important;
  }
  .ebay-estimation .ebay-estimation__count:focus {
    outline: none !important;
    border-color: var(--ink) !important;
  }
  .ebay-estimation .ebay-estimation__perunit {
    margin-top: 2px !important;
    font-size: .8rem !important;
    font-weight: 700 !important;
    color: var(--ink) !important;
  }
  /* "Incl. shipping" per-unit basis toggle (moved here from the popup) — a <button>
     with a faux checkbox, so it can preventDefault the card link's navigation. */
  .ebay-estimation .ebay-estimation__ship {
    display: inline-flex !important;
    align-items: center !important;
    gap: 6px !important;
    margin-top: 4px !important;
    padding: 0 !important;
    border: none !important;
    background: none !important;
    font-size: .7rem !important;
    font-weight: 700 !important;
    color: var(--ink) !important;
    cursor: pointer !important;
  }
  .ebay-estimation .ebay-estimation__ship-box {
    flex: 0 0 auto !important;
    width: 12px !important;
    height: 12px !important;
    box-sizing: border-box !important;
    border: 2px solid var(--ink) !important;
    border-radius: 4px !important;
    background: #fff !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    line-height: 1 !important;
    font-size: .62rem !important;
    color: #fff !important;
  }
  .ebay-estimation .ebay-estimation__ship[aria-pressed="true"] .ebay-estimation__ship-box {
    background: var(--ink) !important;
  }
  .ebay-estimation .ebay-estimation__ship[aria-pressed="true"] .ebay-estimation__ship-box::after {
    content: "✓" !important;
  }
  /* Lock line-height on every text line so listing-carousel boxes render as
     tight as the search/bids boxes (eBay's card line-height would otherwise
     leak in through inheritance). */
  .ebay-estimation .ebay-estimation__label {
    display: block !important;
    font-size: .62rem !important;
    line-height: 1.2 !important;
    font-weight: 700 !important;
    letter-spacing: .04em !important;
    text-transform: uppercase !important;
    color: var(--ink) !important;
  }
  .ebay-estimation .ebay-estimation__amount {
    display: block !important;
    font-size: 1.1rem !important;
    line-height: 1.2 !important;
    font-weight: 800 !important;
    color: var(--ink) !important;
  }
  /* Emoji carry taller intrinsic metrics than text; pin line-height so a dot/
     range flag can't stretch the amount line past a text-only box's height. */
  .ebay-estimation .ebay-estimation__flag {
    font-size: .85em !important;
    line-height: 1 !important;
    vertical-align: middle !important;
  }
  .ebay-estimation .ebay-estimation__sub {
    display: block !important;
    font-weight: 400 !important;
    font-size: .74rem !important;
    line-height: 1.2 !important;
    color: var(--ink) !important;
  }
  /* The main listing box breathes a touch more than the compact cards. */
  .ebay-estimation--lg .ebay-estimation__label,
  .ebay-estimation--lg .ebay-estimation__amount,
  .ebay-estimation--lg .ebay-estimation__sub { line-height: 1.3 !important; }
  /* Beside-the-price FALLBACK layout — used only when renderListing finds no CTA
     button group to anchor the estimation box to (normally the box sits above the
     buttons). It marks the price container with .ebay-total-flexrow so we can flex
     it into a row (regardless of eBay's default display) and land the box beside
     "US $71.99" instead of on its own line; it wraps below only when the row is too
     narrow. A JS-applied marker class rather than :has() so the rule isn't
     re-evaluated against every element on every style recalc (resize jank). */
  .ebay-total-flexrow {
    display: flex !important;
    align-items: center !important;
    flex-wrap: wrap !important;
    column-gap: 12px !important;
  }
  /* Fallback only: the price + box are glued into one nowrap unit so the box opens
     to the RIGHT of the price without dropping to its own row; a trailing "or Best
     Offer" (a sibling of the price) is pushed to the next line instead of being
     squished beside the box. */
  .ebay-total-priceline {
    display: inline-flex !important;
    align-items: center !important;
    flex-wrap: nowrap !important;
    column-gap: 12px !important;
    max-width: 100% !important;
  }
  .x-price-primary__orBestOffer { flex-basis: 100% !important; }
  /* Keep the large box from being squeezed by the price on the same line (matters
     in the beside-the-price fallback row). */
  .ebay-estimation--lg { flex: 0 0 auto !important; }
  /* The estimation box sits just above the CTA buttons, directly above the orange
     bid calculator: the 12px top margin matches the bid calculator's own top
     margin, so the gap above the box equals the gap between the two boxes. The
     beside-the-price fallback (no CTA button group) resets the top margin so the
     box aligns with the price instead. */
  .ebay-estimation--lg { margin: 12px 0 4px !important; }
  .ebay-total-priceline .ebay-estimation--lg { margin-top: 0 !important; }
  /* Match the orange bid box's roomier internal padding (10px 12px). The right
     side keeps extra room for the per-unit toggle button; wide mode (toggle gone)
     trims it back to 12px below. */
  .ebay-estimation--lg { padding: 10px 22px 10px 12px !important; }
  .ebay-estimation--lg .ebay-estimation__label { font-size: .7rem !important; }
  .ebay-estimation--lg .ebay-estimation__amount { font-size: 1.65rem !important; }
  .ebay-estimation--lg .ebay-estimation__sub { font-size: .82rem !important; }
  /* Large listing box: lay the main text and the per-unit panel side by side so
     the panel expands to the RIGHT of the total instead of below it. Compact
     card boxes are untouched — they keep the stacked, expand-down layout. */
  .ebay-estimation--lg .ebay-estimation__body {
    display: flex !important;
    align-items: stretch !important;
  }
  /* Large listing box (expand RIGHT): a narrow panel, so stack everything
     vertically — stepper (input), then the label, then the $/unit line. */
  .ebay-estimation--lg .ebay-estimation__panel {
    margin-top: 0 !important;
    padding-top: 0 !important;
    border-top: none !important;
    margin-left: 12px !important;
    padding-left: 12px !important;
    border-left: 1px dashed color-mix(in srgb, var(--ink) 35%, var(--surface)) !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: flex-start !important;
    justify-content: center !important;
    gap: 3px !important;
  }
  /* Wide layout (--wide is set by the box's ResizeObserver once the box is at
     least twice the per-unit panel's min width): give the est-total and per-unit
     halves ~50% each and always show the panel, dropping the collapse toggle. */
  .ebay-estimation--lg.ebay-estimation--wide .ebay-estimation__main {
    flex: 1 1 50% !important;
    min-width: 50% !important;
  }
  .ebay-estimation--lg.ebay-estimation--wide .ebay-estimation__panel,
  .ebay-estimation--lg.ebay-estimation--wide .ebay-estimation__panel[hidden] {
    display: flex !important; /* force-show regardless of the hidden attribute */
    flex: 1 1 50% !important;
    min-width: 220px !important; /* = PER_UNIT_MIN in box.js */
  }
  .ebay-estimation--lg.ebay-estimation--wide .ebay-estimation__toggle {
    display: none !important;
  }
  /* Toggle is gone in wide mode — trim the right padding to match the other sides. */
  .ebay-estimation--lg.ebay-estimation--wide {
    padding-right: 12px !important;
  }

  /* Watchlist cards are cramped — the box otherwise butts against the CTA
     buttons beside it. Shrink it a touch (zoom scales the whole box, rem
     children included) and leave a little clearance on the right and bottom. */
  .m-item-3-col .ebay-estimation {
    zoom: 0.9 !important;
    max-width: 88% !important;
    margin: 2px 0 8px !important;
  }

  /* --- Home item-carousel un-clip (CSS fallback) ------------------------- */
  /* The home page's recommendation rows (Recently viewed, Your watched items,
     etc.) are horizontal carousels whose slide height eBay's carousel JS
     MEASURES and pins on the flex row (.carousel__list) at init — before our
     amber box is injected into each card. .carousel__list also carries
     overflow-y:hidden (for its scroll gutter), so once the box is appended the
     card is taller than the pinned height and the box's lower lines (the amount
     and the "incl. tax + ship TBD" sub) get clipped — only the "EST. TOTAL"
     label survives. Releasing the pinned height lets the row grow to fit the box.
     eBay pins the height INLINE (and may flag it !important), which a stylesheet
     rule can't override — so the real fix is JS (renderHome -> unclipHomeCarousels
     writes height:auto to the row's own inline style, which wins). This rule is a
     cheap fallback for the case eBay's pin is a plain (non-important) inline or a
     stylesheet height; overflow-x:auto (the horizontal scroll) is untouched, and
     with no box present height:auto is a no-op — safe, scoped to home carousels. */
  .dp-item-carousel-module__container .carousel__list,
  .home-item-carousel .carousel__list {
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
  }

  /* Home cards sit in a flex column with align-items:flex-start, so the box would
     otherwise shrink to its content width. The card's title and price are both
     w-full — stretch the box to match so it spans the full card width. */
  .dp-grid-item-module__details .ebay-estimation {
    width: 100% !important;
    align-self: stretch !important;
  }

  /* --- Amber variant — home page (item + tax only) ----------------------- */
  /* The home feed exposes no per-card shipping, so its box shows item + tax
     only. A gold palette marks it as distinct from the purple full-landed-total
     box and reads as informational (neither positive nor negative). Every
     coloured rule above already reads --ink / --surface, so swapping just the
     two custom properties re-skins the whole variant. */
  .ebay-estimation--amber {
    --ink: #8a6100 !important;
    --surface: #fdf6e3 !important;
  }
`;

  Object.assign(ES, { BOX_CSS });
})();
