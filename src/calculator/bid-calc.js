// eBay Σummer. Copyright (C) 2026 lvuCodes. Licensed under GPL-3.0-or-later; see LICENSE.md.
//
// DOM builder for the orange bid calculator (makeBidCalc). Depends on config
// (state), the pure bid-calc helpers (calc.js), and the live-refresh glue +
// shared per-unit state (live.js) — all pulled from ES at load time.
(function () {
  "use strict";
  const ES = (globalThis.ES = globalThis.ES || {});
  const { config, bidCalcParts, bidFromTotalParts, bidPerUnitText, registerLive, perUnit } = ES;

  // Build the orange bid calculator, seated just below the purple estimation box.
  // BIDIRECTIONAL: two linked fields either side of a ⇄. Type a BID on the left
  // (a number or "=expr" formula) and the right field fills with the landed total
  // (bid + tax + shipping); OR type the TARGET TOTAL you want to pay on the right
  // and the left fills with the bid to place (total back-solved: (total − ship) /
  // (1 + tax)). Editing one field always recomputes the other. Once the estimation
  // box's per-unit panel is in use, a trailing "($X.XX/unit)" tracks that count.
  // Tax rate + per-unit basis are read from live config, so a rebuild picks up new
  // values; the last-edited side is remembered so live refreshes recompute it.
  // `fx` (optional) = { code, rate } when the listing is priced in a foreign
  // currency (rate = USD per 1 seller-currency unit). The calculator stays in USD
  // (bid, total, tax, shipping all USD), but when fx is set it also surfaces the
  // bid translated back to the seller's currency in the mid slot — the number to
  // type into eBay's own offer/counter field, which is quoted in that currency.
  function makeBidCalc(shipping, fx) {
    const box = document.createElement("div");
    box.className = "ebay-bid-calc";
    box.setAttribute("data-ebay-total", "1");
    // Each input sits in a __field wrapper that also holds a "$" adornment (shown
    // only when the field holds a plain number — hidden when empty or in "=formula"
    // mode, where a leading "$" would be wrong).
    box.innerHTML =
      `<div class="ebay-bid-calc__head">` +
      `<span class="ebay-bid-calc__label">Bid calculator</span>` +
      `<button type="button" class="ebay-bid-calc__reset" aria-label="Clear both fields" title="Clear both fields">✕ Clear</button>` +
      `</div>` +
      `<div class="ebay-bid-calc__row">` +
      `<span class="ebay-bid-calc__field ebay-bid-calc__field--bid">` +
      `<span class="ebay-bid-calc__dollar" aria-hidden="true">$</span>` +
      `<input type="text" class="ebay-bid-calc__input" placeholder="bid or =2*4" aria-label="bid amount or =expression">` +
      `</span>` +
      `<span class="ebay-bid-calc__mid">` +
      `<span class="ebay-bid-calc__calc" hidden></span>` +
      `<span class="ebay-bid-calc__arrow">⇄</span>` +
      `</span>` +
      `<span class="ebay-bid-calc__total-line">` +
      `<span class="ebay-bid-calc__field ebay-bid-calc__field--total">` +
      `<span class="ebay-bid-calc__dollar" aria-hidden="true">$</span>` +
      `<input type="text" class="ebay-bid-calc__total" placeholder="target total" aria-label="target landed total incl. tax and shipping, or =expression">` +
      `</span>` +
      `<span class="ebay-bid-calc__total-calc" hidden></span>` +
      `<span class="ebay-bid-calc__perunit" hidden></span>` +
      `</span>` +
      // FX line under the bid field (foreign-currency listings only): the live
      // rate when empty, the bid translated to the seller's currency once typed.
      `<span class="ebay-bid-calc__fxline" hidden></span>` +
      `<span class="ebay-bid-calc__sub"></span>` +
      `</div>`;
    const bidField = box.querySelector(".ebay-bid-calc__field--bid");
    const totalField = box.querySelector(".ebay-bid-calc__field--total");
    const bidInput = box.querySelector(".ebay-bid-calc__input");
    const totalInput = box.querySelector(".ebay-bid-calc__total");
    const calcEl = box.querySelector(".ebay-bid-calc__calc");
    const totalCalcEl = box.querySelector(".ebay-bid-calc__total-calc");
    const perEl = box.querySelector(".ebay-bid-calc__perunit");
    const fxEl = box.querySelector(".ebay-bid-calc__fxline");
    const subEl = box.querySelector(".ebay-bid-calc__sub");
    const INVALID = "ebay-bid-calc__field--invalid";
    // Dark-red border + text on the bid field when the target can't cover shipping.
    const WARN = "ebay-bid-calc__field--warn";
    // Default hint in the (empty) bid field; swapped for a warning when a target
    // total that can't even cover shipping is entered on the right (see fromTotal).
    const BID_PLACEHOLDER = bidInput.getAttribute("placeholder");

    // The "$" adornment shows always, EXCEPT while a field holds an "=formula"
    // (where "$=2*40" would be wrong) — mark those fields --formula to hide it. Run
    // for BOTH fields after any recompute, since one direction writes a value into
    // the other field programmatically.
    function syncDollar() {
      [
        [bidField, bidInput],
        [totalField, totalInput],
      ].forEach(function ([field, el]) {
        field.classList.toggle("ebay-bid-calc__field--formula", el.value.trim()[0] === "=");
      });
    }

    // Shared tail: the per-unit line (auto-appears once the estimation box's
    // per-unit panel is in use) and the "incl. X% tax ($…) + $… ship" sub line.
    function paintExtras(valid, total, totalNoShip, sub) {
      if (valid && perUnit.active) {
        // Tracks the MAIN item's shipping-inclusion (published by its per-unit panel).
        perEl.textContent =
          "(" + bidPerUnitText(total, totalNoShip, perUnit.includeShip, perUnit.count) + ")";
        perEl.removeAttribute("hidden");
      } else perEl.setAttribute("hidden", "");
      subEl.textContent = sub;
    }

    // Mid slot between the bid field and the arrow: the evaluated-bid echo, shown
    // only in "=formula" mode.
    function paintMid(p) {
      if (p.isFunction && p.valid) {
        calcEl.textContent = "= " + p.calcText;
        calcEl.removeAttribute("hidden");
      } else calcEl.setAttribute("hidden", "");
    }

    // FX line under the bid field — only on a foreign-currency listing (fx set).
    // Once a bid is entered (either direction), it shows that bid translated to the
    // seller's currency: the number to type into eBay's own offer field. Empty, it
    // shows the live rate so the currency-awareness is visible before you type.
    function paintFx(p) {
      if (!fx) return; // domestic listing — line stays hidden (see initial state)
      if (p && p.valid && p.fxBidText) {
        fxEl.textContent = p.fxBidText;
        fxEl.title = "Enter this in eBay’s offer field (priced in " + fx.code + ")";
      } else {
        fxEl.textContent = "1 " + fx.code + " ≈ US $" + fx.rate.toFixed(2);
        fxEl.title = "Live exchange rate from this listing";
      }
      fxEl.removeAttribute("hidden");
    }

    // Forward: bid → total. Reads the bid field, fills the total field.
    function fromBid() {
      const p = bidCalcParts(bidInput.value, shipping, config.taxRate, fx);
      const typed = bidInput.value.trim() !== "";
      // "=" mode surfaces the evaluated bid between the input and the arrow.
      paintMid(p);
      paintFx(p);
      totalInput.value = p.valid ? p.total.toFixed(2) : "";
      totalCalcEl.setAttribute("hidden", ""); // forward fills a number, never a formula
      bidInput.setAttribute("placeholder", BID_PLACEHOLDER); // clear any below-shipping warning
      bidInput.classList.remove(WARN);
      totalInput.classList.remove(WARN);

      paintExtras(p.valid, p.total, p.totalNoShip, p.sub);
      bidInput.classList.toggle(INVALID, typed && !p.valid);
      totalInput.classList.remove(INVALID);
      syncDollar();
    }

    // Reverse: target total → bid. Reads the total field, fills the bid field.
    function fromTotal() {
      const p = bidFromTotalParts(totalInput.value, shipping, config.taxRate, fx);
      const typed = totalInput.value.trim() !== "";
      calcEl.setAttribute("hidden", ""); // the mid "= $x" hint belongs to the bid side only
      // The FX line still updates: it shows the back-solved bid translated to the
      // seller's currency — the eBay offer amount to enter.
      paintFx(p);
      // Formula → number translation AFTER the total box: "=2*12" ⇒ "= $24.00".
      if (p.isFunction && p.valid) {
        totalCalcEl.textContent = "= " + p.calcText;
        totalCalcEl.removeAttribute("hidden");
      } else totalCalcEl.setAttribute("hidden", "");
      bidInput.value = p.valid ? p.bid.toFixed(2) : "";
      // When the target can't even cover shipping the bid field is blank, so its
      // placeholder is what's visible — swap in a warning instead of the "bid or
      // =2*4" hint. Any other state restores the default hint.
      bidInput.setAttribute(
        "placeholder",
        p.belowShipping ? "⚠️ target ≤ shipping" : BID_PLACEHOLDER,
      );
      bidInput.classList.toggle(WARN, !!p.belowShipping);
      totalInput.classList.toggle(WARN, !!p.belowShipping);
      paintExtras(p.valid, p.total, p.totalNoShip, p.sub);
      totalInput.classList.toggle(INVALID, typed && !p.valid);
      bidInput.classList.remove(INVALID);
      syncDollar();
    }

    // Recompute from whichever side the user last edited — used by the live
    // refreshes below (per-unit count change, settings-driven basis flip).
    let lastEdited = "bid";
    function recompute() {
      if (lastEdited === "total") fromTotal();
      else fromBid();
    }

    bidInput.addEventListener("input", function () {
      lastEdited = "bid";
      fromBid();
    });
    totalInput.addEventListener("input", function () {
      lastEdited = "total";
      fromTotal();
    });
    // Defensive: keep clicks/keys from bubbling to any surrounding anchor.
    [bidInput, totalInput].forEach(function (el) {
      el.addEventListener("click", (e) => e.stopPropagation());
      el.addEventListener("keydown", (e) => e.stopPropagation());
    });
    // Reset: clear BOTH fields and repaint the empty state, then focus the bid field.
    box.querySelector(".ebay-bid-calc__reset").addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      bidInput.value = "";
      totalInput.value = "";
      lastEdited = "bid";
      fromBid();
      bidInput.focus();
    });
    // Re-render whenever the shared per-unit count / active state changes. Tie the
    // subscription to `box`: a settings-driven rebuild detaches this element, and
    // perUnit prunes the entry on its next notify so subscriptions don't pile up.
    perUnit.subscribe(box, recompute);
    // Also re-render on a live-only settings change (per-unit basis flip).
    registerLive(box, recompute);
    recompute();
    return box;
  }

  Object.assign(ES, { makeBidCalc });
})();
