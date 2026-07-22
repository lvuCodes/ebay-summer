// eBay Σummer. Copyright (C) 2026 lvuCodes. Licensed under GPL-3.0-or-later; see LICENSE.md.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@lvucodes/ui/theme.css";
import Landing from "./pages/Landing.tsx";
import { validateReleases } from "./lib/releases.ts";
import releasesData from "./data/releases.json";
// Site stylesheets come LAST, after the page component import that transitively
// pulls in @lvucodes/ui's .pill primitive: equal-specificity, unlayered rules
// resolve by source order, so importing base.css after the package lets the
// site's own 999px purple .pill skin win. The extension's widget rules sit in
// @layer extension, so index.css overrides them regardless of order.
import "./styles/base.css";
import "virtual:extension-widget-css.css";
import "./styles/index.css";

// Fail loudly at bootstrap if the bundled releases data is malformed, rather than
// rendering a broken/half-empty page. The build embeds releases.json, so a bad
// shape is a build-time defect the site author should see immediately.
validateReleases(releasesData);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
);
