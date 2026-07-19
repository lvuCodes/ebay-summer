import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { loadWidgetCss } from "./src/lib/extension-css.js";

// Serves the extension's widget CSS as a virtual stylesheet. Doing the extract
// here rather than in browser code keeps the raw CSS strings (and the eBay-only
// rules filtered out of them) from ever reaching the JS bundle, and lets Vite
// emit the result as a real .css asset so it loads before first paint.
const VIRTUAL_ID = "virtual:extension-widget-css.css";

function extensionWidgetCss() {
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
  // The demo's math is the extension's own (src/lib/extension-calc.js imports
  // ../../../src/calculator/calc.js), which sits outside this root — the dev
  // server refuses to serve it without an explicit allowance. Scoped to that one
  // directory, NOT the repo root: a root-wide allowance would also serve .git/
  // and the multi-MB logged-in eBay captures in debug/. The production build
  // inlines the import and is unaffected either way.
  server: { fs: { allow: [resolve(__dirname, "../src/calculator"), __dirname] } },
  build: {
    outDir: resolve(__dirname, "../docs"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        changelog: resolve(__dirname, "changelog.html"),
      },
    },
  },
});
