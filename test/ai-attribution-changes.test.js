const { test } = require("node:test");
const assert = require("node:assert/strict");

const load = () => import("../scripts/ai-attribution.mjs");

const commit = (parents, name, email, subject, trailer, coAuthors, numstat) =>
  `\0${[parents, name, email, subject, trailer, coAuthors].join("\x1f")}\n\n${numstat}\n`;

const claude = "Claude Opus 5.5 <noreply@anthropic.com>";

const log = [
  commit("a1", "Lauren Vu", "l@v.c", "fix(ci): run CI", "Dependabot-Fix", claude, "5\t1\t.github/ci.yml"),
  commit("a1 b2", "Lauren Vu", "l@v.c", "Merge main into dev", "merge-conflict", claude, "2\t0\tsrc/x.js"),
  commit("a1", "dependabot[bot]", "1+dependabot[bot]@users.noreply.github.com", "chore(deps): bump", "", "", "40\t0\tpackage.json"),
  commit("a1", "Lauren Vu", "l@v.c", "docs: readme", "", "", "3\t0\tREADME.md\n9\t0\tpackage-lock.json"),
  commit("a1", "Lauren Vu", "l@v.c", "Tweak colors", "", "", "4\t0\tsrc/y.js"),
  commit("a1", "Lauren Vu", "l@v.c", "chore: regenerate", "", "", "7\t0\tpackage-lock.json"),
].join("");

test("changeType: prefers the trailer, lowercased", async () => {
  const { changeType } = await load();
  assert.equal(changeType({ trailer: "Dependabot-Fix\x1eci", parents: 1, subject: "fix: x" }), "dependabot-fix");
});

test("changeType: labels an untagged merge commit as merge", async () => {
  const { changeType } = await load();
  assert.equal(changeType({ parents: 2, subject: "Merge main into dev" }), "merge");
});

test("changeType: falls back to the conventional-commit prefix, then unlabeled", async () => {
  const { changeType } = await load();
  assert.equal(changeType({ subject: "feat(ui)!: new grid" }), "feat");
  assert.equal(changeType({ subject: "Tweak colors" }), "unlabeled");
});

test("parseChanges: groups by type, splits Claude from the author, skips bots and excluded paths", async () => {
  const { parseChanges } = await load();
  assert.deepEqual(parseChanges(log, { exclude: ["package-lock.json"] }), [
    { type: "dependabot-fix", commits: 1, claude: 5, author: 0 },
    { type: "unlabeled", commits: 1, claude: 0, author: 4 },
    { type: "docs", commits: 1, claude: 0, author: 3 },
    { type: "merge-conflict", commits: 1, claude: 2, author: 0 },
  ]);
});

test("parseChanges: skips authors named in excludeAuthors", async () => {
  const { parseChanges } = await load();
  assert.deepEqual(parseChanges(log, { excludeAuthors: ["Lauren Vu"] }), []);
});

test("changesSince: reads merge commits through their conflict resolution only", async () => {
  const { changesSince } = await load();
  let seen;
  changesSince("/repo", "abc", {}, (args) => {
    seen = args;
    return "";
  });
  assert.ok(seen.includes("--diff-merges=remerge"));
  assert.ok(seen.includes("abc..HEAD"));
});

test("changesSection: renders one row per type and a placeholder when empty", async () => {
  const { changesSection } = await load();
  assert.ok(changesSection([{ type: "ci", commits: 2, claude: 1234, author: 0 }]).includes("| `ci` | 2 | 1,234 | 0 |"));
  assert.ok(changesSection([]).includes("| _none_ | 0 | 0 | 0 |"));
});

test("buildReport: places Changes by Type before the measurement scope", async () => {
  const { buildReport } = await load();
  const text = buildReport({
    config: { baselineCommit: "abcdef0123", baselineDate: "2026-10-01", exclude: [] },
    aiAdded: 1,
    totalAdded: 2,
    generatedAt: "now",
    changes: [{ type: "ci", commits: 1, claude: 1, author: 0 }],
  });
  const at = text.indexOf("## Changes by Type");
  assert.ok(at > 0 && at < text.indexOf("## Measurement Scope"));
});
