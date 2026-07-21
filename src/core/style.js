// eBay Σummer. Copyright (C) 2026 lvuCodes. Licensed under GPL-3.0-or-later; see LICENSE.md.
//
// Stylesheet maintenance for the content script: keeps the two injected
// <style> elements (shared feature CSS + per-page CSS) in sync with the
// config, and mirrors them into the localStorage FOUC cache that early.js
// replays at document_start. Feature-agnostic — the CSS itself comes from the
// registered features (registry.js's assemblers), and clearInjected() reverses
// every feature via its registered clear() hook. content.js decides WHEN to
// call these; this module owns HOW the stylesheets are touched.
(function () {
  "use strict";
  const ES = (globalThis.ES = globalThis.ES || {});
  const { config, assembleSharedCss, assemblePageCss } = ES;

  // The <style>-element ids, shared with early.js (which mirrors them as
  // literals — it runs at document_start, before this file exists).
  const STYLE_ID = "ebay-total-style";
  const PAGE_STYLE_ID = "ebay-total-page-style";

  // Mirror the last-injected CSS into localStorage so early.js can replay it
  // synchronously at document_start on the next load and beat first paint (the
  // FOUC fix — chrome.storage is async, localStorage is not). Keys are mirrored in
  // early.js. Wrapped: localStorage can throw (privacy mode / disabled storage),
  // and a cache miss only costs us the flash we already had.
  function cacheFouc(key, text) {
    try {
      localStorage.setItem(key, text);
    } catch (e) {
      /* storage blocked — early.js simply has nothing to replay */
    }
  }

  // Wipe every FOUC cache entry — used when the extension is disabled, so early.js
  // never replays our overrides (a flash-then-strip) on the next load of ANY page.
  function clearFoucCache() {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k === "es-fouc-shared" || (k && k.startsWith("es-fouc-page:"))) {
          localStorage.removeItem(k);
        }
      }
    } catch (e) {
      /* storage blocked — nothing cached to clear */
    }
  }

  // Keep the shared-styles <style> in sync with the features' static CSS.
  function injectCss() {
    const css = assembleSharedCss();
    let s = document.getElementById(STYLE_ID);
    if (!s) {
      s = document.createElement("style");
      s.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(s);
    }
    if (s.textContent !== css) s.textContent = css;
    cacheFouc("es-fouc-shared", css);
  }

  // Keep the page-specific <style> (per-page layout + the page-agnostic
  // config-driven overrides) in sync with the current config. Each feature's
  // pageCss(kind, config) contributes its slice; empty when nothing applies.
  // `kind` is the routed page kind ("other" on unknown pages, which only carry
  // the page-agnostic overrides).
  function injectPageCss(kind) {
    const css = assemblePageCss(kind, config);
    // Cache per page kind (es-fouc-page:<kind>) for early.js's next-load replay;
    // unknown pages share "other" (mirrors early.js's foucPageKind). Every
    // page-agnostic override (full-width, module hides) and the page-scoped layout
    // live here; the layout selectors are no-ops off their own page, so replaying
    // the last page's blob on a different page type is harmless until this render
    // reconciles it.
    cacheFouc("es-fouc-page:" + (kind || "other"), css);
    let s = document.getElementById(PAGE_STYLE_ID);
    if (!css) {
      if (s) s.textContent = "";
      return;
    }
    if (!s) {
      s = document.createElement("style");
      s.id = PAGE_STYLE_ID;
      (document.head || document.documentElement).appendChild(s);
    }
    if (s.textContent !== css) s.textContent = css;
  }

  // Master-off strip: remove everything any feature ever injected (via each
  // feature's registered clear()), empty both stylesheets, and wipe the FOUC
  // cache so early.js won't replay our overrides on the next load even though
  // the extension is off.
  function clearInjected() {
    ES.features.forEach((f) => f.clear && f.clear());
    const s1 = document.getElementById(STYLE_ID);
    if (s1) s1.textContent = "";
    const s2 = document.getElementById(PAGE_STYLE_ID);
    if (s2) s2.textContent = "";
    clearFoucCache();
  }

  Object.assign(ES, { STYLE_ID, PAGE_STYLE_ID, injectCss, injectPageCss, clearInjected });
})();
