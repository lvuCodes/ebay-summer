import { test, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import {
  listReleases,
  latestRelease,
  cmpVersion,
  groupLabel,
  validateReleases,
  releaseUrl,
} from "../src/lib/releases.ts";

const data = JSON.parse(
  await readFile(new URL("../src/data/releases.json", import.meta.url), "utf8"),
);

test("cmpVersion orders semver numerically, not lexically", () => {
  expect(cmpVersion("1.1.10", "1.1.9")).toBe(1);
  expect(cmpVersion("1.0.0", "1.1.0")).toBe(-1);
  expect(cmpVersion("1.1.1", "1.1.1")).toBe(0);
});

test("listReleases returns newest first", () => {
  const versions = listReleases(data).map((r) => r.version);
  expect(versions).toEqual([...versions].sort((a, b) => cmpVersion(b, a)));
});

// Derived rather than pinned to a literal version, so cutting a release does not
// require editing this file.
test("latestRelease is the highest version", () => {
  const versions = listReleases(data).map((r) => r.version);
  const highest = [...versions].sort((a, b) => cmpVersion(b, a))[0];
  expect(latestRelease(data)!.version).toBe(highest);
});

test("groupLabel maps known types and passes through unknowns", () => {
  expect(groupLabel("added")).toBe("Added");
  expect(groupLabel("fixed")).toBe("Fixed");
  expect(groupLabel("changed")).toBe("Changed");
  expect(groupLabel("known-issues")).toBe("Known Issues");
  expect(groupLabel("weird")).toBe("weird");
});

test("shipped releases.json passes validation", () => {
  expect(validateReleases(data)).toBe(true);
});

test("validateReleases rejects malformed data", () => {
  expect(() => validateReleases({ releases: [] })).toThrow(/no releases/);
  expect(() => validateReleases({ releases: [{ version: "1", date: "nope" }] })).toThrow(
    /invalid date/,
  );
  expect(() =>
    validateReleases({
      releases: [{ version: "1", date: "2026-01-01", groups: [{ type: "nope", items: ["x"] }] }],
    }),
  ).toThrow(/unknown group type/);
});

test("validateReleases rejects a release missing its version", () => {
  expect(() => validateReleases({ releases: [{ date: "2026-01-01" }] })).toThrow(/missing version/);
});

test("validateReleases rejects a release whose date is absent entirely", () => {
  expect(() => validateReleases({ releases: [{ version: "1" }] })).toThrow(/invalid date/);
});

test("validateReleases rejects a group with an empty or non-array items list", () => {
  expect(() =>
    validateReleases({
      releases: [{ version: "1", date: "2026-01-01", groups: [{ type: "fixed", items: [] }] }],
    }),
  ).toThrow(/has no items/);
  expect(() =>
    validateReleases({
      releases: [{ version: "1", date: "2026-01-01", groups: [{ type: "fixed", items: "nope" }] }],
    }),
  ).toThrow(/has no items/);
});

test("validateReleases accepts a release with no groups at all", () => {
  expect(validateReleases({ releases: [{ version: "1", date: "2026-01-01" }] })).toBe(true);
});

test("empty / missing data degrades safely", () => {
  expect(listReleases(null)).toEqual([]);
  expect(latestRelease({})).toBe(null);
});

test("releaseUrl points at the raw zip in the repo", () => {
  expect(releaseUrl("releases/v1.2.0.zip")).toBe(
    "https://github.com/lvuCodes/ebay-summer/raw/main/releases/v1.2.0.zip",
  );
  expect(releaseUrl(null)).toBe(null);
});

// The changelog has twice advertised a zip that was not there: v1.1.1, withdrawn
// but still linked, and the v1.0.0/v1.1.0 renames to -DEPRECATED. Naming the file
// is not enough — assert it exists in the repo the link resolves against.
test("every shipped release links a package that exists in the repo", () => {
  for (const r of listReleases(data)) {
    expect(r.package).toMatch(/^releases\/v.+\.zip$/);
    expect(releaseUrl(r.package)!.startsWith("https://")).toBe(true);
    const onDisk = new URL(`../../${r.package}`, import.meta.url);
    expect(existsSync(onDisk), `${r.version} package missing: ${r.package}`).toBe(true);
  }
});
