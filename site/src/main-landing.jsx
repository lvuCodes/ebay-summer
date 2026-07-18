import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Landing from "./pages/Landing.jsx";
import { validateReleases } from "./lib/releases.js";
import releasesData from "./data/releases.json";
import "./styles/base.css";
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
