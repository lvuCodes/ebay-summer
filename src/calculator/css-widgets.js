// eBay Σummer. Copyright (C) 2026 lvuCodes. Licensed under GPL-3.0-or-later; see LICENSE.md.
//
// Widget CSS: the orange bid calculator and the Best-Offer modal seatings —
// the second half of the calculator's static stylesheet (css-box.js holds the
// box half; feature.js concatenates the two into the calculator's sharedCss
// contribution). Pure data, no dependencies.
(function () {
  "use strict";
  const ES = (globalThis.ES = globalThis.ES || {});

  const WIDGET_CSS = `
  /* --- Bid calculator (orange) — listing/auction pages ------------------- */
  /* Orange sibling of the purple .ebay-estimation box, seated directly UNDER the
     condition field and stretched to the full width of that column, so its size
     is fixed by the layout — the input has a fixed width and the box does NOT
     grow/shrink as you type. Roomier (taller + wider) than the compact boxes.
     Same two-property palette as the estimation box: --ink (borders, text) and
     --surface (background + hover tint), so no orange is ever hardcoded twice.
     The below-shipping warning + unparseable-input states keep their own reds —
     they signal error, not brand. */
  .ebay-bid-calc {
    --ink: #b35a00 !important;
    --surface: #fff4e6 !important;
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    /* Size containment in the inline axis: the box's width is taken purely from its
       container (100% of the column), and its CONTENTS can no longer feed an
       intrinsic (max-content) width back up. Without this, eBay's content-sized
       .vi-grid track grows/shrinks with what's typed — a long formula, the "= $x"
       echo, or the per-unit tail changing the box's intrinsic width re-proportions
       the whole listing grid (gallery vs details) and makes the page reflow as you
       type. Containment breaks that feedback loop; the inner grid still lays out
       normally within the fixed width, and long text scrolls inside the inputs. */
    contain: inline-size !important;
    overflow: hidden !important;
    margin: 12px 0 3px !important;
    padding: 10px 12px !important;
    border: 1px dashed var(--ink) !important;
    border-radius: 8px !important;
    background: var(--surface) !important;
    color: var(--ink) !important;
    line-height: 1.2 !important;
  }
  .ebay-bid-calc__label {
    display: block !important;
    font-size: .72rem !important;
    line-height: 1.2 !important;
    font-weight: 700 !important;
    letter-spacing: .04em !important;
    text-transform: uppercase !important;
    color: var(--ink) !important;
  }
  /* Header row: the "Bid calculator" label on the left, the ✕ Clear button pushed
     to the far right of the same row. */
  .ebay-bid-calc__head {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 14px !important;
    margin-bottom: 6px !important;
  }
  /* Clear-both-fields button, sitting next to the label. */
  .ebay-bid-calc__reset {
    padding: 6px 9px !important;
    margin: 0 !important;
    border: 1px solid var(--ink) !important;
    border-radius: 6px !important;
    background: #fff !important;
    color: var(--ink) !important;
    font-size: .8rem !important;
    font-weight: 700 !important;
    line-height: 1 !important;
    white-space: nowrap !important;
    cursor: pointer !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 4px !important;
  }
  .ebay-bid-calc__reset:hover { background: color-mix(in srgb, var(--ink) 12%, var(--surface)) !important; }
  /* Grid: row 1 is [ bid field | ⇄ | total field ] with both inputs on the SAME row
     so they line up; row 2 holds the "incl…" sub line in the total column (right of
     the arrows, under the total field). Both fields are fixed-width so the box never
     resizes with what's typed; the total column's 1fr absorbs the trailing slack. */
  .ebay-bid-calc__row {
    display: grid !important;
    /* Two equal 1fr field columns with the arrow's auto column between them, so the
       bid and total fields each fill HALF the box's width (mirroring the purple
       box's two 50% columns) instead of sitting at a fixed 9.5em with dead space to
       the right. minmax(0, …) lets them shrink below content in a narrow (contained)
       box so the inputs compress and scroll internally rather than overflowing. */
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) !important;
    grid-template-areas: "bid mid total" "fx . sub" !important;
    align-items: center !important;
    column-gap: 8px !important;
    row-gap: 4px !important;
  }
  /* Input wrapper: holds the "$" adornment + the input. The bid one takes the grid
     "bid" area; the total one sits in the total row's flex line. */
  .ebay-bid-calc__field {
    position: relative !important;
    display: inline-flex !important;
    align-items: center !important;
    min-width: 0 !important;
  }
  .ebay-bid-calc__field--bid {
    grid-area: bid !important;
    /* A 16em box centered in its 1fr half (max-width:100% lets it shrink in a narrow
       modal). Centering the wrapper — not the input inside a full-width wrapper —
       keeps the "$" adornment attached to the field's left edge. */
    width: 16em !important;
    max-width: 100% !important;
    justify-self: center !important;
  }
  /* "$" prefix inside the box — always shown, EXCEPT in "=formula" mode (a leading
     "$" before "=2*40" would be wrong); --formula (set in JS) hides it then. */
  .ebay-bid-calc__dollar {
    display: block !important;
    position: absolute !important;
    left: 8px !important;
    font-size: 1.2rem !important;
    font-weight: 800 !important;
    color: var(--ink) !important;
    line-height: 1.2 !important;
    pointer-events: none !important;
  }
  .ebay-bid-calc__field--formula .ebay-bid-calc__dollar { display: none !important; }
  /* Both fields render identically: same width, font, padding (left-padded to clear
     the "$"), border, radius. */
  .ebay-bid-calc__input,
  .ebay-bid-calc__total {
    box-sizing: border-box !important;
    /* Fill the fixed-width field wrapper (16em, centered in its 1fr half); min-width:0
       lets a narrow contained box shrink the field (text scrolls inside) not overflow. */
    width: 100% !important;
    max-width: none !important;
    min-width: 0 !important;
    padding: 6px 8px 6px 18px !important;
    margin: 0 !important;
    border: 1px solid var(--ink) !important;
    border-radius: 6px !important;
    background: #fff !important;
    color: var(--ink) !important;
    font-size: 1.2rem !important;
    font-weight: 800 !important;
    line-height: 1.2 !important;
    white-space: nowrap !important;
    /* Centered: with the fields now filling half the box, a right-aligned value
       would strand it at the far edge with a wide gap after the left "$". */
    text-align: center !important;
  }
  .ebay-bid-calc__input:focus,
  .ebay-bid-calc__total:focus { outline: none !important; border-color: var(--ink) !important; }
  /* Red border on whichever field holds unparseable text (empty is neutral). The
     class is set per-field so the reverse (total → bid) direction reddens the total
     box, not the bid box. */
  .ebay-bid-calc__input.ebay-bid-calc__field--invalid,
  .ebay-bid-calc__total.ebay-bid-calc__field--invalid { border-color: #cc0000 !important; }
  /* Below-shipping warning on both fields: thicker dark-red border + dark-red text. */
  .ebay-bid-calc__input.ebay-bid-calc__field--warn,
  .ebay-bid-calc__total.ebay-bid-calc__field--warn {
    border-color: #d60a0a !important;
    border-width: 2px !important;
    color: #d60a0a !important;
  }
  .ebay-bid-calc__input.ebay-bid-calc__field--warn::placeholder,
  .ebay-bid-calc__total.ebay-bid-calc__field--warn::placeholder { color: #d60a0a !important; opacity: 1 !important; }
  /* "⇄ (=calc)" cluster between the two fields. */
  .ebay-bid-calc__mid {
    grid-area: mid !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 8px !important;
  }
  .ebay-bid-calc__calc[hidden] { display: none !important; }
  .ebay-bid-calc__calc {
    font-size: 1.05rem !important;
    font-weight: 700 !important;
    color: var(--ink) !important;
    white-space: nowrap !important;
  }
  .ebay-bid-calc__arrow { font-size: 1.2rem !important; color: var(--ink) !important; }
  /* Formula → number readout AFTER the total field ("=2*12" ⇒ "= $24.00"), shown
     only when the total field holds an "=formula". */
  .ebay-bid-calc__total-calc[hidden] { display: none !important; }
  .ebay-bid-calc__total-calc {
    font-size: 1.05rem !important;
    font-weight: 700 !important;
    color: var(--ink) !important;
    white-space: nowrap !important;
  }
  /* Total field + per-unit share the first row of the total column. The total field
     is a 16em box centered in the 1fr half (matching the bid field); the per-unit
     tail keeps its content width beside it. */
  .ebay-bid-calc__total-line {
    grid-area: total !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 8px !important;
    width: 100% !important;
    min-width: 0 !important;
  }
  .ebay-bid-calc__field--total { flex: 0 1 16em !important; min-width: 0 !important; }
  .ebay-bid-calc__perunit[hidden] { display: none !important; }
  .ebay-bid-calc__perunit {
    font-size: .98rem !important;
    font-weight: 700 !important;
    color: var(--ink) !important;
    white-space: nowrap !important;
  }
  /* Sub sits under the total field (row 2, total column), centered under the box. */
  .ebay-bid-calc__sub {
    grid-area: sub !important;
    font-size: .8rem !important;
    line-height: 1.2 !important;
    color: var(--ink) !important;
    text-align: center !important;
  }
  /* FX line sits under the bid field (row 2, bid column), centered under the box:
     the live rate before you type, the seller-currency translation of the bid after. */
  .ebay-bid-calc__fxline[hidden] { display: none !important; }
  .ebay-bid-calc__fxline {
    grid-area: fx !important;
    font-size: .82rem !important;
    font-weight: 700 !important;
    line-height: 1.2 !important;
    color: var(--ink) !important;
    text-align: center !important;
  }

  /* --- Best-Offer modal widgets ----------------------------------------------
     Redesigned "Make offer" modal: the calc is seated above the message box (mid-form).
     Give it breathing room top and bottom. The row layout matches the listing (FX line
     under the bid field, "incl. tax + ship" sub under the total field), so the sub
     stays aligned with the second field. */
  .bo-offer-section__wrapper .ebay-bid-calc { margin: 14px 0 !important; }
  /* Legacy seller-initiated-offer lightbox: purple box + orange calc injected just
     above the modal's stacked CTA buttons (.app-sio-ctas), inside a narrow overlay.
     Give them breathing room from the details table above and the buttons below, and
     drop the on-listing top margin so the first widget sits snug. */
  .app-siolayer-main-container .ebay-estimation--lg { margin: 0 0 8px !important; }
  .app-siolayer-main-container .ebay-bid-calc { margin: 14px 0 !important; }
`;

  Object.assign(ES, { WIDGET_CSS });
})();
