// Pure calculation + parsing core of the Estimated Total Calculator. No DOM,
// no config — every function takes its inputs as arguments, so the whole
// module is trivially testable. All the money parsing, the landed-total math,
// the per-unit math, and the "=expr" evaluator live here. Self-contained:
// nothing here reads from ES. (The countdown parser + alert state machine live
// in notifications/alerts.js.)
(function () {
  "use strict";
  const ES = (globalThis.ES = globalThis.ES || {});

  // Format a number as a 2-decimal money string WITH thousands separators
  // ("1234.5" -> "1,234.50"). The one place display money gets stringified, so
  // every "$…" the extension renders groups consistently. Display-only — the
  // editable input fields (box.js) keep plain toFixed(2) so their values re-parse
  // cleanly, and percentages stay on toFixed (a rate is not money). Non-finite
  // input falls back to a plain "0.00".
  function fmtMoney(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "0.00";
    return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Parse a dollar amount from cell text. "Free"/"Free delivery" -> 0, none -> null.
  function parseMoney(text) {
    if (!text) return null;
    if (/free/i.test(text)) return 0;
    const m = text.replace(/,/g, "").match(/\$\s*(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : null;
  }

  // Parse a shipping amount, preferring an explicit dollar figure over a "free"
  // mention — the shipping-specific inverse of parseMoney's free-first rule.
  // Sellers put "Free Shipping" in the item TITLE and eBay shows "Free returns"
  // beside a paid delivery line, so a present "$16.45" must win over a stray
  // "free". Returns 0 only when there is a free mention and NO amount; null when
  // there is neither.
  function shippingFromText(text) {
    if (!text) return null;
    const m = text.replace(/,/g, "").match(/\$\s*(\d+(?:\.\d+)?)/);
    if (m) return parseFloat(m[1]);
    if (/free/i.test(text)) return 0;
    return null;
  }

  // Resolve a card's shipping from its candidate shipping/delivery leaves, each
  // { text, parentText }. A leaf with no amount falls back to its parent's text
  // (eBay splits "+$16.45" and "delivery in 2-4 days" into sibling spans, so the
  // "delivery" leaf itself has no $). A real positive amount on ANY candidate
  // beats a "free" match on another: the title leaf "…Sealed Free Shipping" no
  // longer masks the true paid delivery line below it. Returns 0 (free) only when
  // every candidate is free, null when no shipping/delivery leaf exists at all.
  function resolveShipping(candidates) {
    let free = null;
    for (const c of candidates) {
      let amt = shippingFromText(c.text);
      if (amt == null) amt = shippingFromText(c.parentText);
      if (amt == null) continue;
      if (amt > 0) return amt;
      free = 0;
    }
    return free;
  }

  // Parse a US dollar amount specifically. International listings show a local
  // price with a US equivalent — e.g. the item's "Approximately US $56.24" line and
  // shipping's "AU $24.65 (approx US $16.99)". parseMoney would grab the first "$"
  // (the local currency); this pulls the explicit "US $…" amount, or null if the
  // text has none (a domestic listing, where the caller falls back to parseMoney).
  function parseMoneyUS(text) {
    if (!text) return null;
    const m = text.replace(/,/g, "").match(/\bUS\s*\$\s*(\d+(?:\.\d+)?)/i);
    return m ? parseFloat(m[1]) : null;
  }

  // Parse a price cell that may be a range ("$46.79 - $92.49"). Returns
  // { low, high }, with high null when there's no distinct higher value. Item
  // prices are never "free", so this is price-only; shipping still uses parseMoney.
  function parseMoneyRange(text) {
    if (!text) return { low: null, high: null };
    const nums = [...text.replace(/,/g, "").matchAll(/\$\s*(\d+(?:\.\d+)?)/g)].map((m) =>
      parseFloat(m[1])
    );
    if (nums.length === 0) return { low: null, high: null };
    const low = nums[0];
    const high = nums[nums.length - 1];
    return { low, high: high > low ? high : null };
  }

  // First bare numeric amount in a string (currency-agnostic), commas stripped.
  // Used to read the seller-currency "primary" figure from a modal offer row like
  // "GBP 6.00 (14.29% off)" -> 6.00, so a US approx can be scaled onto the shipping
  // line. null when the text has no number.
  function firstAmount(text) {
    if (!text) return null;
    const m = text.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : null;
  }

  // Resolve the USD item price + USD shipping from a Best-Offer modal's "Seller
  // offer" and "Shipping" row texts, for feeding makeBox/makeBidCalc. The offer row
  // carries a US approx ("GBP 6.00 (14.29% off) (Approx. $8.02)" or, domestically,
  // "US $8.02"), so parseMoney lifts the "$" amount as the item price. The shipping
  // row gives only the seller-currency amount on international listings ("GBP
  // 23.21", no "$"), so scale it onto USD with the offer's OWN US/primary ratio
  // (8.02/6.00) — keeping our figures self-consistent with what eBay shows in the
  // same modal. Domestic rows carry "$"/"Free" directly (ratio unneeded). Returns
  // { itemUSD, shipUSD } — shipUSD null only when no amount and no ratio is
  // derivable (caller then falls back to the listing's own shipping); null when the
  // offer has no parseable price at all. Pure — unit-tested without a DOM.
  function modalOfferUSD(offerText, shipText) {
    const itemUSD = parseMoney(offerText);
    if (itemUSD == null) return null;
    let shipUSD = null;
    if (shipText && /free/i.test(shipText)) shipUSD = 0;
    else if (shipText && /\$/.test(shipText)) shipUSD = parseMoney(shipText); // direct USD
    else {
      // Seller-currency shipping: convert via the offer's US/primary ratio.
      const offerPrimary = firstAmount(offerText);
      const shipPrimary = firstAmount(shipText);
      if (offerPrimary && shipPrimary != null) {
        shipUSD = Math.round(shipPrimary * (itemUSD / offerPrimary) * 100) / 100;
      }
    }
    return { itemUSD, shipUSD };
  }

  // Resolve the current bid + shipping from the place-bid modal's summary text
  // ("$10.50 current bid + $8 shipping · 3 bids · 1d 6h left"). Split on the "current
  // bid" label FIRST: the bid is the "$…" BEFORE it, shipping the amount AFTER it.
  // The split matters both ways — reading the bid from only the pre-label slice keeps
  // "Free shipping" from tripping parseMoney's free-first rule (which would zero the
  // bid), and reading shipping from only the post-label slice keeps the bid's "$"
  // from being mistaken for the shipping ("+ $8 shipping" -> 8, "+ Free shipping" ->
  // 0). Returns { bid, shipping }, either null when absent: an oddly-labelled summary
  // (no "current bid") still yields the bid from the whole string, with shipping null
  // so the caller falls back to the listing's own shipping. Pure — DOM-free tested.
  function bidModalFigures(text) {
    if (!text) return { bid: null, shipping: null };
    const parts = text.split(/current bid/i);
    const bid = parseMoney(parts[0]);
    const shipping = parts.length > 1 ? shippingFromText(parts[1]) : null;
    return { bid, shipping };
  }

  // Total = itemCost + tax(on item only) + shipping. null/0 shipping -> +0.
  function calcTotal(itemCost, shipping, taxRate) {
    const tax = itemCost * taxRate;
    return { tax, total: itemCost + tax + (shipping || 0) };
  }

  // Shipping label. Unified on the search-script's semantics (the most correct):
  // >0 paid, 0 free, null unknown (excluded from the total, shown as "n/a").
  function shipLabel(shipping, unknownText) {
    return shipping > 0
      ? "+ $" + fmtMoney(shipping) + " ship"
      : shipping === 0
      ? "+ free ship"
      : "+ ship " + (unknownText || "n/a");
  }

  // The tax rate as a display percent — "8.25%" — the one place a rate becomes
  // its "X%" label, so the box and bid-calc sub-lines format it identically.
  function pctText(taxRate) {
    return `${(taxRate * 100).toFixed(2)}%`;
  }

  // Pure text parts of the box, so label selection is testable without a DOM.
  // When itemHigh is a distinct higher price, the amount and the tax render as
  // ranges (low end -> high end); `range` tells makeBox to add the 🚦 prefix.
  function boxParts(itemCost, shipping, taxRate, itemHigh, shipUnknownText) {
    const lo = calcTotal(itemCost, shipping, taxRate);
    const hasRange = itemHigh != null && itemHigh > itemCost;
    const hi = hasRange ? calcTotal(itemHigh, shipping, taxRate) : null;
    const amount = hasRange
      ? `US $${fmtMoney(lo.total)} - $${fmtMoney(hi.total)}`
      : `US $${fmtMoney(lo.total)}`;
    const taxTxt = hasRange
      ? `$${fmtMoney(lo.tax)} - $${fmtMoney(hi.tax)}`
      : `$${fmtMoney(lo.tax)}`;
    const baseTxt = hasRange
      ? `US $${fmtMoney(itemCost)} - $${fmtMoney(itemHigh)}`
      : `US $${fmtMoney(itemCost)}`;
    return {
      label: "Est. total",
      amount,
      sub: `incl. ${pctText(taxRate)} tax (${taxTxt}) ${shipLabel(shipping, shipUnknownText)}`,
      // The main listing box's sub line: the base price broken out so the addends
      // visibly sum to the est. total — "US $base + (X% tax → $tax) + $ship ship".
      // The tax group shows its rate resolving to its dollar amount; ship stays labelled.
      breakdown: `${baseTxt} + (${pctText(taxRate)} tax → ${taxTxt}) ${shipLabel(shipping, shipUnknownText)}`,
      range: hasRange,
      // Numeric totals for the per-unit breakdown; high is null when not a range.
      // The *NoShip variants are item + tax only (shipping excluded), used when the
      // "include shipping in price per item" setting is off.
      totalLow: lo.total,
      totalHigh: hi ? hi.total : null,
      totalNoShipLow: itemCost + lo.tax,
      totalNoShipHigh: hi ? itemHigh + hi.tax : null,
    };
  }

  // Clamp the item-count stepper to a whole number >= 1 (the field starts at 1).
  function clampCount(n) {
    const c = Math.floor(Number(n));
    return Number.isFinite(c) && c >= 1 ? c : 1;
  }

  // Parse the item-count field, which (like the bid calculator) accepts a plain
  // number or an "=expr" formula (e.g. "=12*18"). Returns a clamped whole count
  // (>= 1); malformed/empty input falls back to 1. Pure.
  function parseCount(raw) {
    const { value } = bidCalcInput(raw);
    return clampCount(value);
  }

  // The per-unit line: "<count> @ $X.XX/unit" — the item count and the estimated
  // total divided by it. Mirrors the box amount — a single value normally, a
  // low–high range when the listing price is a range. Pure so it's testable.
  function perUnitText(totalLow, totalHigh, count) {
    const c = clampCount(count);
    const lo = totalLow / c;
    const per =
      totalHigh != null
        ? `$${fmtMoney(lo)} - $${fmtMoney(totalHigh / c)}/unit`
        : `$${fmtMoney(lo)}/unit`;
    return `${c} @ ${per}`;
  }

  // Safely evaluate a simple arithmetic expression ("2*40+15", "(3+4)/2") without
  // eval(): a recursive-descent parser over + - * / and parentheses, with unary
  // sign and decimals. Returns the number, or null for anything malformed (stray
  // characters, unbalanced parens, trailing garbage, or a divide-by-zero). This is
  // the engine behind the bid calculator's "=expr" mode.
  function evalExpr(expr) {
    if (expr == null) return null;
    const s = String(expr);
    if (!/^[\d\s.+\-*/()]*$/.test(s)) return null; // only math characters allowed
    if (!/\d/.test(s)) return null; // must contain at least one number
    let i = 0;
    const skip = () => {
      while (i < s.length && s[i] === " ") i++;
    };
    function parseExpr() {
      let v = parseTerm();
      if (v == null) return null;
      for (;;) {
        skip();
        const c = s[i];
        if (c === "+" || c === "-") {
          i++;
          const r = parseTerm();
          if (r == null) return null;
          v = c === "+" ? v + r : v - r;
        } else break;
      }
      return v;
    }
    function parseTerm() {
      let v = parseFactor();
      if (v == null) return null;
      for (;;) {
        skip();
        const c = s[i];
        if (c === "*" || c === "/") {
          i++;
          const r = parseFactor();
          if (r == null) return null;
          if (c === "/") {
            if (r === 0) return null; // divide by zero -> invalid
            v = v / r;
          } else v = v * r;
        } else break;
      }
      return v;
    }
    function parseFactor() {
      skip();
      let sign = 1;
      while (s[i] === "+" || s[i] === "-") {
        if (s[i] === "-") sign = -sign;
        i++;
        skip();
      }
      if (s[i] === "(") {
        i++;
        const v = parseExpr();
        skip();
        if (v == null || s[i] !== ")") return null;
        i++;
        return sign * v;
      }
      const start = i;
      while (i < s.length && /[\d.]/.test(s[i])) i++;
      if (i === start) return null;
      const num = parseFloat(s.slice(start, i));
      return Number.isFinite(num) ? sign * num : null;
    }
    const result = parseExpr();
    skip();
    if (i !== s.length) return null; // trailing garbage after a valid expression
    return result != null && Number.isFinite(result) ? result : null;
  }

  // Interpret the bid calculator's input field. A leading "=" means the rest is an
  // arithmetic expression (evaluated via evalExpr); otherwise it's a plain dollar
  // amount ("$" and thousands commas tolerated). Returns { isFunction, value },
  // with value === null when the field is empty or unparseable.
  function bidCalcInput(raw) {
    const s = String(raw == null ? "" : raw).trim();
    if (s === "") return { isFunction: false, value: null };
    if (s[0] === "=") return { isFunction: true, value: evalExpr(s.slice(1)) };
    const cleaned = s.replace(/[$,\s]/g, "");
    if (!/^\d*\.?\d+$/.test(cleaned)) return { isFunction: false, value: null };
    const n = parseFloat(cleaned);
    return { isFunction: false, value: Number.isFinite(n) ? n : null };
  }

  // The bid calculator's computed parts. `value` is the entered/derived bid; the
  // estimated total is value + tax(on value) + shipping. `totalNoShip` (value +
  // tax) supports the per-unit toggle. valid === false when the field is empty or
  // the input can't be parsed. Pure, so it's fully testable without a DOM.
  // `fx` (optional) = { code, rate } for a foreign-currency listing, where rate is
  // USD per 1 unit of the seller's currency (e.g. GBP -> 1.3386). When present,
  // fxBidText translates the USD bid back to the seller's currency — the number to
  // type into eBay's own counter field ("Your offer", quoted in that currency).
  function bidCalcParts(raw, shipping, taxRate, fx) {
    const { isFunction, value } = bidCalcInput(raw);
    const pct = pctText(taxRate);
    if (value == null || !Number.isFinite(value) || value < 0) {
      // No amount yet — show the rate + shipping, matching the estimation box's phrasing
      // but without a tax figure.
      return { isFunction, valid: false, value: null, sub: `incl. ${pct} tax ${shipLabel(shipping)}` };
    }
    const { tax, total } = calcTotal(value, shipping, taxRate);
    return {
      isFunction,
      valid: true,
      value,
      calcText: `$${fmtMoney(value)}`, // shown between input and arrow in "=" mode
      fxBidText: fx && fx.rate > 0 ? `${fx.code} ${fmtMoney(value / fx.rate)}` : null,
      total,
      totalNoShip: value + tax,
      totalText: `US $${fmtMoney(total)}`,
      // Identical format to the estimation box's sub line.
      sub: `incl. ${pct} tax ($${fmtMoney(tax)}) ${shipLabel(shipping)}`,
    };
  }

  // Inverse of bidCalcParts: given a TARGET landed total (what you want to pay,
  // tax + shipping included), solve for the bid to place. Since
  // total = bid + bid*taxRate + shipping, the bid is (total - shipping)/(1 + tax).
  // Same input grammar (plain number or "=expr"). valid === false when the field
  // is empty/unparseable, or when the target can't even cover shipping (the bid
  // would be negative). Pure, so it's fully testable without a DOM.
  // `fx` (optional) as in bidCalcParts: translate the back-solved USD bid into the
  // seller's currency (fxBidText) — the amount to enter in eBay's own offer field.
  function bidFromTotalParts(raw, shipping, taxRate, fx) {
    const { isFunction, value } = bidCalcInput(raw);
    const pct = pctText(taxRate);
    const ship = shipping || 0;
    if (value == null || !Number.isFinite(value) || value < 0) {
      return { isFunction, valid: false, value: null, sub: `incl. ${pct} tax ${shipLabel(shipping)}` };
    }
    const bid = (value - ship) / (1 + taxRate);
    if (bid < 0) {
      // The target total doesn't even cover shipping — no non-negative bid works.
      return {
        isFunction,
        valid: false,
        value,
        belowShipping: true,
        sub: `target below $${fmtMoney(ship)} shipping`,
      };
    }
    const tax = bid * taxRate;
    return {
      isFunction,
      valid: true,
      value, // the target landed total the user entered
      bid,
      bidText: `US $${fmtMoney(bid)}`,
      fxBidText: fx && fx.rate > 0 ? `${fx.code} ${fmtMoney(bid / fx.rate)}` : null,
      calcText: `$${fmtMoney(value)}`, // resolved target (for "=" mode)
      total: value,
      totalNoShip: value - ship, // bid + tax — the per-unit basis without shipping
      tax,
      // Same format as the forward direction's sub line.
      sub: `incl. ${pct} tax ($${fmtMoney(tax)}) ${shipLabel(shipping)}`,
    };
  }

  // The bid calculator's "$X.XX/unit" line: the estimated cost divided by the
  // per-unit count. `includeShip` selects the basis (full total vs. item + tax),
  // mirroring the estimation box's per-unit setting. Pure.
  function bidPerUnitText(total, totalNoShip, includeShip, count) {
    const c = clampCount(count);
    const basis = includeShip ? total : totalNoShip;
    return `$${fmtMoney(basis / c)}/unit`;
  }

  // A colored status dot for the shipping cost, shown next to the total amount:
  //   📍🏃 pickup-only — the item ships nowhere; its only fulfilment is local pickup
  //   🟢 free shipping (shipping is $0)
  //   🔴 shipping is high on BOTH counts — over the flat floor AND the % of item
  //   🟡 shipping is high on ONE count — over the flat floor OR the % of item
  //   "" paid but within both thresholds, or shipping unknown (no dot)
  // `pickupOnly` wins first: a pickup-only card has no shipping figure (shipping is
  // null), so this slot is otherwise empty — the 📍🏃 fills it in place of a circle
  // (same glyph as the pickup-only title badge, so the two read as one feature).
  function shipFlag(itemCost, shipping, shipPct, shipFloor, pickupOnly) {
    if (pickupOnly) return "📍🏃";
    if (shipping === 0) return "🟢";
    if (shipping == null) return "";
    const overFloor = shipping > shipFloor;
    const overPct = itemCost > 0 && shipping > shipPct * itemCost;
    if (overFloor && overPct) return "🔴";
    return overFloor || overPct ? "🟡" : "";
  }

  Object.assign(ES, {
    fmtMoney,
    parseMoney,
    parseMoneyUS,
    parseMoneyRange,
    firstAmount,
    modalOfferUSD,
    bidModalFigures,
    shippingFromText,
    resolveShipping,
    calcTotal,
    shipLabel,
    pctText,
    boxParts,
    clampCount,
    parseCount,
    perUnitText,
    evalExpr,
    bidCalcInput,
    bidCalcParts,
    bidFromTotalParts,
    bidPerUnitText,
    shipFlag,
  });
})();
