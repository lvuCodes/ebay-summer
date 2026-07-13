# Changelog

All notable changes to eBay Σummer. Versions follow the extension's `manifest.json` version, and each release is packaged as a zip under [releases/](releases/).

## [1.1.1] — 2026-07-17

Cosmetic and organizational release — visual polish and internal cleanup only, with no change to how the calculator, tax, shipping, or alerts behave.

### Changed

- **Purple-logo extension icons.** The 16 / 48 / 128 px action icons are regenerated from the purple logo so the toolbar button and `chrome://extensions` card match the rest of the brand.
- **Estimation box and widget polish.** The estimated-total box and bid-calculator widgets are restyled, and the home page gains an amber tooltip.
- **Internal cleanup, no behavior change.** Per-feature value sanitizers move next to the settings they guard, a shared tax-rate percent formatter is factored out, and GPL license headers are added — refactors that leave the extension's behavior identical.
- Release packages are renamed to drop the `release-` prefix: `v1.0.0.zip`, `v1.1.0.zip`, `v1.1.1.zip`.

Package: [`releases/v1.1.1.zip`](releases/v1.1.1.zip)

## [1.1.0] — 2026-07-13

Fixes the bid calculator's injection into eBay's redesigned Best-Offer "Make offer" lightbox.

### Fixed

- **Best-Offer "Make offer" modal injection.** eBay's redesigned "Make offer" lightbox now hydrates into a top-document `.bo-main-container` (a price-entry step followed by a cross-origin eBayPay review iframe) instead of the legacy `.app-siolayer-main-container` flow. The calculator targets the new price-entry step correctly again.
- **Calculator no longer flickers in the offer modal.** The orange bid calculator is now seated above the stable message box; previously it was anchored beneath the price-input wrapper, which re-renders on every focus change and flashed the calc.

### Changed

- The legacy seller-initiated-offer path is kept as a fallback; the cross-origin review step is left to eBay's own total.

Package: [`releases/v1.1.0.zip`](releases/v1.1.0.zip)

## [1.0.0] — 2026-07-12

Initial standalone release — the landed-cost calculator and auction alerts, split into their own repo.

### Added

- **Estimated total box.** A dashed-purple box beside the price showing item + sales tax + shipping on listing, search, watchlist, bids/offers, and home pages.
- **Shipping dots.** A colored dot (🟢 free · 🟡 high on one count · 🔴 high on both · 📍🏃 pickup-only) flags shipping against your own thresholds.
- **Bid calculator.** On auctions and Best Offer listings, type a prospective bid (or an `=` formula) and see the live landed total — no `eval()`, back-solves a bid from a target total too.
- **Auction alerts.** A sound plus a system notification as an auction crosses your "seconds left" thresholds; click the alert to jump straight to the tab.
- **Per-item breakdown.** Expand any box for a live *@ $X.XX/unit* figure — divide a lot's total by a count, formulas included.
- **Ranges & currencies.** Multi-variation price ranges and non-US-currency listings both compute correctly from the US figures eBay shows.
- **Popup settings.** Tune the tax rate, shipping-flag thresholds, per-page toggles, and auction alerts from the toolbar popup — every field takes effect on open eBay tabs live.

Package: [`releases/v1.0.0.zip`](releases/v1.0.0.zip)
