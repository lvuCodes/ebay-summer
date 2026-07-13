# Settings

## Tax rate

Defaults to **8.25%**, applied to the item cost only (never to shipping). Set it from the toolbar **popup** (click the extension icon), which also holds the two shipping-dot thresholds. Every field takes effect on open eBay tabs live.

## Storage keys

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
