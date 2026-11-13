const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const popupHtml = fs.readFileSync(path.join(root, "popup", "popup.html"), "utf8");

test("the store-listing name is plain ASCII so a keyboard search for 'summer' matches", () => {
  assert.equal(manifest.name, "eBay Summer");
  assert.match(manifest.name.toLowerCase(), /summer/);
});

test("the toolbar short name fits Chrome's 12-character budget and keeps the sigma wordmark", () => {
  assert.equal(manifest.short_name, "eBay Σummer");
  assert.ok([...manifest.short_name].length <= 12);
  assert.equal(manifest.action.default_title, "eBay Σummer");
});

test("the popup keeps the sigma wordmark", () => {
  assert.match(popupHtml, /<title>eBay Σummer<\/title>/);
  assert.match(popupHtml, /<h1[^>]*>[^<]*Σummer/);
});
