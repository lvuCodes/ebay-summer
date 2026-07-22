import { test, expect } from "vitest";
import landingSource from "../src/main-landing.tsx?raw";
import changelogSource from "../src/main-changelog.tsx?raw";
import pkg from "../package.json";

// Regression guard for the shared-pill cascade. The site keeps its own 999px bold
// purple .pill skin, but importing a page component transitively loads
// @lvucodes/ui's 6px .pill primitive as a side effect. Equal-specificity,
// unlayered rules resolve by source order, so the site stylesheets MUST be
// imported after the page component in each entry for the site skin to win —
// swap the order and the back link silently reverts to the package's pill.
const ENTRIES: [string, string, string, string][] = [
  ["landing", landingSource, "./pages/Landing.tsx", "./styles/index.css"],
  ["changelog", changelogSource, "./pages/Changelog.tsx", "./styles/changelog.css"],
];

for (const [name, source, pageImport, lastCss] of ENTRIES) {
  test(`${name} entry imports site styles after the page component`, () => {
    const themeIdx = source.indexOf('"@lvucodes/ui/theme.css"');
    const pageIdx = source.indexOf(pageImport);
    const baseIdx = source.indexOf('"./styles/base.css"');
    expect(themeIdx).toBeGreaterThanOrEqual(0);
    expect(pageIdx).toBeGreaterThan(themeIdx);
    expect(baseIdx).toBeGreaterThan(pageIdx);

    // The site's own stylesheet is the final import statement in the entry.
    const imports = [...source.matchAll(/^import\s.*$/gm)].map((m) => m[0]);
    expect(imports.at(-1)).toContain(lastCss);
  });
}

test("the site keeps the sideEffects allowlist that preserves CSS imports", () => {
  expect(pkg.sideEffects).toContain("**/*.css");
});
