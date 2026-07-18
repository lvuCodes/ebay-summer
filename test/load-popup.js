// Popup-component loader. Installs the fake DOM, then loads the popup seam and
// every feature's popup component in popup.html order into a fresh globalThis.ES.
// node --test gives each test file its own process, so this ES is isolated from
// load-es.js and load-dom.js.
const { makeDoc, installGlobals } = require("./fake-dom.js");

installGlobals();
global.document = makeDoc();
global.window = global.window || {};

const ES = (globalThis.ES = globalThis.ES || {});

require("../src/core/registry.js");
require("../src/core/popup-registry.js");
require("../src/core/popup-dom.js");
require("../src/core/sanitize.js");
require("../src/notifications/sounds.js");
require("../src/calculator/schema.js");
require("../src/notifications/schema.js");
require("../src/core/defaults.js");
require("../src/calculator/popup.js");
require("../src/notifications/popup.js");

module.exports = { ES, makeDoc };
