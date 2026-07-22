import { defineConfig } from "@playwright/test";

// The site builds to ../docs (what GitHub Pages serves), and `vite preview`
// serves that build.outDir at the root — so the smoke suite runs against the
// real production output, index.html at "/".
export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://127.0.0.1:4173" },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});
