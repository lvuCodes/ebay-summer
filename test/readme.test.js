const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const { version } = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

test("the install step downloads the release asset for the manifest version", () => {
  const url = `https://github.com/lvuCodes/ebay-summer/releases/download/v${version}/v${version}.zip`;
  assert.ok(readme.includes(`(${url})`), `README should link ${url}`);
});

test("the install step no longer links the in-repo releases/ copy", () => {
  assert.doesNotMatch(readme, /\]\(releases\//);
});
