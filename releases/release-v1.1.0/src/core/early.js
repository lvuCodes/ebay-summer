// Flash-of-unstyled-content (FOUC) suppressor. Runs at document_start — BEFORE
// eBay paints — from its own content_scripts entry, ahead of the main bundle
// (which only runs at document_idle, after an async chrome.storage read: far too
// late to beat first paint, so without this the page renders in eBay's default
// layout and then visibly pops into ours — full-width reflow, ad modules hiding).
//
// chrome.storage is async, so it can't be read before paint. localStorage is
// synchronous and same-origin, so content.js mirrors the last-injected CSS there
// on every render (see cacheFouc) and this script replays it immediately. It
// reuses the SAME <style> ids as core/style.js (STYLE_ID / PAGE_STYLE_ID), so
// when the main bundle loads it finds these elements by id and just updates
// their textContent — a seamless handoff, and at worst a one-frame correction
// if the settings changed since the last load. Self-contained: style.js has NOT
// loaded yet at document_start, so the ids and cache keys are literals here,
// mirrored in core/style.js (STYLE_ID / PAGE_STYLE_ID and the cacheFouc keys).
//
// The page CSS is cached PER PAGE KIND (es-fouc-page:<kind>), not under one key.
// The page-agnostic overrides (full-width, hides) are the same everywhere, but the
// LAYOUT part is page-specific — searchCss's .su-grid column ladder, bidsCss,
// summaryCss. A single shared key held only the last page's blob, so a home->search
// nav replayed home's CSS (full-width but NO search grid ladder) and the search
// results still re-columned visibly when the bundle injected searchCss. Keying by
// kind makes each page type replay its own layout, so only the first-ever visit to
// a given kind (empty cache) can still flash.
(function () {
  "use strict";
  const ES = (globalThis.ES = globalThis.ES || {});

  // localStorage keys written by content.js's cacheFouc().
  const SHARED_KEY = "es-fouc-shared";
  const PAGE_KEY_PREFIX = "es-fouc-page:";
  // Mirror of core/style.js STYLE_ID / PAGE_STYLE_ID — reused so the main
  // bundle reconciles these same elements instead of injecting duplicates.
  const STYLE_ID = "ebay-total-style";
  const PAGE_STYLE_ID = "ebay-total-page-style";

  // The ONE URL dispatch: returns the page kind used both for the per-page cache
  // key here and for content.js's routing (content.js reads it back off ES at
  // document_idle — the two entries share the isolated world's globalThis).
  // Exposed for testing.
  function foucPageKind(path) {
    if (path.startsWith("/itm/")) return "listing";
    if (path.startsWith("/sch/")) return "search";
    if (path.includes("watchlist")) return "watchlist";
    if (path.includes("bidsoffers")) return "bids";
    if (path.includes("myebay/summary")) return "summary";
    if (path.includes("myebay/rvi")) return "rvi";
    if (/\/myebay\/saved(\/|$)/.test(path)) return "saved";
    if (path === "/" || path === "") return "home";
    return "other";
  }
  ES.foucPageKind = foucPageKind;

  // Pure: given the two cached CSS strings, the ordered (id, css) <style> specs to
  // inject — skipping any that are empty/missing so a cleared cache injects
  // nothing. Exposed for testing.
  function foucStyleSpecs(shared, page) {
    const specs = [];
    if (shared) specs.push({ id: STYLE_ID, css: shared });
    if (page) specs.push({ id: PAGE_STYLE_ID, css: page });
    return specs;
  }
  ES.foucStyleSpecs = foucStyleSpecs;

  // Side effects only in a real page (guarded so requiring this in Node tests,
  // where document/localStorage are absent, just attaches the pure helpers).
  if (typeof document === "undefined" || typeof localStorage === "undefined") return;
  const root = document.documentElement;
  if (!root) return;

  let shared = "";
  let page = "";
  try {
    shared = localStorage.getItem(SHARED_KEY) || "";
    page = localStorage.getItem(PAGE_KEY_PREFIX + foucPageKind(location.pathname)) || "";
  } catch (e) {
    return; // localStorage blocked (e.g. privacy mode) — the main bundle still runs.
  }

  foucStyleSpecs(shared, page).forEach((spec) => {
    if (document.getElementById(spec.id)) return;
    const s = document.createElement("style");
    s.id = spec.id;
    s.textContent = spec.css;
    root.appendChild(s);
  });
})();
