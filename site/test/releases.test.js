import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  listReleases,
  latestRelease,
  cmpVersion,
  groupLabel,
  validateReleases,
} from "../src/lib/releases.js";

const data = JSON.parse(
  await readFile(new URL("../src/data/releases.json", import.meta.url)),
);

test("cmpVersion orders semver numerically, not lexically", () => {
  assert.equal(cmpVersion("1.1.10", "1.1.9"), 1);
  assert.equal(cmpVersion("1.0.0", "1.1.0"), -1);
  assert.equal(cmpVersion("1.1.1", "1.1.1"), 0);
});

test("listReleases returns newest first", () => {
  const versions = listReleases(data).map((r) => r.version);
  assert.deepEqual(versions, [...versions].sort((a, b) => cmpVersion(b, a)));
  assert.equal(versions[0], "1.1.1");
});

test("latestRelease is the highest shipped version, skipping unreleased entries", () => {
  assert.equal(latestRelease(data).version, "1.1.0");
  assert.equal(
    latestRelease({
      releases: [
        { version: "2.0.0", unreleased: true },
        { version: "1.9.0", date: "2026-01-01" },
      ],
    }).version,
    "1.9.0",
  );
  assert.equal(latestRelease({ releases: [{ version: "2.0.0", unreleased: true }] }), null);
});

test("an unreleased entry validates without a date, but not with one", () => {
  assert.equal(validateReleases({ releases: [{ version: "2.0.0", unreleased: true }] }), true);
  assert.throws(
    () => validateReleases({ releases: [{ version: "2.0.0", unreleased: true, date: "2026-01-01" }] }),
    /unreleased but carries a date/,
  );
});

test("groupLabel maps known types and passes through unknowns", () => {
  assert.equal(groupLabel("added"), "Added");
  assert.equal(groupLabel("fixed"), "Fixed");
  assert.equal(groupLabel("changed"), "Changed");
  assert.equal(groupLabel("weird"), "weird");
});

test("shipped releases.json passes validation", () => {
  assert.equal(validateReleases(data), true);
});

test("validateReleases rejects malformed data", () => {
  assert.throws(() => validateReleases({ releases: [] }), /no releases/);
  assert.throws(
    () => validateReleases({ releases: [{ version: "1", date: "nope" }] }),
    /invalid date/,
  );
  assert.throws(
    () =>
      validateReleases({
        releases: [{ version: "1", date: "2026-01-01", groups: [{ type: "nope", items: ["x"] }] }],
      }),
    /unknown group type/,
  );
});

test("empty / missing data degrades safely", () => {
  assert.deepEqual(listReleases(null), []);
  assert.equal(latestRelease({}), null);
});
