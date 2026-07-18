// The popup feature seam. These tests exist because the v1.1.1 package shipped a
// popup.html that loaded three scripts the package excluded: sanitizeEmoji came
// back undefined and load() threw on the first emoji <select>, half-initializing
// the popup on every open. A registered section must therefore contribute all of
// its markup, controls, and wiring — and an unregistered one must contribute
// none, so omitting a feature leaves nothing dangling.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { ES } = require("./load-popup.js");

test("a feature registers exactly one section, with its chrome described", () => {
  const auction = ES.popupSections.find((s) => s.id === "auction");
  assert.ok(auction, "notifications/popup.js registered no section");
  assert.equal(auction.title, "Auction Ending Notification");
  assert.equal(auction.column, 2);
  assert.equal(typeof auction.render, "function");
});

test("collectPopupControls flattens every section's controls in order", () => {
  const checks = ES.collectPopupControls("checks").map((c) => c.key);
  assert.ok(checks.includes("notifyEnabled"));
  assert.ok(checks.includes("notifySoundEnabled"));
  const fields = ES.collectPopupControls("fields").map((f) => f.key);
  assert.deepEqual(fields, ["notifyAt1", "notifyAt2"]);
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

test("section toggles name only ids the section itself renders", () => {
  const auction = ES.popupSections.find((s) => s.id === "auction");
  for (const t of auction.toggles) {
    assert.ok(
      t.sections.every((id) => id === `body-${auction.id}` || id.startsWith(`body-${auction.id}`)),
      `toggle "${t.control}" reveals ${t.sections}, which it does not own`,
    );
  }
});
