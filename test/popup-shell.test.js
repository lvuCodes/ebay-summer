// The popup shell, mounted end to end against the fake DOM and a stubbed chrome
// API. This is the test the v1.1.1 package would have failed: it opens the popup
// exactly as Chrome does — skeleton markup, feature scripts, then popup.js — and
// asserts initialization completes and every control is populated. A section
// whose module is absent must simply not appear, with nothing left dangling.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { makeDoc, installGlobals } = require("./fake-dom.js");

installGlobals();

// The skeleton popup.html ships, built here so the test fails if the shell grows
// a dependency on markup the real skeleton does not carry.
function skeleton(doc) {
  const mk = (tag, id, cls) => {
    const e = doc.createElement(tag);
    if (id) e.setAttribute("id", id);
    if (cls) e.className = cls;
    doc.body.appendChild(e);
    return e;
  };
  mk("input", "enabled");
  mk("button", "reload-ebay");
  mk("button", "reset-defaults");
  mk("span", "version");
  mk("div", "col-1", "col");
  mk("div", "col-2", "col");
}

// A chrome stub recording what the popup writes, so save() can be observed.
function fakeChrome(stored) {
  const writes = [];
  return {
    writes,
    api: {
      storage: {
        sync: {
          get(defaults, cb) {
            cb({ ...defaults, ...stored });
          },
          set(obj, cb) {
            writes.push(obj);
            if (cb) cb();
          },
        },
      },
      tabs: {
        query(_q, cb) {
          cb([{ id: 1 }, { id: 2 }]);
        },
        reload() {},
      },
      runtime: {
        getManifest: () => ({ version: "1.1.0" }),
      },
    },
  };
}

// Loads the popup the way popup.html does, into a fresh module registry so each
// case gets its own ES and its own IIFE run.
function openPopup({ stored = {}, features = ["calculator", "notifications"] } = {}) {
  const doc = makeDoc();
  global.document = doc;
  global.window = {};
  skeleton(doc);

  const chrome = fakeChrome(stored);
  global.chrome = chrome.api;
  globalThis.ES = undefined;

  const SRC = path.join(__dirname, "..", "src");
  const load = (rel) => {
    delete require.cache[require.resolve(rel)];
    require(rel);
  };

  load(path.join(SRC, "core/registry.js"));
  load(path.join(SRC, "core/popup-registry.js"));
  load(path.join(SRC, "core/popup-dom.js"));
  load(path.join(SRC, "core/sanitize.js"));
  load(path.join(SRC, "notifications/sounds.js"));
  if (features.includes("calculator")) load(path.join(SRC, "calculator/schema.js"));
  if (features.includes("notifications")) load(path.join(SRC, "notifications/schema.js"));
  load(path.join(SRC, "core/defaults.js"));
  if (features.includes("calculator")) load(path.join(SRC, "calculator/popup.js"));
  if (features.includes("notifications")) load(path.join(SRC, "notifications/popup.js"));
  load(path.join(__dirname, "..", "popup/popup.js"));

  return { doc, chrome, ES: globalThis.ES };
}

test("the popup opens without throwing and mounts both features", () => {
  const { doc } = openPopup();
  assert.ok(doc.getElementById("body-esttotal"), "calculator section did not mount");
  assert.ok(doc.getElementById("body-showtotal"), "page-toggle section did not mount");
  assert.ok(doc.getElementById("body-auction"), "notifications section did not mount");
});

test("sections mount into the column each declared", () => {
  const { doc } = openPopup();
  const col1 = doc.getElementById("col-1");
  const col2 = doc.getElementById("col-2");
  assert.ok(col1.querySelector("#body-esttotal"));
  assert.ok(col1.querySelector("#body-showtotal"));
  assert.ok(col2.querySelector("#body-auction"));
  assert.equal(col2.querySelector("#body-esttotal"), null);
});

test("controls are populated from storage, rates shown as percents", () => {
  const { doc } = openPopup({ stored: { taxRate: 0.1, shipFloor: 8, notifyAt1: 45 } });
  assert.equal(doc.getElementById("tax").value, 10);
  assert.equal(doc.getElementById("ship-floor").value, 8);
  assert.equal(doc.getElementById("notify-1").value, 45);
});

test("defaults fill controls the stored map does not mention", () => {
  const { doc, ES } = openPopup();
  assert.equal(doc.getElementById("tax").value, +(ES.DEFAULTS.taxRate * 100).toFixed(4));
  assert.equal(doc.getElementById("notify-sound").value, ES.DEFAULTS.notifySound);
});

test("the version comes from the manifest, not a literal", () => {
  const { doc } = openPopup();
  assert.equal(doc.getElementById("version").textContent, "v1.1.0");
});

test("editing a field writes the decimal form back to storage", () => {
  const { doc, chrome } = openPopup();
  const tax = doc.getElementById("tax");
  tax.value = 10;
  tax.dispatch("input");
  const last = chrome.writes[chrome.writes.length - 1];
  assert.equal(last.taxRate, 0.1);
});

test("a section master hides its own body and nothing else", () => {
  const { doc } = openPopup({ stored: { estTotal: false, notifyEnabled: true } });
  assert.equal(doc.getElementById("body-esttotal").hidden, true);
  assert.equal(doc.getElementById("body-showtotal").hidden, true);
  assert.equal(doc.getElementById("body-auction").hidden, false);
});

test("the select-all header reflects the page switches it summarizes", () => {
  const all = { pageHome: true, pageSearch: true, pageListing: true, pageWatchlist: true,
    pageBidsOffers: true, pageSummary: true, pageRecentView: true, pageSaved: true };
  const { doc } = openPopup({ stored: all });
  assert.equal(doc.getElementById("page-all").checked, true);
  assert.equal(doc.getElementById("page-all").indeterminate, false);

  const some = openPopup({ stored: { ...all, pageSaved: false } });
  assert.equal(some.doc.getElementById("page-all").checked, false);
  assert.equal(some.doc.getElementById("page-all").indeterminate, true);
});

// The property v1.1.1 lacked: dropping a feature's scripts drops its whole
// presence, and the popup still opens.
test("omitting a feature's modules leaves a working popup with no trace of it", () => {
  const { doc } = openPopup({ features: ["calculator"] });
  assert.ok(doc.getElementById("body-esttotal"), "remaining feature did not mount");
  assert.equal(doc.getElementById("body-auction"), null, "absent feature left markup behind");
  assert.equal(doc.getElementById("notify-sound"), null, "absent feature left a control behind");
  assert.equal(doc.getElementById("notify-preview"), null, "absent feature left a button behind");
  // And the shell still finished: the footer only gets stamped at the very end.
  assert.equal(doc.getElementById("version").textContent, "v1.1.0");
});
