# eBay Σummer

**Version 1.0.0**

A Manifest V3 Chrome extension that shows the true landed cost — **item price + sales tax on the item + shipping** — as a dashed-purple "Est. total" box on eBay pages, so you can compare real cost across listings at a glance. This v1.0.0 release ships two features: the **Estimated Total Calculator** and **Auction Ending Notifications**.

## Coverage

| Page | URL | Placement |
|---|---|---|
| Listing | `/itm/…` | Large box beside the main price, plus a compact box on every related-items carousel card; on auctions, a full-width orange **bid calculator** under the condition field |
| Search | `/sch/…` | Compact box under each result card's price |
| Watchlist | `/mye/myebay/watchlist` | Compact box under each saved item's price |
| Bids & Offers | `/mye/myebay/bidsoffers` | Compact box under each row's shipping cost |
| Home | `/` | Compact **amber** box under each feed card's price (item + tax only — see below) |

Each page type has an independent on/off switch in the popup's **Show Est. Total On…** section (all on by default). Turning one off skips box injection on that page type only. A master **Extension enabled** toggle (bottom-right of the popup) turns the whole extension off at once.

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

## Bid calculator

On an **auction listing** (a page with bidding) **or a Best Offer listing** (a make-offer action) — not a plain fixed-price Buy-It-Now — a dashed-**orange** "Bid calculator" box appears **directly under the condition field**, stretched to the full width of that column. (Gated on `.x-bid-*` / `.x-offer-action`.) Enter a prospective bid and it shows the estimated landed total (bid + tax on the bid + shipping) live:

- **Plain number** — `[40] → US $53.30`
- **Formula** — prefix with `=` to enter an arithmetic expression (`+ - * / ( )`, decimals, unary sign): `[=2*40+15] = $95.00 → US $117.84`. Malformed input turns the input border red and leaves the total as `—`.

A sub line beneath the total mirrors the purple box's exact wording — `incl. 8.25% tax ($11.84) + $14.18 ship`. When the purple box's per-unit panel is in use, the bid calculator auto-appends a **`($X.XX/unit)`** figure using that same shared item count.

The expression evaluator is a small recursive-descent parser — **no `eval()`** — so the field can't execute arbitrary code.

## Tax rate

Defaults to **8.25%**, applied to the item cost only (never to shipping). Set it from the toolbar **popup** (click the extension icon), which also holds the two shipping-dot thresholds. Every field takes effect on open eBay tabs live.

Stored in `chrome.storage.sync` (rates as decimals):

| Key | Meaning | Default | Popup field |
|---|---|---|---|
| `taxRate` | sales tax on the item | `0.0825` | Sales tax (%) |
| `shipFloor` | flat-$ shipping-flag threshold | `10` | Flat amount ($) |
| `shipPct` | %-of-item shipping-flag threshold | `0.5` | % of item |
| `flagShipping` | show the shipping-flag dots at all | `true` | Flag shipping when it exceeds… (toggle) |
| `perUnitShipping` | fold shipping into the per-unit price | `true` | Include shipping in price per item |
| `pageListing` | show boxes on listing pages | `true` | Show Est. Total On… → Listing pages |
| `pageSearch` | show boxes on search results | `true` | Show Est. Total On… → Search results |
| `pageWatchlist` | show boxes on the watchlist | `false` | Show Est. Total On… → Watchlist |
| `pageBidsOffers` | show boxes on Bids & Offers | `false` | Show Est. Total On… → Bids & Offers |
| `pageHome` | show boxes on the home page | `false` | Show Est. Total On… → Home page |
| `pageSummary` | show boxes on My eBay Summary | `false` | Show Est. Total On… → Summary |
| `pageRecentView` | show boxes on Recently viewed | `false` | Show Est. Total On… → Recently viewed |
| `pageSaved` | show boxes on the Saved feed | `false` | Show Est. Total On… → Saved feed |
| `enabled` | master on/off for the whole extension | `true` | Extension enabled (bottom-right) |
| `estTotal` | section master for the est-total boxes + bid calculator | `true` | Estimated Total Calculator (header toggle) |
| `notifyEnabled` | section master for the auction-ending alerts | `false` | Auction Ending Notification (header toggle) |
| `notifyAt1` | first alert threshold (seconds left) | `60` | Auction Ending Notification → First alert |
| `notifyAt2` | second alert threshold (seconds left) | `30` | Auction Ending Notification → Second alert |
| `notifyEnabled1` | first alert on/off | `false` | Auction Ending Notification → First alert (toggle) |
| `notifyEnabled2` | second alert on/off | `false` | Auction Ending Notification → Second alert (toggle) |
| `notifySound` | auction-ending alert sound preset | `"coin"` | Auction Ending Notification → Sound |
| `notifySoundEnabled` | play the alert chime with the notification | `false` | Auction Ending Notification → Sound (toggle) |
| `notifyEndedPersist` | leave a persistent "auction ended" badge when the listing ends | `false` | Auction Ending Notification → Persistent auction ended notification |

You can also set any of them directly:

```js
chrome.storage.sync.set({ taxRate: 0.10, shipFloor: 8, shipPct: 0.4 }); // recomputes live
```

## Auction ending notifications

