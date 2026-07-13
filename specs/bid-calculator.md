# Bid calculator

On an **auction listing** (a page with bidding) **or a Best Offer listing** (a make-offer action) — not a plain fixed-price Buy-It-Now — a dashed-**orange** "Bid calculator" box appears **directly under the condition field**, stretched to the full width of that column. (Gated on `.x-bid-*` / `.x-offer-action`.) Enter a prospective bid and it shows the estimated landed total (bid + tax on the bid + shipping) live:

- **Plain number** — `[40] → US $53.30`
- **Formula** — prefix with `=` to enter an arithmetic expression (`+ - * / ( )`, decimals, unary sign): `[=2*40+15] = $95.00 → US $117.84`. Malformed input turns the input border red and leaves the total as `—`.

A sub line beneath the total mirrors the purple box's exact wording — `incl. 8.25% tax ($11.84) + $14.18 ship`. When the purple box's per-unit panel is in use, the bid calculator auto-appends a **`($X.XX/unit)`** figure using that same shared item count.

The expression evaluator is a small recursive-descent parser — **no `eval()`** — so the field can't execute arbitrary code.
