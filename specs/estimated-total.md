# Estimated Total Calculator

The core feature: an "Est. total" box (item price + sales tax on the item + shipping) rendered on eBay pages.

## Money formatting

All money the extension renders is formatted through one shared `fmtMoney` helper (in `calc.js`) that adds **thousands separators**, so large amounts read `US $1,823.75` rather than `US $1823.75`. It's display-only — the editable bid/total input fields keep plain unformatted values so they re-parse cleanly, and parsing still strips commas on input.

## Home page box (amber)

The home feed exposes an item price per card but **no per-card shipping**, so a full landed total can't be computed there. The home box therefore shows **item + tax only** and is colored **deep amber/gold** (`#b8860b`) to read as distinct from the purple full-total box and the orange bid calculator. Its shipping sub-line reads `+ ship TBD`. Cards are `article[__typename="GridItemModule"]`; the price is `.bc-item-detail-price` (or the `<ins>` inside `.bc-item-detail-price-discounted` for on-sale items). The box is inserted after the card's `<a>` so it sits outside the click target.

Boxes appear on lazy-loaded carousels as you scroll (a `MutationObserver` re-runs the renderer as cards hydrate). Re-running is idempotent — no duplicate boxes.

## Shipping dots

Next to the total, a colored dot flags the shipping at a glance:

- 🟢 **free** shipping.
- 🟡 shipping high on **one** count — exceeds *either* the flat floor (default **$10**) *or* the set percentage of the item price (default **50%**). A big absolute cost trips the floor; a small-but-disproportionate cost on a cheap item trips the percentage.
- 🔴 shipping high on **both** counts — exceeds the flat floor *and* the percentage.
- 📍🏃 **pickup only** — the item ships nowhere; its only fulfilment is local pickup, so there is no shipping figure to grade. Fills the dot slot in place of a circle.
- *(no dot)* paid shipping within both thresholds, or shipping unknown.

Both thresholds are set in the popup. Comparisons are strict (equal to a threshold is not "over").

## Price ranges

When a listing shows a price range (multi-variation items, e.g. `$46.79 - $92.49`), the box prefixes a 🟠 and renders the est total and the tax as ranges too: `🟠 US $50.65 - $100.12` / `incl. 8.25% tax ($3.86 - $7.63) + free ship`. Single-price listings are unchanged.

## International listings

When a listing is priced in a non-US currency, eBay shows the seller's local price as the primary (e.g. `AU $79.43`) with a US equivalent alongside. The est-total box **computes from the US figures** (via `parseMoneyUS`, which pulls the explicit `US $…` amount), while still sitting beside the displayed primary price. Domestic listings have only a US amount, so they fall back to the first `$` parsed as before.

## Per-item breakdown

Every box has a small toggle button in its top-right corner. Clicking it reveals a panel with an **Item count** field (whole numbers, starting at 1, with −/+ steppers) and a live **`<count> @ $X.XX/unit`** line — the estimated total divided by the count, for pricing lots and bundles per piece. Ranged prices divide both ends. The count field also accepts a **formula** — prefix with `=` (e.g. `=12*18` → 216). The panel is built on first open (lazy) and keeps its own count per box.

On the **main listing box** the panel expands to the **right** of the total; the compact card boxes keep the stacked, expand-down layout. The per-unit basis is controlled by the **Include shipping in price per item** checkbox in the popup (default **on**): on, the per-unit line divides the whole landed total; off, it divides item + tax only.

## Pickup-only flag

When an item's only fulfilment is local pickup — it ships nowhere — the estimation box has no shipping figure to grade, so its shipping-dot slot shows a **📍🏃** in place of a 🟢/🟡/🔴 circle. It rides the same **shipping-flag** toggle as the colored dots (no separate setting). A card is treated as pickup-only when a leaf mentions pickup **and no leaf mentions shipping/delivery** (`isPickupOnly`); on the single-item listing page detection is by class instead (`listingIsPickupOnly` — eBay renders a `.ux-labels-values--localPickup` row in place of the usual `.ux-labels-values--shipping` row).
