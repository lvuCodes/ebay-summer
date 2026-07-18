import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Builds the two static pages into ../docs (what GitHub Pages serves). base: "./"
// keeps asset URLs relative so the site works under the /ebay-summer/ Pages path.
export default defineConfig({
  base: "./",
  plugins: [react()],
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
