# Architecture

## Files

- `manifest.json` — MV3; content scripts on `*://www.ebay.com/*`.
- `src/` — the content-script modules, loaded in dependency order (no bundler). Each attaches its public API to one shared namespace, `globalThis.ES`, and reads its dependencies back off it. One directory per feature plus a feature-agnostic core; each feature plugs into the core via two registries (`registerSettings` for its persisted-settings schema, `registerFeature` for its runtime hooks).
  - `core/` — feature-agnostic infrastructure: `registry.js` (the two registries + stylesheet assemblers), `early.js` (the `document_start` FOUC injector + the URL page-kind dispatch), `sanitize.js` (value sanitizers), `defaults.js` (assembles `DEFAULTS`), `config.js` (the mutable `config` + live-only keys), `settings.js` (storage → `config` sanitization + legacy migrations), `style.js` (stylesheet maintenance + master-off strip), `content.js` (the dispatcher).
  - `calculator/` — the Estimated Total Calculator: `schema.js` (settings), `calc.js` (the pure calculation/parsing core — no DOM, fully testable), `live.js` (live-refresh glue + shared per-unit count), `css-box.js` / `css-widgets.js` (stylesheets), `pickup.js` (pickup-only detection), `box.js` (estimation-box builder), `bid-calc.js` (bid-calculator builder), `render-cards.js` / `render-listing.js` (the page renderers), `feature.js` (route table + registration).
  - `notifications/` — the auction-ending alerts: `schema.js` (settings), `sounds.js` (Web-Audio presets + `playSound`), `alerts.js` (the pure countdown parser + alert state machine), `notify.js` (the once-a-second watcher + registration).
- `background.js` — service worker: turns "ending soon" messages into click-to-focus notifications.
- `icons/` — the shipped extension + notification icons (`icon16/48/128.png`).
- `popup/` — toolbar popup for all settings (`popup.html` / `popup.js` / `popup.css` + `popup-controls.css`); reuses the shared sanitizers. Also has a **Reload all eBay tabs** button that reloads every open `*.ebay.com` tab in one click.

## Loading & development

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. **Load unpacked** → select the `release-v1/` folder.
4. Visit an eBay listing, search, or bids/offers page — the boxes appear automatically.

After editing any file, click the reload icon on the extension card and refresh the eBay tab.

## Limitations

- **Home page shows no shipping**, so its box is item + tax only (the amber box). No workaround — eBay doesn't put per-card shipping in the home feed DOM.
- **Auction alerts are scoped to listing pages** — the bids/search pages have many simultaneous countdowns, so the poller doesn't run there.
