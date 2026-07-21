// eBay Σummer. Copyright (C) 2026 lvuCodes. Licensed under GPL-3.0-or-later; see LICENSE.md.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Landing from "./pages/Landing.jsx";
import { validateReleases } from "./lib/releases.js";
import releasesData from "./data/releases.json";
import "./styles/base.css";
// The extension's own widget rules, extracted at build time. Imported BEFORE
// index.css only for readability — it sits in @layer extension, so index.css
// overrides it on cascade layer regardless of order.
import "virtual:extension-widget-css.css";
import "./styles/index.css";

// Fail loudly at bootstrap if the bundled releases data is malformed, rather than
// rendering a broken/half-empty page. The build embeds releases.json, so a bad
// shape is a build-time defect the site author should see immediately.
validateReleases(releasesData);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
);
