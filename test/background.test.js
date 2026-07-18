// The MV3 service worker. It has no exports — it registers its listeners as a
// load-time side effect — so the harness stubs `chrome`, requires the file
// fresh, and captures the registered handlers to call them directly. That keeps
// the worker testable without reshaping the source into a module.
//
// The icon assertion below is the one that matters most: a relative fallback
// path resolves against the WORKER's own location, not the extension root, so a
// bare "icons/icon128.png" silently breaks the moment this file moves. Pinning
// the root-anchored form keeps the icon independent of where the worker lives.
const { test } = require("node:test");
const assert = require("node:assert/strict");

const EXT_ORIGIN = "chrome-extension://testextensionid/";
const BUNDLED_ICON = EXT_ORIGIN + "icons/icon128.png";

// Install a recording `chrome` stub, then re-require the worker so its
// addListener calls land on this stub. `existing` seeds notifications.getAll.
// The reload is what captures the handlers — addListener only fires at load.
function loadWorker(existing = {}, lastError = null) {
  const calls = { created: [], cleared: [], windows: [], tabs: [], warned: [] };
  let onMessage = null;
  let onClicked = null;

  // windows/tabs.update invoke their callback the way Chrome does, with
  // runtime.lastError set when the target is gone, so the failure path is real.
  const update = (bucket) => (id, opts, cb) => {
    calls[bucket].push({ id, opts });
    if (cb) cb();
  };

  globalThis.chrome = {
    runtime: {
      getURL: (path) => EXT_ORIGIN + path,
      onMessage: { addListener: (fn) => (onMessage = fn) },
      lastError,
    },
    notifications: {
      create: (id, opts) => calls.created.push({ id, opts }),
      clear: (id) => calls.cleared.push(id),
      getAll: (cb) => cb(existing),
      onClicked: { addListener: (fn) => (onClicked = fn) },
    },
    windows: { update: update("windows") },
    tabs: { update: update("tabs") },
  };

  const path = require.resolve("../background.js");
  delete require.cache[path];
  require(path);

  // The worker resolves `chrome` at call time, not load time, so a later
  // loadWorker() would otherwise redirect this handle's calls into the newer
  // stub. Re-installing before each invocation keeps handles independent.
  const stub = globalThis.chrome;
  const enter = (fn) => (...args) => {
    globalThis.chrome = stub;
    const warn = console.warn;
    console.warn = (...a) => calls.warned.push(a.join(" "));
    try {
      return fn(...args);
    } finally {
      console.warn = warn;
    }
  };

  return {
    calls,
    send: enter((msg, sender) => onMessage(msg, sender)),
    click: enter((id) => onClicked(id)),
  };
}

const SENDER = { tab: { id: 7, windowId: 3 } };

// --- notification icon (trust boundary + path anchoring) -------------------
test("icon falls back to the bundled icon anchored at the extension root", () => {
  const w = loadWorker();
  w.send({ type: "ending-soon", threshold: 30 }, SENDER);

  // Must be root-anchored: a relative "icons/icon128.png" resolves against the
  // worker's own directory rather than the extension root.
  assert.equal(w.calls.created[0].opts.iconUrl, BUNDLED_ICON);
});

test("icon uses the listing photo when it is an http(s) URL", () => {
  const w = loadWorker();
  w.send({ type: "ending-soon", threshold: 30, iconUrl: "https://i.ebayimg.com/x.jpg" }, SENDER);
  assert.equal(w.calls.created[0].opts.iconUrl, "https://i.ebayimg.com/x.jpg");
});

test("icon rejects a non-http scheme from the content script", () => {
  for (const hostile of ["javascript:alert(1)", "data:image/png;base64,AAA", "file:///etc/passwd", 42, null]) {
    const w = loadWorker();
    w.send({ type: "ending-soon", threshold: 30, iconUrl: hostile }, SENDER);
    assert.equal(w.calls.created[0].opts.iconUrl, BUNDLED_ICON);
  }
});

// --- ending-soon -----------------------------------------------------------
test("ending-soon encodes the tab and window into the notification id", () => {
  const w = loadWorker();
  w.send({ type: "ending-soon", threshold: 30, title: "Rare card" }, SENDER);

  assert.equal(w.calls.created.length, 1);
  const { id, opts } = w.calls.created[0];
  assert.match(id, /^ebay\|7\|3\|\d+$/);
  assert.equal(opts.title, "Auction ending in 30s");
  assert.equal(opts.message, "Rare card");
  assert.equal(opts.requireInteraction, true);
});

test("ending-soon falls back to generic copy when the title is missing", () => {
  const w = loadWorker();
  w.send({ type: "ending-soon", threshold: 10 }, SENDER);
  assert.equal(w.calls.created[0].opts.message, "An eBay auction is ending soon.");
});

