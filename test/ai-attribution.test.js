const { test } = require("node:test");
const assert = require("node:assert/strict");

const load = () => import("../scripts/ai-attribution.mjs");

const log = [
  "\0author Lauren Vu",
  "",
  "10\t2\tsrc/app.js",
  "\0author dependabot[bot]",
  "",
  "40\t30\tsite/package-lock.json",
  "1\t1\tsite/package.json",
  "\0author Lauren Vu",
  "",
  "3\t0\tsrc/other.js",
].join("\n");

test("withoutAuthors: drops the numstat of commits by an excluded author", async () => {
  const { withoutAuthors, parseNumstat } = await load();
  assert.equal(parseNumstat(withoutAuthors(log, ["dependabot[bot]"])), 13);
});

test("withoutAuthors: keeps every commit when no author is excluded", async () => {
  const { withoutAuthors, parseNumstat } = await load();
  assert.equal(parseNumstat(withoutAuthors(log)), 54);
});

test("parseNumstat: excludes paths matching the patterns", async () => {
  const { parseNumstat } = await load();
  assert.equal(parseNumstat("5\t0\tsrc/a.js\n7\t0\tpackage-lock.json", ["package-lock.json"]), 5);
});

test("attributableAdded: skips entries made against a commit outside the baseline", async () => {
  const { attributableAdded } = await load();
  const entries = [
    { file: "src/a.js", added: 4, head: "old" },
    { file: "src/b.js", added: 6, head: "new" },
    { file: "dist/c.js", added: 9 },
    { file: "src/d.js", added: 2, head: "gone" },
  ];
  const isAncestor = (_, head) => ({ old: false, new: true, gone: null })[head];
  assert.equal(attributableAdded(entries, { baseline: "b", exclude: ["dist/**"], isAncestor }), 8);
});

test("buildReport: caps Claude's share at the net total", async () => {
  const { buildReport, withoutTimestamp, percent } = await load();
  const config = { baselineCommit: "abcdef1234", baselineDate: "2026-10-05", exclude: ["dist/**"] };
  const text = buildReport({ config, aiAdded: 12, totalAdded: 10, generatedAt: "now" });
  assert.match(text, /\*\*100% AI, 0% human\*\*/);
  assert.match(text, /capped at 100%/);
  assert.doesNotMatch(withoutTimestamp(text), /_Generated /);
  assert.match(buildReport({ config, aiAdded: 0, totalAdded: 0, generatedAt: "now" }), /no attributed changes/);
  assert.equal(percent(1, 3), 33.3);
});

test("main: excluded authors leave the report current", async () => {
  const { main } = await load();
  const { mkdtempSync, writeFileSync, mkdirSync, rmSync } = require("node:fs");
  const { execFileSync } = require("node:child_process");
  const { join } = require("node:path");
  const root = mkdtempSync(join(require("node:os").tmpdir(), "ai-attr-"));
  const git = (args, name = "Lauren Vu") =>
    execFileSync("git", ["-C", root, "-c", `user.name=${name}`, "-c", "user.email=a@b.c", ...args], { encoding: "utf8" });
  const commit = (file, lines, name) => {
    if (lines !== null) writeFileSync(join(root, file), "x\n".repeat(lines));
    git(["add", "-A"]);
    git(["commit", "-qm", file], name);
  };
  try {
    git(["init", "-q"]);
    commit("base.js", 1);
    const baseline = git(["rev-parse", "HEAD"]).trim();
    mkdirSync(join(root, ".ai-attribution"));
    writeFileSync(
      join(root, ".ai-attribution", "config.json"),
      JSON.stringify({ baselineCommit: baseline, baselineDate: "2026-10-05", report: "AI-USAGE.md", excludeAuthors: ["dependabot[bot]"], exclude: [".ai-attribution/**"] }),
    );
    commit("app.js", 4);
    const head = git(["rev-parse", "HEAD"]).trim();
    writeFileSync(
      join(root, ".ai-attribution", "ledger.jsonl"),
      [
        JSON.stringify({ file: "app.js", added: 2, head }),
        JSON.stringify({ file: "app.js", added: 1, head: "0".repeat(40) }),
        "{torn",
      ].join("\n"),
    );
    writeFileSync(join(root, "img.bin"), "a\0b");
    git(["add", ".ai-attribution", "img.bin"]);
    git(["commit", "-qm", "ledger"]);
    assert.equal(main([], root), 0);
    commit("AI-USAGE.md", null);
    assert.equal(main(["--check"], root), 0);
    commit("lock.json", 50, "dependabot[bot]");
    assert.equal(main(["--check"], root), 0);
    writeFileSync(join(root, "human.js"), "y\n");
    writeFileSync(join(root, "blob.bin"), "a\0b");
    assert.equal(main(["--check"], root), 1);
    writeFileSync(
      join(root, ".ai-attribution", "config.json"),
      JSON.stringify({ baselineCommit: baseline, report: "AI-USAGE.md", prose: { paths: ["posts/**"] } }),
    );
    assert.throws(() => main([], root), /prose\.paths is set/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("globToRe: ** crosses directories, * and ? stay within one", async () => {
  const { globToRe, isExcluded } = await load();
  assert.ok(globToRe("**/package-lock.json").test("site/package-lock.json"));
  assert.ok(globToRe("**/package-lock.json").test("package-lock.json"));
  assert.ok(globToRe("dist/**").test("dist/a/b.js"));
  assert.ok(!globToRe("*.js").test("a/b.js"));
  assert.ok(globToRe("a?.js").test("ab.js"));
  assert.ok(!isExcluded("src/a.js"));
});
