// Shared test loader: requires every DOM-free src module (in manifest load
// order) so globalThis.ES is fully populated, and exports it. The render
// modules only DEFINE functions at load (no top-level document access), so
// requiring them is safe — the DOM-free decision logic they export
// (listingUnavailable, …) is tested without a browser.
// early.js's DOM/localStorage side effects are guarded off when those globals
// are absent. box.js/bid-calc.js/notify.js/core/style.js/core/content.js are
// DOM-or-chrome modules with nothing DOM-free to test, so they aren't loaded.
require("../src/core/registry.js");
require("../src/core/sanitize.js");
require("../src/notifications/sounds.js");
require("../src/calculator/schema.js");
require("../src/notifications/schema.js");
require("../src/core/defaults.js");
require("../src/core/config.js");
require("../src/core/settings.js");
require("../src/calculator/calc.js");
require("../src/calculator/css-box.js");
require("../src/calculator/css-widgets.js");
require("../src/calculator/pickup.js");
// box.js only touches document inside makeBox, so it loads fine here — and it
// must load before the render modules, which destructure makeBox at load time.
require("../src/calculator/box.js");
require("../src/calculator/render-cards.js");
require("../src/calculator/render-listing.js");
require("../src/calculator/feature.js");
require("../src/notifications/alerts.js");
require("../src/core/early.js");

module.exports = globalThis.ES;