// --- auction-ended ---------------------------------------------------------
test("auction-ended sweeps only the sending tab's own badges", () => {
  const w = loadWorker({
    "ebay|7|3|111": {},
    "ebay|7|3|222": {},
    "ebay|9|3|333": {}, // another tab
    "other|7|3|444": {}, // another extension's id shape
  });
  w.send({ type: "auction-ended" }, SENDER);

  assert.deepEqual(w.calls.cleared.sort(), ["ebay|7|3|111", "ebay|7|3|222"]);
  assert.equal(w.calls.created.length, 0);
});

test("auction-ended leaves a persistent ended badge only when opted in", () => {
  const w = loadWorker();
  w.send({ type: "auction-ended", persistent: true, title: "Rare card" }, SENDER);

  assert.equal(w.calls.created.length, 1);
  const { id, opts } = w.calls.created[0];
  assert.equal(id, "ebay|7|3|ended");
  assert.equal(opts.title, "Auction ended");
  assert.equal(opts.message, "Rare card");
});

test("the ended badge falls back to generic copy when the title is missing", () => {
  const w = loadWorker();
  w.send({ type: "auction-ended", persistent: true }, SENDER);
  assert.equal(
    w.calls.created[0].opts.message,
    "An eBay auction you were watching has ended."
  );
});

test("two worker handles stay independent despite the shared chrome global", () => {
  const a = loadWorker();
  const b = loadWorker();
  a.send({ type: "ending-soon", threshold: 30 }, SENDER);

  assert.equal(a.calls.created.length, 1);
  assert.equal(b.calls.created.length, 0);
});

test("auction-ended does not clear the ended badge it is about to replace", () => {
  const w = loadWorker({ "ebay|7|3|111": {}, "ebay|7|3|ended": {} });
  w.send({ type: "auction-ended", persistent: true, title: "Second" }, SENDER);

  // Clearing the id create() is re-issuing races it and can erase the new badge.
  assert.deepEqual(w.calls.cleared, ["ebay|7|3|111"]);
  assert.equal(w.calls.created[0].id, "ebay|7|3|ended");
});

test("auction-ended does clear a stale ended badge when not replacing it", () => {
  const w = loadWorker({ "ebay|7|3|111": {}, "ebay|7|3|ended": {} });
  w.send({ type: "auction-ended" }, SENDER);

  assert.deepEqual(w.calls.cleared.sort(), ["ebay|7|3|111", "ebay|7|3|ended"]);
  assert.equal(w.calls.created.length, 0);
});

test("auction-ended tolerates getAll returning nothing", () => {
  const w = loadWorker(null);
  assert.doesNotThrow(() => w.send({ type: "auction-ended" }, SENDER));
  assert.deepEqual(w.calls.cleared, []);
});

// --- message guards --------------------------------------------------------
test("messages without a sender tab or a known type are ignored", () => {
  const w = loadWorker();
  w.send(null, SENDER);
  w.send({ type: "ending-soon" }, {});
  w.send({ type: "ending-soon" }, { tab: null });
  w.send({ type: "some-other-message" }, SENDER);
  assert.equal(w.calls.created.length, 0);
  assert.equal(w.calls.cleared.length, 0);
});

// --- click-to-focus --------------------------------------------------------
test("clicking a badge focuses its window, then its tab, then clears it", () => {
  const w = loadWorker();
  w.click("ebay|7|3|1234");

  assert.deepEqual(w.calls.windows, [{ id: 3, opts: { focused: true } }]);
  assert.deepEqual(w.calls.tabs, [{ id: 7, opts: { active: true } }]);
  assert.deepEqual(w.calls.cleared, ["ebay|7|3|1234"]);
});

test("clicking the persistent ended badge still focuses the tab", () => {
  const w = loadWorker();
  w.click("ebay|7|3|ended");
  assert.deepEqual(w.calls.tabs, [{ id: 7, opts: { active: true } }]);
});

test("a click on a closed tab surfaces the failure instead of swallowing it", () => {
  const w = loadWorker({}, { message: "No tab with id: 7." });
  w.click("ebay|7|3|ended");

  assert.equal(w.calls.warned.length, 2); // one per update call
  assert.match(w.calls.warned[0], /could not focus window 3 — No tab with id: 7\./);
  assert.match(w.calls.warned[1], /could not focus tab 7 — No tab with id: 7\./);
  // The badge still goes away — a dead tab should not leave it stuck.
  assert.deepEqual(w.calls.cleared, ["ebay|7|3|ended"]);
});

test("a successful click warns about nothing", () => {
  const w = loadWorker();
  w.click("ebay|7|3|1234");
  assert.deepEqual(w.calls.warned, []);
});

test("a foreign notification id is left entirely alone", () => {
  const w = loadWorker();
  w.click("someotherextension|7|3|1234");
  assert.deepEqual(w.calls.windows, []);
  assert.deepEqual(w.calls.tabs, []);
  assert.deepEqual(w.calls.cleared, []);
});

test("a malformed ebay id clears the badge without bogus focus calls", () => {
  const w = loadWorker();
  w.click("ebay|notanumber|alsonot|1234");
  assert.deepEqual(w.calls.windows, []);
  assert.deepEqual(w.calls.tabs, []);
  assert.deepEqual(w.calls.cleared, ["ebay|notanumber|alsonot|1234"]);
});
