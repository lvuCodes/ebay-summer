// eBay Σummer. Copyright (C) 2026 lvuCodes. Licensed under GPL-3.0-or-later; see LICENSE.md.
//
// Auction Ending Notification — popup component. Owns its markup, its controls,
// and its one piece of bespoke wiring (the sound preview button), so the popup
// shell never names this feature and a build without notifications/ simply has
// no such section.
(function () {
  "use strict";
  const ES = (globalThis.ES = globalThis.ES || {});
  const { h, switchEl, sanitizeSound, SOUNDS, playSound } = ES;

  // The preview AudioContext is created on first use and reused: constructing one
  // before a user gesture leaves it suspended under the autoplay policy.
  let previewCtx = null;

  function render(body) {
    body.appendChild(
      h("p", {
        class: "hint hint--gap",
        text: "Badge notifications appear at the given intervals and may be clicked for instant navigation. They auto-dismiss when the auction ends.",
      })
    );

    const grid = h("div", { class: "auction-grid" });

    grid.appendChild(switchEl("notify-sound-enabled", null, "inline"));
    grid.appendChild(h("label", { for: "notify-sound", text: "Sound" }));
    grid.appendChild(
      h(
        "select",
        { id: "notify-sound" },
        Object.keys(SOUNDS).map((key) =>
          h("option", { value: key, text: key[0].toUpperCase() + key.slice(1) })
        )
      )
    );
    grid.appendChild(
      h("button", { type: "button", id: "notify-preview", class: "btn-mini", title: "Play sound", text: "▶" })
    );

    // The two "seconds left" thresholds, each independently toggled.
    [
      ["notify-1", "First alert"],
      ["notify-2", "Second alert"],
    ].forEach(([id, label]) => {
      grid.appendChild(switchEl(`${id}-enabled`, null, "inline"));
      grid.appendChild(h("label", { for: id, text: label }));
      grid.appendChild(h("input", { type: "number", id, min: 0, step: 1, inputmode: "numeric" }));
      grid.appendChild(h("span", { class: "unit", text: "seconds" }));
    });

    grid.appendChild(switchEl("notify-ended-persist", null, "inline"));
    grid.appendChild(
      h("label", {
        for: "notify-ended-persist",
        class: "auction-grid__wide",
        text: "Persistent auction ended notification",
      })
    );

    body.appendChild(grid);
  }

  ES.registerPopupSection({
    id: "auction",
    title: "Auction Ending Notification",
    master: "sec-auction",
    column: 2,
    render,
    controls: {
      fields: [
        { id: "notify-1", key: "notifyAt1", pct: false },
        { id: "notify-2", key: "notifyAt2", pct: false },
      ],
      checks: [
        { id: "sec-auction", key: "notifyEnabled" },
        { id: "notify-sound-enabled", key: "notifySoundEnabled" },
        { id: "notify-1-enabled", key: "notifyEnabled1" },
        { id: "notify-2-enabled", key: "notifyEnabled2" },
        { id: "notify-ended-persist", key: "notifyEndedPersist" },
      ],
      selects: [{ id: "notify-sound", key: "notifySound", san: (v) => sanitizeSound(v) }],
    },
    toggles: [{ control: "sec-auction", sections: ["body-auction"] }],
    init() {
      document.getElementById("notify-preview").addEventListener("click", function () {
        try {
          if (!previewCtx) previewCtx = new (window.AudioContext || window.webkitAudioContext)();
          if (previewCtx.state === "suspended") previewCtx.resume();
          playSound(previewCtx, document.getElementById("notify-sound").value);
        } catch (e) {}
      });
    },
  });
})();
