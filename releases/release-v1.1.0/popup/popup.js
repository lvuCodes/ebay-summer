// Popup controller. The registry + helper modules and each feature's schema.js
// load first in popup.html and attach their API to globalThis.ES, which this file
// reads (sanitizers, playSound, DEFAULTS). The popup edits the stored
// settings; content.js listens on chrome.storage.onChanged and re-renders, so
// saving here updates open eBay tabs live — the popup does no messaging of its own.
//
// v1.0.0 release build: only the Estimated Total Calculator and Auction Ending
// Notification features ship, so this controller wires only their controls.
//
// Numeric FIELDS store decimals for the rates (taxRate 0.0825, shipPct 0.5) and
// a dollar amount for the floor (shipFloor 10); rate fields display as percents.
// Boolean CHECKS store true/false page-layout toggles.

(function () {
  "use strict";

  // The core modules (loaded first in popup.html) expose these on globalThis.ES.
  // DEFAULTS is the shared default map (defaults.js) — the single source of truth
  // every control's `def` is read from below, so nothing here restates a value.
  const { sanitizeNonNeg, sanitizeBool, sanitizeSound, playSound, DEFAULTS } = globalThis.ES;

  const FIELDS = [
    { id: "tax", key: "taxRate", pct: true },
    { id: "ship-floor", key: "shipFloor", pct: false },
    { id: "ship-pct", key: "shipPct", pct: true },
    { id: "notify-1", key: "notifyAt1", pct: false },
    { id: "notify-2", key: "notifyAt2", pct: false },
  ];

  const CHECKS = [
    { id: "enabled", key: "enabled" },
    // Section-header masters (each toggles a whole feature on/off).
    { id: "sec-esttotal", key: "estTotal" },
    { id: "flag-shipping", key: "flagShipping" },
    { id: "sec-auction", key: "notifyEnabled" },
    // "Show Est. Total On…" per-page toggles.
    { id: "page-listing", key: "pageListing" },
    { id: "page-search", key: "pageSearch" },
    { id: "page-watchlist", key: "pageWatchlist" },
    { id: "page-bids", key: "pageBidsOffers" },
    { id: "page-home", key: "pageHome" },
    { id: "page-summary", key: "pageSummary" },
    { id: "page-rvi", key: "pageRecentView" },
    { id: "page-saved", key: "pageSaved" },
    // Auction Ending Notification sub-toggles.
    { id: "notify-sound-enabled", key: "notifySoundEnabled" },
    { id: "notify-1-enabled", key: "notifyEnabled1" },
    { id: "notify-2-enabled", key: "notifyEnabled2" },
    { id: "notify-ended-persist", key: "notifyEndedPersist" },
  ];

  // <select> settings. The sound key validates against SOUNDS.
  const SELECTS = [{ id: "notify-sound", key: "notifySound", san: (v) => sanitizeSound(v) }];

  // Stamp each control's default from the shared map, keyed by its storage key —
  // the values live in defaults.js, not here.
  [...FIELDS, ...CHECKS, ...SELECTS].forEach((e) => (e.def = DEFAULTS[e.key]));

  // "Reset defaults" writes the full shared map (a copy so no caller mutates it),
  // covering every persisted key — including ones without a popup control.
  const defaults = { ...DEFAULTS };

  // Stored value -> number shown in a numeric field (percent for rate fields).
  function toField(f, stored) {
    const v = sanitizeNonNeg(stored, f.def);
    return +(f.pct ? v * 100 : v).toFixed(4);
  }

  // Numeric field text -> value to store (decimal for rate fields), sanitized.
  function fromField(f) {
    const raw = Number(document.getElementById(f.id).value);
    const val = f.pct ? raw / 100 : raw;
    return sanitizeNonNeg(Number.isFinite(raw) ? val : NaN, f.def);
  }

  // Fill every control from storage (also snaps numeric fields back to canonical
  // values on blur/enter).
  function load() {
    chrome.storage.sync.get(defaults, function (stored) {
      FIELDS.forEach((f) => {
        document.getElementById(f.id).value = toField(f, stored[f.key]);
      });
      CHECKS.forEach((c) => {
        document.getElementById(c.id).checked = sanitizeBool(stored[c.key], c.def);
      });
      SELECTS.forEach((s) => {
        document.getElementById(s.id).value = s.san(stored[s.key], s.def);
      });
      updateSections();
      syncAllPages();
    });
  }

  // Each section-header toggle reveals/hides its section's body when off; the
  // Estimated Total Calculator toggle also hides the whole "Show Est. Total On…"
  // section (its per-page toggles are moot when the feature is off).
  const SECTION_TOGGLES = [
    { control: "sec-esttotal", sections: ["body-esttotal", "header-showtotal", "body-showtotal"] },
    // The shipping-flag sub-toggle collapses its threshold rows when off.
    { control: "flag-shipping", sections: ["body-shipflag"] },
    { control: "sec-auction", sections: ["body-auction"] },
  ];
  function updateSections() {
    SECTION_TOGGLES.forEach((s) => {
      const on = document.getElementById(s.control).checked;
      s.sections.forEach((id) => (document.getElementById(id).hidden = !on));
    });
  }

  // Persist all controls. Live, so eBay tabs update as you edit.
  function save() {
    const out = {};
    FIELDS.forEach((f) => (out[f.key] = fromField(f)));
    CHECKS.forEach((c) => (out[c.key] = document.getElementById(c.id).checked));
    SELECTS.forEach((s) => (out[s.key] = document.getElementById(s.id).value));
    chrome.storage.sync.set(out);
  }

  FIELDS.forEach((f) => {
    const el = document.getElementById(f.id);
    el.addEventListener("input", save);
    el.addEventListener("change", load);
  });
  CHECKS.forEach((c) => {
    document.getElementById(c.id).addEventListener("change", save);
  });
  SECTION_TOGGLES.forEach((s) => {
    document.getElementById(s.control).addEventListener("change", updateSections);
  });
  SELECTS.forEach((s) => {
    document.getElementById(s.id).addEventListener("change", save);
  });

  // --- "Show Est. Total On…" master select-all ------------------------------
  // The header toggle is a pure select-all/none over the eight page checks (not a
  // stored setting): checking it turns them all on, unchecking turns them all off,
  // and it reflects their state (indeterminate when only some are on).
  const pageBoxes = () =>
    CHECKS.filter((c) => c.key.startsWith("page")).map((c) => document.getElementById(c.id));
  function syncAllPages() {
    const boxes = pageBoxes();
    const on = boxes.filter((b) => b.checked).length;
    const all = document.getElementById("page-all");
    all.checked = on === boxes.length;
    all.indeterminate = on > 0 && on < boxes.length;
  }
  document.getElementById("page-all").addEventListener("change", function () {
    const checked = this.checked;
    pageBoxes().forEach((b) => (b.checked = checked));
    this.indeterminate = false;
    save();
  });
  pageBoxes().forEach((b) => b.addEventListener("change", syncAllPages));

  // --- Reset all settings to defaults (two-click confirm) -------------------
  // First click arms + warns; a second click writes the full defaults object and
  // repaints. Any blur (clicking elsewhere) disarms it, so a stray click is safe.
  const resetBtn = document.getElementById("reset-defaults");
  let resetArmed = false;
  function disarmReset() {
    resetArmed = false;
    resetBtn.textContent = "Reset defaults";
    resetBtn.classList.remove("armed");
  }
  resetBtn.addEventListener("click", function () {
    if (!resetArmed) {
      resetArmed = true;
      resetBtn.textContent = "Reset — sure?";
      resetBtn.classList.add("armed");
      return;
    }
    chrome.storage.sync.set(defaults, function () {
      disarmReset();
      load();
    });
  });
  resetBtn.addEventListener("blur", disarmReset);

  // Preview the selected alert sound on demand. The popup owns its own
  // AudioContext (a click is a user gesture, so it can play immediately).
  let previewCtx = null;
  document.getElementById("notify-preview").addEventListener("click", function () {
    try {
      if (!previewCtx) previewCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (previewCtx.state === "suspended") previewCtx.resume();
      playSound(previewCtx, document.getElementById("notify-sound").value);
    } catch (e) {}
  });

  // Reload every open eBay tab. tabs.reload needs no permission, and the URL
  // filter works with the eBay host access the content-script match already
  // grants — so no extra manifest permission is required.
  const reloadBtn = document.getElementById("reload-ebay");
  reloadBtn.addEventListener("click", function () {
    chrome.tabs.query({ url: "*://*.ebay.com/*" }, function (tabs) {
      tabs.forEach((t) => chrome.tabs.reload(t.id));
      const n = tabs.length;
      // Report the result IN the button and disable it — reopening the popup
      // resets the label/enabled state (the HTML is re-read on each open).
      reloadBtn.textContent = n
        ? `Reloaded ${n} eBay tab${n === 1 ? "" : "s"}`
        : "No eBay tabs open";
      reloadBtn.disabled = true;
    });
  });

  // Show the open-eBay-tab count in the button label on open, so the user knows
  // how many tabs the click will reload before pressing it.
  function updateReloadCount() {
    chrome.tabs.query({ url: "*://*.ebay.com/*" }, function (tabs) {
      const n = tabs.length;
      reloadBtn.textContent = n
        ? `↻ Reload ${n} eBay tab${n === 1 ? "" : "s"}`
        : "↻ No eBay tabs open";
      reloadBtn.disabled = false;
    });
  }
  updateReloadCount();

  load();
})();
