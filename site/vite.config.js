import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Builds the two static pages into ../docs (what GitHub Pages serves). base: "./"
// keeps asset URLs relative so the site works under the /ebay-summer/ Pages path.
export default defineConfig({
  base: "./",
  plugins: [react()],
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