On a **listing page** (`/itm/`), a 1-second poller reads the auction countdown and, as it crosses a configured "seconds left" threshold, plays the chosen alert sound and fires a system notification. **Clicking the notification focuses the tab it came from.** Configured in the popup's *Auction Ending Notification* section: a **Sound** picker (Coin — default, Chime, Bell, Ding, Arcade) with a **▶ preview** button, then each of the two alerts has its own **enable toggle** plus a threshold in seconds (defaults **60** and **30**), and a **Persistent auction ended notification** toggle. An alert fires only when its toggle is on and its threshold is above 0. Scoped to listing pages only — the bids/search pages have many simultaneous countdowns and would fire a burst, so they're deliberately not watched.

A threshold fires only when the poller **watches the countdown cross it** — thresholds already past when the tab is opened are seed-suppressed, so opening a listing at 45s left never retro-fires the 60s alert (the 30s one still fires normally). When the auction ends (the countdown disappears), the tab's outstanding "ending soon" badges **auto-dismiss**; with *Persistent auction ended notification* on, a single persistent **"Auction ended"** badge is left in their place (also click-to-focus). Opening a listing that has already ended raises nothing.

Sounds are synthesized presets in `SOUNDS` (Web Audio, nothing bundled); `playSound(ctx, id)` is shared by the content script (timer-fired) and the popup (on-demand preview).

- **Countdown source:** `.ux-timer__text`. `parseTimeLeft` normalizes every format (`Ends in 55m 0s`, `2m 28s left`, `2h 4m left`, `1d 3h left`, bare `45s`) to seconds.
- **State machine** (`tickAlerts` in `alerts.js`, pure): each tick takes the current remaining seconds + enabled thresholds and a caller-owned `{ armed, ended, notified }` state, returning which thresholds to fire and whether the auction just ended. Dedup is keyed by **threshold** at the page level, so the listing's mirrored countdowns collapse to one alert.
- **Notification + click-to-focus + auto-dismiss** live in a background service worker (`background.js`). The target tab/window is encoded into the notification id (`ebay|<tabId>|<windowId>|<stamp>`), so a click still focuses the right tab even after the MV3 worker has been torn down and restarted.

## Pickup-only flag

When an item's only fulfilment is local pickup — it ships nowhere — the estimation box has no shipping figure to grade, so its shipping-dot slot shows a **📍🏃** in place of a 🟢/🟡/🔴 circle. It rides the same **shipping-flag** toggle as the colored dots (no separate setting). A card is treated as pickup-only when a leaf mentions pickup **and no leaf mentions shipping/delivery** (`isPickupOnly`); on the single-item listing page detection is by class instead (`listingIsPickupOnly` — eBay renders a `.ux-labels-values--localPickup` row in place of the usual `.ux-labels-values--shipping` row).

## Files

- `manifest.json` — MV3; content scripts on `*://www.ebay.com/*`.
- `src/` — the content-script modules, loaded in dependency order (no bundler). Each attaches its public API to one shared namespace, `globalThis.ES`, and reads its dependencies back off it. One directory per feature plus a feature-agnostic core; each feature plugs into the core via two registries (`registerSettings` for its persisted-settings schema, `registerFeature` for its runtime hooks).
  - `core/` — feature-agnostic infrastructure: `registry.js` (the two registries + stylesheet assemblers), `early.js` (the `document_start` FOUC injector + the URL page-kind dispatch), `sanitize.js` (value sanitizers), `defaults.js` (assembles `DEFAULTS`), `config.js` (the mutable `config` + live-only keys), `settings.js` (storage → `config` sanitization + legacy migrations), `style.js` (stylesheet maintenance + master-off strip), `content.js` (the dispatcher).
  - `calculator/` — the Estimated Total Calculator: `schema.js` (settings), `calc.js` (the pure calculation/parsing core — no DOM, fully testable), `live.js` (live-refresh glue + shared per-unit count), `css-box.js` / `css-widgets.js` (stylesheets), `pickup.js` (pickup-only detection), `box.js` (estimation-box builder), `bid-calc.js` (bid-calculator builder), `render-cards.js` / `render-listing.js` (the page renderers), `feature.js` (route table + registration).
  - `notifications/` — the auction-ending alerts: `schema.js` (settings), `sounds.js` (Web-Audio presets + `playSound`), `alerts.js` (the pure countdown parser + alert state machine), `notify.js` (the once-a-second watcher + registration).
- `background.js` — service worker: turns "ending soon" messages into click-to-focus notifications.
- `icons/` — the shipped extension + notification icons (`icon16/48/128.png`).
- `popup/` — toolbar popup for all settings (`popup.html` / `popup.js` / `popup.css` + `popup-controls.css`); reuses the shared sanitizers. Also has a **Reload all eBay tabs** button that reloads every open `*.ebay.com` tab in one click.

## Load it

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. **Load unpacked** → select this `release-v1/` folder.
4. Visit an eBay listing, search, or bids/offers page — the boxes appear automatically.

After editing any file, click the reload icon on the extension card and refresh the eBay tab.

## Limitations

- **Home page shows no shipping**, so its box is item + tax only (the amber box). No workaround — eBay doesn't put per-card shipping in the home feed DOM.
- **Auction alerts are scoped to listing pages** — the bids/search pages have many simultaneous countdowns, so the poller doesn't run there.
