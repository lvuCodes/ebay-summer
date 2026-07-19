# eBay Σummer

**Version 1.2.0**

A Manifest V3 Chrome extension that shows the approximate total cost — **item price + sales tax + shipping** — as a dashed-purple "Est. total" box on eBay pages, so you can compare landed cost across listings at a glance. It ships two features: the **Estimated Total Calculator** and **Auction Ending Notifications**.

## Install

1. Download [`releases/v1.2.0.zip`](releases/v1.2.0.zip) and unzip it.
2. Open `chrome://extensions` and enable **Developer mode** (top right).
3. **Load unpacked** → select the unzipped `v1.2.0/` folder.
4. Visit an eBay listing, search, or bids/offers page — the boxes appear automatically.

## Coverage

| Page          | URL                      | Placement                                                                                                                                                           |
| ------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Listing       | `/itm/…`                 | Box beside the main price, a compact box on each related-items carousel card, and — on auctions/Best Offers — a full-width bid calculator under the condition field |
| Search        | `/sch/…`                 | Compact box under each result's price                                                                                                                               |
| Watchlist     | `/mye/myebay/watchlist`  | Compact box under each saved item's price                                                                                                                           |
| Bids & Offers | `/mye/myebay/bidsoffers` | Compact box under each row's shipping cost                                                                                                                          |
| Home          | `/`                      | Amber box under each feed card's price (item + tax only)                                                                                                            |

Each page type has its own on/off switch in the popup's **Show Est. Total On…** section. A master **Extension enabled** toggle (bottom-right of the popup) turns everything off at once.

## Reading the box

- **Shipping dot** next to the total: 🟢 free · 🟡 shipping high on one threshold · 🔴 high on both · 📍🏃 pickup only · *(no dot)* paid shipping within thresholds or unknown. The two thresholds (flat-$ floor and % of item price) are set in the popup.
- **Amber box (home page):** eBay's home feed has no per-card shipping, so the home box shows **item + tax only**.
- **Price ranges** (multi-variation items) render the estimate and tax as ranges too.
- **International listings** compute from the US-equivalent figures eBay shows alongside the seller's local price.
- **Per-item breakdown:** the toggle in each box's corner opens an **Item count** field (accepts `=`-prefixed formulas, e.g. `=12*18`) and shows a live per-unit price.

## Bid calculator

On an auction or Best Offer listing, an orange **Bid calculator** box appears under the condition field. Enter a prospective bid — or a `=`-prefixed formula — and it shows the estimated landed total (bid + tax + shipping) live.

## Auction ending notifications

On a listing page, the extension watches the auction countdown and fires a system notification (and optional sound) as it crosses your configured "seconds left" thresholds. **Clicking the notification focuses the tab it came from.** Configure it in the popup's *Auction Ending Notification* section: a sound picker with preview, two independently-toggled thresholds (defaults **60s** and **30s**), and an optional persistent "Auction ended" badge. Scoped to listing pages only.

## Settings

Set everything from the toolbar **popup** (click the extension icon). Changes apply to open eBay tabs live. The popup also has a **Reload all eBay tabs** button.

Settings are stored in `chrome.storage.sync`. Defaults: **8.25%** tax (item only, never shipping), **$10** flat shipping floor, **50%** shipping percentage. You can also set them directly from the console:

```js
chrome.storage.sync.set({ taxRate: 0.10, shipFloor: 8, shipPct: 0.4 }); // recomputes live
```

## Details

Full behaviour, the complete settings-key reference, and implementation notes live in [specs/](specs/). Release history is in [CHANGELOG.md](CHANGELOG.md).

