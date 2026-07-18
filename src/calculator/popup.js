// Estimated Total Calculator — popup component. Registers two sections because
// the feature presents as two groups: the rates themselves, and the per-page
// switches deciding where boxes are injected. Both are calculator settings (the
// page* keys live in this feature's schema.js), so both belong to this file.
(function () {
  "use strict";
  const ES = (globalThis.ES = globalThis.ES || {});
  const { h, switchEl, infoEl } = ES;

  // Every page the boxes can be injected on, in popup display order. The page*
  // keys and their defaults come from this feature's schema.
  const PAGES = [
    ["page-home", "pageHome", "Home page", "Amber boxes: the home feed has no shipping data, so totals are item + tax only."],
    ["page-search", "pageSearch", "Search results"],
    ["page-listing", "pageListing", "Listing pages"],
    ["page-watchlist", "pageWatchlist", "Watchlist"],
    ["page-bids", "pageBidsOffers", "Bids & Offers"],
    ["page-summary", "pageSummary", "Summary"],
    // Recently viewed is hidden for v1.1.1: renderRvi's .container-item selectors
    // no longer match and no boxes are drawn, so offering the toggle would only
    // promise something that does not happen. The renderer, its route entry, and
    // the pageRecentView setting all stay in place — restoring the toggle is
    // uncommenting this line once a Recently Viewed capture pins the new markup.
    // ["page-rvi", "pageRecentView", "Recently viewed"],
    ["page-saved", "pageSaved", "Saved feed"],
  ];

  // One labelled threshold in the shipping-flag grid: heading (+ optional tip and
  // a leading unit) over its input.
  function shipRow(id, label, tip, preUnit, postUnit) {
    return [
      h(
        "div",
        { class: "ship-grid__head" },
        h("label", { for: id, text: label }),
        infoEl(tip),
        preUnit ? h("span", { class: "unit unit--pre", text: preUnit }) : null
      ),
      h(
        "div",
        { class: "ship-grid__val" },
        h("input", { type: "number", id, min: 0, step: 1, inputmode: "decimal" }),
        postUnit ? h("span", { class: "unit", text: postUnit }) : null
      ),
    ];
  }

  function renderRates(body) {
    body.appendChild(h("p", { class: "hint hint--gap", text: "Tabs recalculate live." }));

    body.appendChild(
      h(
        "div",
        { class: "row" },
        h("label", { for: "tax", class: "row-heading", text: "Sales tax" }),
        h("input", { type: "number", id: "tax", min: 0, step: 0.01, inputmode: "decimal" }),
        h("span", { class: "unit", text: "%" })
      )
    );

    body.appendChild(
      h("p", { class: "hint hint--gap", text: "Tax applies to the item price only." })
    );

    body.appendChild(
      h(
        "div",
        { class: "section-row" },
        h("p", { class: "section", text: "Flag shipping when it exceeds…" }),
        switchEl("flag-shipping", null, "inline")
      )
    );

    const shipBody = h(
      "div",
      { class: "group-body", id: "body-shipflag" },
      h(
        "div",
        { class: "ship-grid" },
        shipRow("ship-floor", "Flat amount", "Warns when shipping exceeds this flat dollar amount.", "$"),
        shipRow(
          "ship-pct",
          "% of item",
          "Warns when shipping is above this share of the item's total price to catch cheap items with inflated shipping. Example: at 50%, a $10 item with shipping fees of $5 or more is flagged.",
          null,
          "%"
        )
      ),
      h("p", {
        class: "hint hint--center",
        text: "🟢 free · 🟡 high · 🔴 really high · 📍🏃 pickup only",
      })
    );
    body.appendChild(shipBody);
  }

  function renderPages(body) {
    PAGES.forEach(([id, , label, tip]) => {
      const sw = switchEl(id, label);
      body.appendChild(tip ? h("div", { class: "switch-row" }, sw, infoEl(tip)) : sw);
    });
  }

  ES.registerPopupSection({
    id: "esttotal",
    title: "Estimated Total Calculator",
    master: "sec-esttotal",
    column: 1,
    render: renderRates,
    controls: {
      fields: [
        { id: "tax", key: "taxRate", pct: true },
        { id: "ship-floor", key: "shipFloor", pct: false },
        { id: "ship-pct", key: "shipPct", pct: true },
      ],
      checks: [
        { id: "sec-esttotal", key: "estTotal" },
        { id: "flag-shipping", key: "flagShipping" },
      ],
    },
    toggles: [
      // The master also hides the page-toggle section: where to inject boxes is
      // moot when the feature is off.
      { control: "sec-esttotal", sections: ["body-esttotal", "header-showtotal", "body-showtotal"] },
      { control: "flag-shipping", sections: ["body-shipflag"] },
    ],
  });

  ES.registerPopupSection({
    id: "showtotal",
    title: "Show Est. Total On…",
    // page-all is a select-all over the eight page switches, not a stored
    // setting — hence no entry in `checks`.
    master: "page-all",
    masterTitle: "Toggle every page at once",
    column: 1,
    render: renderPages,
    controls: {
      checks: PAGES.map(([id, key]) => ({ id, key })),
    },
    init(ctx) {
      const boxes = () => PAGES.map(([id]) => document.getElementById(id));
      const all = document.getElementById("page-all");

      // Reflect the eight switches: on when all are on, indeterminate when some.
      function sync() {
        const on = boxes().filter((b) => b.checked).length;
        all.checked = on === boxes().length;
        all.indeterminate = on > 0 && on < boxes().length;
      }

      all.addEventListener("change", function () {
        boxes().forEach((b) => (b.checked = all.checked));
        all.indeterminate = false;
        ctx.save();
      });
      boxes().forEach((b) => b.addEventListener("change", sync));
      ctx.onLoaded(sync);
    },
  });
})();
