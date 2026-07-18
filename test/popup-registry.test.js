// The popup feature seam. These tests exist because the v1.1.1 package shipped a
// popup.html that loaded three scripts the package excluded: sanitizeEmoji came
// back undefined and load() threw on the first emoji <select>, half-initializing
// the popup on every open. A registered section must therefore contribute all of
// its markup, controls, and wiring — and an unregistered one must contribute
// none, so omitting a feature leaves nothing dangling.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { ES } = require("./load-popup.js");

test("the released popup is exactly the calculator and notifications sections", () => {
  assert.deepEqual(
    ES.popupSections.map((s) => s.id),
    ["esttotal", "showtotal", "auction"],
  );
  const auction = ES.popupSections.find((s) => s.id === "auction");
  assert.equal(auction.title, "Auction Ending Notification");
  assert.equal(auction.column, 2);
  assert.equal(typeof auction.render, "function");
});

test("collectPopupControls flattens every section's controls in registration order", () => {
  const fields = ES.collectPopupControls("fields").map((f) => f.key);
  assert.deepEqual(fields, ["taxRate", "shipFloor", "shipPct", "notifyAt1", "notifyAt2"]);
  const checks = ES.collectPopupControls("checks").map((c) => c.key);
  assert.ok(checks.includes("estTotal"));
  assert.ok(checks.includes("pageSearch"));
  assert.ok(checks.includes("notifyEnabled"));
});

test("collectPopupControls rejects an unknown control kind", () => {
  assert.throws(() => ES.collectPopupControls("widgets"), /unknown control kind/);
});

// The core property: nothing outside a feature's own module names that feature.
test("no registered control references a setting with no registered default", () => {
  const kinds = ["fields", "checks", "selects", "texts", "radios"];
  for (const kind of kinds) {
    for (const c of ES.collectPopupControls(kind)) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(ES.DEFAULTS, c.key),
        `${kind} control "${c.id}" is bound to "${c.key}", which no schema registers`,
      );
    }
  }
});

// Guards the exact v1.1.1 failure: a select whose sanitizer came from a module
// the package excluded, called unconditionally by load().
test("every select carries a callable sanitizer", () => {
  for (const s of ES.collectPopupControls("selects")) {
    assert.equal(typeof s.san, "function", `select "${s.id}" has no callable sanitizer`);
  }
});

test("a section renders its controls into the body it is given", () => {
  const auction = ES.popupSections.find((s) => s.id === "auction");
  const body = ES.h("div", {});
  auction.render(body);

  // Every control the section declares must exist in the markup it renders.
  const declared = ["fields", "checks", "selects"]
    .flatMap((k) => (auction.controls[k] || []).map((c) => c.id))
    .filter((id) => id !== "sec-auction"); // the master lives in the header, not the body
  for (const id of declared) {
    assert.ok(body.querySelector(`#${id}`), `rendered body is missing control #${id}`);
  }
  assert.ok(body.querySelector("#notify-preview"), "rendered body is missing the preview button");
});

test("the sound select offers exactly the SOUNDS presets", () => {
  const auction = ES.popupSections.find((s) => s.id === "auction");
  const body = ES.h("div", {});
  auction.render(body);
  const values = body.querySelector("#notify-sound").children.map((o) => o.getAttribute("value"));
  assert.deepEqual(values, Object.keys(ES.SOUNDS));
});

// Mount every registered section the way the popup shell will, so the assertions
// below run against the assembled DOM rather than one section in isolation.
function mountAll() {
  const root = ES.h("div", {});
  for (const s of ES.popupSections) {
    const { header, body } = ES.sectionEl(s.id, s.title, s.master, s.masterTitle);
    s.render(body);
    root.appendChild(header);
    root.appendChild(body);
  }
  return root;
}

// A toggle naming an id nothing renders would throw on `.hidden` at popup open —
// the same shape of failure as the v1.1.1 crash, one property further along.
test("every toggle's control and target ids exist in the assembled popup", () => {
  const root = mountAll();
  for (const t of ES.collectPopupToggles()) {
    assert.ok(root.querySelector(`#${t.control}`), `toggle control #${t.control} is never rendered`);
    for (const id of t.sections) {
      assert.ok(root.querySelector(`#${id}`), `toggle "${t.control}" targets #${id}, never rendered`);
    }
  }
});

test("every registered control exists in the assembled popup", () => {
  const root = mountAll();
  for (const kind of ["fields", "checks", "selects", "texts"]) {
    for (const c of ES.collectPopupControls(kind)) {
      assert.ok(root.querySelector(`#${c.id}`), `${kind} control #${c.id} is never rendered`);
    }
  }
});

test("section ids are unique, so the chrome ids they derive cannot collide", () => {
  const ids = ES.popupSections.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
});
