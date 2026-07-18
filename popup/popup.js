// eBay Σummer. Copyright (C) 2026 lvuCodes. Licensed under GPL-3.0-or-later; see LICENSE.md.
//
// Popup shell. The registry + helper modules and each feature's schema.js and
// popup.js load first in popup.html and attach their API to globalThis.ES, which
// this file reads (sanitizers, DEFAULTS, the registered sections). The popup
// edits the stored settings; content.js listens on chrome.storage.onChanged and
// re-renders, so saving here updates open eBay tabs live — the popup does no
// messaging of its own.
//
// This file names no feature. It mounts whatever sections registered, walks the
// controls they contributed, and owns only the chrome that belongs to no feature:
// the master enable, the reload button, and reset-to-defaults. A build that omits
// a feature's <script> lines gets a popup without that section and nothing else
// changes — which is the property the v1.1.1 package violated.
//
// Numeric fields store decimals for the rates (taxRate 0.0825, shipPct 0.5) and
// a dollar amount for the floor (shipFloor 10); rate fields display as percents.
(function () {
  "use strict";

  const { sanitizeNonNeg, sanitizeBool, sectionEl, DEFAULTS } = globalThis.ES;

  // --- mount every registered section --------------------------------------
  // Registration order is <script> order, which fixes the order sections appear
  // within their column.
  globalThis.ES.popupSections.forEach((s) => {
    const col = document.getElementById(`col-${s.column}`);
    const { header, body } = sectionEl(s.id, s.title, s.master, s.masterTitle);
    col.appendChild(header);
    col.appendChild(body);
    s.render(body);
  });

  // --- the control tables, assembled from the mounted sections --------------
  const FIELDS = globalThis.ES.collectPopupControls("fields");
  const CHECKS = [{ id: "enabled", key: "enabled" }].concat(
    globalThis.ES.collectPopupControls("checks")
  );
  const SELECTS = globalThis.ES.collectPopupControls("selects");
  const TEXTS = globalThis.ES.collectPopupControls("texts");
  const RADIOS = globalThis.ES.collectPopupControls("radios");
  const COLLAPSES = globalThis.ES.collectPopupControls("collapses");
  const TOGGLES = globalThis.ES.collectPopupToggles();

  // Stamp each control's default from the shared map, keyed by its storage key —
  // the values live in defaults.js, not here.
  [...FIELDS, ...CHECKS, ...SELECTS, ...TEXTS, ...RADIOS, ...COLLAPSES].forEach(
    (e) => (e.def = DEFAULTS[e.key])
  );

  // "Reset defaults" writes the full shared map (a copy so no caller mutates it),
  // covering every persisted key — including ones without a popup control.
  const defaults = { ...DEFAULTS };

  // Hooks a section asked to run after each load(), for state derived from the
  // controls the generic loop fills.
  const onLoadedHooks = [];

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
      TEXTS.forEach((t) => {
        document.getElementById(t.id).value =
          typeof stored[t.key] === "string" ? stored[t.key] : t.def;
      });
      RADIOS.forEach((r) => {
        const val = r.values.includes(stored[r.key]) ? stored[r.key] : r.def;
        const el = document.querySelector(`input[name="${r.name}"][value="${val}"]`);
        if (el) el.checked = true;
      });
      updateSections();
      COLLAPSES.forEach((c) => applyCollapse(c, sanitizeBool(stored[c.key], c.def)));
      onLoadedHooks.forEach((fn) => fn());
    });
  }

  // Each toggle reveals/hides the section ids its feature declared.
  function updateSections() {
    TOGGLES.forEach((t) => {
      const on = document.getElementById(t.control).checked;
      t.sections.forEach((id) => (document.getElementById(id).hidden = !on));
    });
  }

  // Persist all controls. Live, so eBay tabs update as you edit.
  function save() {
    const out = {};
    FIELDS.forEach((f) => (out[f.key] = fromField(f)));
    CHECKS.forEach((c) => (out[c.key] = document.getElementById(c.id).checked));
    SELECTS.forEach((s) => (out[s.key] = document.getElementById(s.id).value));
    TEXTS.forEach((t) => (out[t.key] = document.getElementById(t.id).value));
    RADIOS.forEach((r) => {
      const sel = document.querySelector(`input[name="${r.name}"]:checked`);
      if (sel) out[r.key] = sel.value;
    });
    chrome.storage.sync.set(out);
  }

  function applyCollapse(c, collapsed) {
    document.getElementById(c.body).hidden = collapsed;
    const btn = document.getElementById(c.toggle);
    btn.setAttribute("aria-expanded", String(!collapsed));
    btn.querySelector(".subhead__caret").textContent = collapsed ? "▸" : "▾";
  }

  // --- generic wiring over the assembled tables -----------------------------
  FIELDS.forEach((f) => {
    const el = document.getElementById(f.id);
    el.addEventListener("input", save);
    el.addEventListener("change", load);
  });
  CHECKS.forEach((c) => document.getElementById(c.id).addEventListener("change", save));
  SELECTS.forEach((s) => document.getElementById(s.id).addEventListener("change", save));
  TEXTS.forEach((t) => document.getElementById(t.id).addEventListener("input", save));
  RADIOS.forEach((r) => {
    document.querySelectorAll(`input[name="${r.name}"]`).forEach((el) => {
      el.addEventListener("change", save);
    });
  });
  TOGGLES.forEach((t) => {
    document.getElementById(t.control).addEventListener("change", updateSections);
  });
  COLLAPSES.forEach((c) => {
    document.getElementById(c.toggle).addEventListener("click", function () {
      // Currently expanded (body visible) -> collapse it, and vice versa.
      const nowCollapsed = document.getElementById(c.body).hidden === false;
      applyCollapse(c, nowCollapsed);
      chrome.storage.sync.set({ [c.key]: nowCollapsed });
    });
  });

  // --- per-section wiring the generic loop cannot express -------------------
  globalThis.ES.popupSections.forEach((s) => {
    if (s.init) s.init({ save, load, onLoaded: (fn) => onLoadedHooks.push(fn) });
  });

  // --- shell chrome, owned by no feature ------------------------------------
  // Stamp the running version so the footer cannot drift from the manifest.
  document.getElementById("version").textContent =
    "v" + chrome.runtime.getManifest().version;

  // Reset all settings to defaults (two-click confirm). First click arms + warns;
  // a second writes the full defaults object and repaints. Any blur disarms it,
  // so a stray click is safe.
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
