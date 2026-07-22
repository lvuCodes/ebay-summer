// eBay Σummer. Copyright (C) 2026 lvuCodes. Licensed under GPL-3.0-or-later; see LICENSE.md.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Changelog from "./pages/Changelog.tsx";
import { validateReleases } from "./lib/releases.ts";
import releasesData from "./data/releases.json";
// Site stylesheets come LAST, after the page component import that transitively
// pulls in @lvucodes/ui's .pill primitive, so the site's own 999px purple .pill
// skin wins on source order (see main-landing.tsx).
import "./styles/base.css";
import "./styles/changelog.css";

// Fail loudly at bootstrap if the bundled releases data is malformed, rather than
// rendering a broken/half-empty page. The build embeds releases.json, so a bad
// shape is a build-time defect the site author should see immediately.
validateReleases(releasesData);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Changelog />
  </StrictMode>,
);
