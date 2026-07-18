# Changelog

All notable changes to eBay Σummer. Versions follow the extension's `manifest.json` version, and each release is packaged as a zip under [releases/](releases/).

## [1.1.1] — 2026-07-18

Restores the estimated total box on search results, which eBay's July 2026 card reskin had silently disabled.

### Fixed

- **Estimated total box on search results.** eBay renamed the search-result card markup — `.su-item-card` became `.s-card`, its price moved from `.su-item-card__price-container` into a `.s-card__attribute-row`, and the card's own header element was dropped. The old class names matched nothing, so no boxes were drawn on search. Both the old and the reskinned markup are now matched, so pages still serving the old layout keep the box exactly where it was.
- **Understated totals on price ranges.** The reskin splits a range across three separate elements (`$10.75` · ` to ` · `$30.93`) where the old markup held it in one, so only the low end was read and the estimate ignored the top of the range — on the 18 July capture, 21 of 250 results. The range is now reassembled from the price's own attribute row, which leaves an auction card's separate Buy It Now price out of it.
- **Related-item carousels on listing pages.** These carry search-style cards and take the same fixes.

### Changed

- **Ranged totals are italicised**, matching how eBay spells a ranged price on its own cards. This is independent of the "Warn on ranged items" toggle, which still owns the 🚦 flag.

### Known Issues

- Recently viewed does not draw boxes — eBay's markup moved there too, and no capture is on hand to pin the new selectors. Its toggle is hidden for this release rather than offering a switch that does nothing; the setting itself is untouched, so turning it back on later restores whatever was set.

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
