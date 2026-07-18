// The popup's DOM builders. A feature component's whole markup goes through
// these, so their prop and child handling is what decides whether a rendered
// section matches the hand-written markup it replaced.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { ES } = require("./load-popup.js");

const { h, switchEl, sectionEl } = ES;

test("h sets class and text through their dedicated props", () => {
  const node = h("p", { class: "hint", text: "hello" });
  assert.equal(node.tagName, "P");
  assert.equal(node.className, "hint");
  assert.equal(node.textContent, "hello");
});

test("h writes any other prop as an attribute", () => {
  const node = h("input", { type: "number", min: 0, step: 1, id: "notify-1" });
  assert.equal(node.getAttribute("type"), "number");
  assert.equal(node.getAttribute("min"), "0");
  assert.equal(node.getAttribute("id"), "notify-1");
});

test("h renders a true prop as a bare attribute and skips null/false", () => {
  const node = h("input", { disabled: true, hidden: false, title: null });
  assert.equal(node.getAttribute("disabled"), "");
  assert.equal(node.getAttribute("hidden"), null);
  assert.equal(node.getAttribute("title"), null);
});

test("h tolerates missing props entirely", () => {
  assert.equal(h("div").tagName, "DIV");
  assert.equal(h("div", null).tagName, "DIV");
});

test("h appends element, string, and nested-array children, skipping nullish", () => {
  const node = h("div", {}, h("span", { text: "a" }), "raw", null, false, [
    h("span", { text: "b" }),
  ]);
  assert.equal(node.children.length, 2);
  assert.equal(node.textContent, "araw" + "b");
});

test("switchEl builds a labelled switch and omits the label when unnamed", () => {
  const labelled = switchEl("notify-1-enabled", "First alert");
  assert.equal(labelled.querySelector("input").getAttribute("id"), "notify-1-enabled");
  assert.equal(labelled.querySelector(".switch__label").textContent, "First alert");

  const bare = switchEl("sec-auction", null);
  assert.equal(bare.querySelector(".switch__label"), null);
});

test("switchEl applies a variant class only when given one", () => {
  assert.equal(switchEl("a", null, "inline").className, "switch switch--inline");
  assert.equal(switchEl("a", null).className, "switch");
});

test("sectionEl returns header and body as siblings, ids derived from the section id", () => {
  const { header, body } = sectionEl("auction", "Auction Ending Notification", "sec-auction");
  assert.equal(header.getAttribute("id"), "header-auction");
  assert.equal(body.getAttribute("id"), "body-auction");
  assert.equal(header.querySelector(".group-header").textContent, "Auction Ending Notification");
  assert.equal(header.querySelector("input").getAttribute("id"), "sec-auction");
  assert.ok(!header.contains(body), "body must not nest inside the header row");
});

test("sectionEl omits the master switch for a section that has none", () => {
  const { header } = sectionEl("showtotal", "Show Est. Total On…", null);
  assert.equal(header.querySelector("input"), null);
});
