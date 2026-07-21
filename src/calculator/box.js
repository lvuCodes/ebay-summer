// eBay Σummer. Copyright (C) 2026 lvuCodes. Licensed under GPL-3.0-or-later; see LICENSE.md.
//
// DOM builder for the purple/amber estimation box (makeBox) and its
// lazily-built per-unit panel (buildPerUnitPanel). Depends on config (state),
// the pure calc helpers, and the live-refresh glue in live.js — all pulled from
// ES at load time (config.js, calc.js, and live.js load first). The orange bid
// calculator lives in bid-calc.js.
(function () {
  "use strict";
  const ES = (globalThis.ES = globalThis.ES || {});
  const { config, boxParts, shipFlag, clampCount, parseCount, perUnitText, registerLive, refreshLive, perUnit } = ES;

  // Build the lazily-created per-unit panel: an "Item count" stepper (whole
  // numbers, min 1) and a live "$X.XX/unit" line = estimated total / count. Owns
  // its own count state; buttons stopPropagation so clicks don't follow the card's
  // surrounding <a>. Only called the first time a box's toggle is opened.
  // `basis` is a MUTABLE object holding the four total bounds — read at render
  // time, not captured — so the main box's live price refresh can update the
  // per-unit line in place by writing new totals onto the same object.
  function buildPerUnitPanel(basis, reportCount) {
    const panel = document.createElement("div");
    panel.className = "ebay-estimation__panel";
    // Stacked vertically: stepper (input) on top, then the "Cost per unit" label,
    // then the "$X.XX/unit" line — so the expanding panel reads top-to-bottom.
    panel.innerHTML =
      `<span class="ebay-estimation__stepper">` +
      `<button type="button" class="ebay-estimation__step" data-step="-1" aria-label="decrease count">−</button>` +
      `<input type="text" class="ebay-estimation__count" value="1" aria-label="item count or =formula" title="count or =formula (e.g. =12*18)">` +
      `<button type="button" class="ebay-estimation__step" data-step="1" aria-label="increase count">+</button>` +
      `</span>` +
      `<span class="ebay-estimation__field-label">Cost per unit</span>` +
      `<div class="ebay-estimation__perunit"></div>` +
      // A <button> (not a native checkbox): compact cards live inside the card's
      // <a href="/itm/…">, where a checkbox click both toggles AND follows the link;
      // a button we can cleanly preventDefault.
      `<button type="button" class="ebay-estimation__ship" aria-pressed="false" title="Include shipping in the per-unit price">` +
      `<span class="ebay-estimation__ship-box" aria-hidden="true"></span>` +
      `<span>Incl. shipping</span>` +
      `</button>`;
    const countEl = panel.querySelector(".ebay-estimation__count");
    const perEl = panel.querySelector(".ebay-estimation__perunit");
    const shipBtn = panel.querySelector(".ebay-estimation__ship");

    // Shipping-inclusion is PER PANEL. Compact cards keep their own local flag so
    // toggling one card doesn't touch the others; the MAIN listing box publishes to
    // the shared perUnit so the bid calculator (same item) tracks it. This is an
    // ephemeral in-box control (no popup setting backs it anymore), so it always
    // STARTS with shipping INCLUDED — the landed per-unit cost is the useful default
    // and a stale stored `perUnitShipping:false` from the old popup toggle can't pin
    // it off.
    let localInc = true;
    if (reportCount) perUnit.includeShip = localInc;
    function getInc() {
      return reportCount ? perUnit.includeShip : localInc;
    }

    // Update just the per-unit line from a count (used live while typing so the
    // input keeps the raw text and the caret doesn't jump). Picks the total basis
    // from the live "include shipping in price per item" setting, and — for the
    // main box — publishes the count so the bid calculator tracks it.
    // `activate` marks the shared per-unit state ACTIVE (so the bid calculator
    // starts showing its own "/unit" line). Only genuine user engagement passes
    // true; the initial commit and live settings re-renders pass false, so an
    // eagerly-built (but untouched) panel doesn't switch the bid-calc line on.
    // A false activate still reports the count (active left unchanged via null).
    function render(count, activate) {
      const inc = getInc();
      // Note the shipping basis on the /unit line — but only when shipping actually
      // changes it (paid ship); for free/unknown ship the two bases are identical,
      // so the note would be noise.
      const hasShip = basis.totalLow !== basis.totalNoShipLow;
      perEl.textContent =
        perUnitText(
          inc ? basis.totalLow : basis.totalNoShipLow,
          inc ? basis.totalHigh : basis.totalNoShipHigh,
          count
        ) + (hasShip ? (inc ? " (incl. ship)" : " (excl. ship)") : "");
      if (reportCount) perUnit.set(count, activate ? true : null);
    }
    // Rewrite the field to the canonical whole number and update the line (used on
    // commit and after the +/- steppers).
    function commit(count, activate) {
      const c = clampCount(count);
      countEl.value = String(c);
      render(c, activate);
    }

    // Live while typing: resolve the value (plain number or "=formula") but leave
    // the raw text in the field so the caret doesn't jump.
    countEl.addEventListener("input", function () {
      render(parseCount(countEl.value), true);
    });
    // On commit, resolve any formula to its canonical whole number.
    countEl.addEventListener("change", function () {
      commit(parseCount(countEl.value), true);
    });
    countEl.addEventListener("blur", function () {
      commit(parseCount(countEl.value), true);
    });
    // Cards are wrapped in <a>; keep focus/click/keys from following the link, and
    // commit on Enter.
    countEl.addEventListener("click", function (e) {
      e.stopPropagation();
    });
    countEl.addEventListener("keydown", function (e) {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        commit(parseCount(countEl.value), true);
      }
    });

    panel.querySelectorAll(".ebay-estimation__step").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        commit(parseCount(countEl.value) + Number(btn.getAttribute("data-step")), true);
      });
    });

    // "Incl. shipping" toggle — per-unit shipping basis for THIS card only. Flips the
    // local flag (or, for the main box, the shared one so the bid calc follows) and
    // re-renders just this panel's line. preventDefault stops the card <a> navigating.
    function paintShip() {
      shipBtn.setAttribute("aria-pressed", String(!!getInc()));
    }
    paintShip();
    shipBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      const next = !getInc();
      if (reportCount) perUnit.setIncludeShip(next); // main item: notify the bid calc
      else localInc = next; // compact card: local only, other cards untouched
      paintShip();
      render(parseCount(countEl.value), false);
    });

    commit(1, false);
    // Re-render this panel's per-unit line + sync its "incl. shipping" state in place
    // on a live refresh (e.g. the main box's live price update), keeping the panel
    // expanded — a full rebuild would collapse it.
    registerLive(panel, function () {
      paintShip();
      render(parseCount(countEl.value), false);
    });
    return panel;
  }

  // Build the purple estimation element. Uses config.taxRate (live). The
  // caller passes `large` for the main listing price box; every other placement
  // (cards, rows) uses the compact base look. A toggle button (top-right) reveals
  // a per-unit breakdown panel that is built on first open (lazy).
  // labelPrefix (optional): a short tag prepended to the "Est. total" label — used on
  // dual-format (auction + Buy It Now) listings to distinguish the two stacked main
  // boxes ("Bid · Est. total" vs "Buy It Now · Est. total"). Folded into paint() so it
  // survives the live price refresh instead of being wiped on the next repaint.
  // pickupOnly (optional): the card's only fulfilment is local pickup (no shipping) —
  // surfaces a 📍🏃 in the shipping-flag slot in place of a 🟢/🟡/🔴 circle.
  function makeBox(itemCost, shipping, large, itemHigh, variant, noToggle, labelPrefix, pickupOnly) {
    // The amber (home) box has no shipping data, so label it "TBD" rather than
    // "n/a" (the shipping exists, it's just not on the home feed).
    const unknownTxt = variant === "amber" ? "TBD" : undefined;
    const box = document.createElement("div");
    box.className =
      "ebay-estimation" +
      (large ? " ebay-estimation--lg" : "") +
      (variant ? " ebay-estimation--" + variant : "") +
      (noToggle ? " ebay-estimation--no-toggle" : "");
    box.setAttribute("data-ebay-total", "1");

    const body = document.createElement("div");
    body.className = "ebay-estimation__body";
    // The label/amount/sub live in a __main column; the per-unit panel is appended
    // as its SIBLING (not inside __main). Compact boxes stack them (panel below);
    // the large listing box (--lg) lays __main | panel side by side so the panel
    // expands to the RIGHT.
    body.innerHTML =
      `<div class="ebay-estimation__main">` +
      `<span class="ebay-estimation__label"></span>` +
      `<span class="ebay-estimation__amount"></span>` +
      `<span class="ebay-estimation__sub"></span>` +
      `</div>`;
    const labelEl = body.querySelector(".ebay-estimation__label");
    const amountEl = body.querySelector(".ebay-estimation__amount");
    const subEl = body.querySelector(".ebay-estimation__sub");

    // The per-unit panel reads its totals from this MUTABLE object (not captured
    // constants), so paint() can update the basis in place and the open panel
    // re-renders from the new price.
    const basis = { totalLow: 0, totalHigh: null, totalNoShipLow: 0, totalNoShipHigh: null };

    // Compute the box's text from a price and paint the label/amount/sub in place.
    // The large listing box shows the base-price breakdown ("US $base + $tax tax +
    // $ship ship"); compact boxes keep the standard "incl. tax" sub.
    function paint(cost, ship, high) {
      const p = boxParts(cost, ship, config.taxRate, high, unknownTxt);
      // The 🟢/🟡/🔴 shipping-cost dot — and the 📍 pickup-only flag that replaces it —
      // are gated by the same sub-toggle (default on).
      const shipDot = config.flagShipping
        ? shipFlag(cost, ship, config.shipPct, config.shipFloor, pickupOnly)
        : "";
      labelEl.textContent = (labelPrefix ? labelPrefix + " · " : "") + p.label;
      // eBay italicises a ranged price on its own cards, so a ranged estimate
      // reads as one too. Deliberately NOT gated on flagRange — that toggle owns
      // the 🚦 warning, while the italic is just how a range is spelled here.
      // Toggled rather than added: paint() re-runs on live refresh, and a card
      // whose price stops being a range must lose the italic again.
      amountEl.classList.toggle("ebay-estimation__amount--range", !!p.range);
      // 🚦 prefixes a price range (gated by flagRange — "Warn on ranged items");
      // the shipping dot (🟢/🟡) trails the amount.
      amountEl.innerHTML =
        (p.range && config.highlightEnabled && config.flagRange
          ? `<span class="ebay-estimation__flag">🚦</span> `
          : "") +
        p.amount +
        (shipDot ? ` <span class="ebay-estimation__flag">${shipDot}</span>` : "");
      subEl.textContent = large ? p.breakdown : p.sub;
      basis.totalLow = p.totalLow;
      basis.totalHigh = p.totalHigh;
      basis.totalNoShipLow = p.totalNoShipLow;
      basis.totalNoShipHigh = p.totalNoShipHigh;
    }
    paint(itemCost, shipping, itemHigh);

    box.appendChild(body);

    let panel = null;
    // The large listing box builds its per-unit panel EAGERLY (compact boxes stay
    // lazy): in wide views the panel is always shown beside the total with no
    // toggle, so it has to exist up front for the ResizeObserver/CSS to reveal it.
    // Starts hidden so narrow views collapse it behind the toggle by default.
    if (large) {
      panel = buildPerUnitPanel(basis, true);
      panel.setAttribute("hidden", "");
      body.appendChild(panel);
    }

    // Per-unit toggle (⏵ large / ⏷ compact). Omitted when noToggle is set — the
    // non-main purple cards on the listing page, whose per-unit panel is unreachable
    // anyway because eBay's card-level click navigation can't be reliably suppressed.
    if (!noToggle) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "ebay-estimation__toggle";
      toggle.title = "Per-item cost";
      toggle.setAttribute("aria-expanded", "false");
      const arrowClosed = large ? "⏵" : "⏷";
      const arrowOpen = large ? "⏴" : "⏶";
      toggle.textContent = arrowClosed;
      toggle.addEventListener("click", function (e) {
        // Cards are wrapped in <a>; keep the toggle from navigating.
        e.preventDefault();
        e.stopPropagation();
        if (!panel) {
          // Only the large (main listing) box publishes its count to the shared
          // per-unit state, so the bid calculator tracks the item you're bidding on
          // rather than a carousel card.
          panel = buildPerUnitPanel(basis, !!large);
          panel.setAttribute("hidden", "");
          body.appendChild(panel);
        }
        const willOpen = panel.hasAttribute("hidden");
        panel.toggleAttribute("hidden", !willOpen);
        toggle.textContent = willOpen ? arrowOpen : arrowClosed;
        toggle.setAttribute("aria-expanded", String(willOpen));
      });
      box.appendChild(toggle);
    }

    // Large main listing box only: expose an in-place refresh so renderListing can
    // re-read the live auction price each observer tick and repaint the numbers
    // WITHOUT rebuilding the node — preserving its position and any open per-unit
    // panel, and avoiding the end-of-auction jank that a teardown/re-insert caused.
    // Skips the repaint when the price is unchanged so it doesn't churn every tick.
    if (large) {
      // Responsive split. When the box is wide enough that the per-unit half can
      // take 50% without dropping below its min width — i.e. box width ≥ 2× the
      // panel's min-width, so 50% of the box > that min — flag it `--wide`: CSS
      // then lays the est-total and per-unit halves side by side at ~50/50 and
      // drops the collapse toggle (the panel is always visible). Below that the
      // panel stays collapsed behind the toggle. A ResizeObserver (not a CSS
      // container query) drives this — container-type on the box inflated eBay's
      // card grids and caused horizontal page scroll.
      const PER_UNIT_MIN = 220; // px — keep in sync with the --wide __panel min-width in css.js
      const applyWide = () => {
        box.classList.toggle("ebay-estimation--wide", box.clientWidth >= PER_UNIT_MIN * 2);
      };
      if (typeof ResizeObserver === "function") {
        const ro = new ResizeObserver(applyWide);
        ro.observe(box);
        box._ro = ro; // held by the box so it's GC'd together when the box is cleared
      }

      box._priceKey = itemCost + "|" + shipping + "|" + itemHigh;
      box._refresh = function (cost, ship, high) {
        const key = cost + "|" + ship + "|" + high;
        if (key === box._priceKey) return; // price unchanged — no DOM writes
        box._priceKey = key;
        paint(cost, ship, high);
        refreshLive(); // repaint an open per-unit panel / the bid calc from the new basis
      };
    }
    return box;
  }

  Object.assign(ES, { makeBox });
})();
