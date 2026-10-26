# AI Usage

**99.7% AI, 0.3% human**, by lines added since the baseline commit.

| Measure | Lines added |
|---|---|
| **By Claude** | 595 |
| **By the author** | 2 |
| **Total since baseline** | 597 |

Baseline commit `3b0102a` (2026-10-05). Regenerate with `node scripts/ai-attribution.mjs`.

## Changes by Type

| Change type | Commits | By Claude | By the author |
|---|---|---|---|
| `unlabeled` | 3 | 272 | 2 |
| `feat` | 1 | 157 | 0 |
| `fix` | 2 | 139 | 0 |
| `ci` | 1 | 18 | 0 |
| `chore` | 1 | 8 | 0 |
| `test` | 1 | 1 | 0 |

## Measurement Scope

- The figures count **lines added since the baseline commit**, not lines currently surviving in the working tree. A line written once and rewritten twice is counted three times.
- Everything committed **before the baseline** is unattributed and appears in no column. Authorship there cannot be honestly reconstructed, so it is not guessed at.
- Claude's lines are the larger of two counts: edits the ledger recorded through **Claude Code's own editing tools**, and every line added by a commit carrying a `Co-Authored-By: Claude` trailer. Anything else counts as the author's.
- Change types come from each commit's `Change-Type:` trailer, otherwise its conventional-commit prefix (`fix`, `ci`, `docs`), otherwise `unlabeled`. A merge commit without a trailer is `merge`, and its lines are only those its conflict resolution added. Per-type lines follow the `Co-Authored-By: Claude` trailer alone, so their Claude total can differ from the headline, which also counts ledger edits.
- A line count is **not a claim about authorship of design or direction**. What to build, which generated output to keep, and what to reject are the author's, and none of it appears in a diff.
- Figures are computed from `.ai-attribution/ledger.jsonl` — an append-only record written as each edit lands — joined against `git log --numstat`. The ledger is committed as the evidence behind this report.

## Excluded Paths

- `package-lock.json`
- `pnpm-lock.yaml`
- `yarn.lock`
- `dist/**`
- `build/**`
- `vendor/**`
- `**/*.min.*`
- `AI-USAGE.md`
- `.ai-attribution/**`
- `docs/**`
- `releases/**`
- `site/coverage/**`
- `site/test-results/**`

_Generated 2026-10-26 16:19:10Z.
