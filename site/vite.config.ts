import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { resolve } from "node:path";
import { loadWidgetCss } from "./src/lib/extension-css.ts";

// Serves the extension's widget CSS as a virtual stylesheet. Doing the extract
// here rather than in browser code keeps the raw CSS strings (and the eBay-only
// rules filtered out of them) from ever reaching the JS bundle, and lets Vite
// emit the result as a real .css asset so it loads before first paint.
const VIRTUAL_ID = "virtual:extension-widget-css.css";

function extensionWidgetCss(): Plugin {
  return {
    name: "extension-widget-css",
    resolveId: (id) => (id === VIRTUAL_ID ? `\0${VIRTUAL_ID}` : null),
    load: (id) => (id === `\0${VIRTUAL_ID}` ? loadWidgetCss() : null),
  };
}

// Builds the two static pages into ../docs (what GitHub Pages serves). base: "./"
// keeps asset URLs relative so the site works under the /ebay-summer/ Pages path.
export default defineConfig({
  base: "./",
  plugins: [react(), extensionWidgetCss()],
  // The demo's math is the extension's own (src/lib/extension-calc.ts imports
  // ../../../src/calculator/calc.js), which sits outside this root — the dev
  // server refuses to serve it without an explicit allowance. Scoped to that one
  // directory, NOT the repo root: a root-wide allowance would also serve .git/
  // and the multi-MB logged-in eBay captures in debug/. The production build
  // inlines the import and is unaffected either way.
  server: {
    fs: { allow: [resolve(import.meta.dirname, "../src/calculator"), import.meta.dirname] },
  },
  build: {
    outDir: resolve(import.meta.dirname, "../docs"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        changelog: resolve(import.meta.dirname, "changelog.html"),
      },
    },
  },
  test: {
    // Unit tests only — e2e/ belongs to Playwright.
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
    // Inline the package so Vite transforms its bundled CSS imports; left
    // externalized, Node's ESM loader chokes on `@lvucodes/ui`'s `.css` side effects.
    server: { deps: { inline: ["@lvucodes/ui"] } },
    coverage: {
      provider: "v8",
      // The site's own logic, matching what node:test measured before the
      // migration: the extension bridges, the changelog helpers, and the demo
      // controller. The React view components and entry modules render rather
      // than compute, and were never in the coverage set.
      include: [
        "src/components/demo-controller.ts",
        "src/lib/extension-calc.ts",
        "src/lib/extension-css.ts",
        "src/lib/inline.ts",
        "src/lib/releases.ts",
        "src/lib/site.ts",
      ],
      reporter: ["text", "html"],
      thresholds: { statements: 98, branches: 94, functions: 95, lines: 98 },
    },
  },
});
