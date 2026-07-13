// Auction-ending notifications — persisted-settings schema. Loaded (after
// sounds.js, which supplies sanitizeSound, and before core/defaults.js) in
// both the content-script bundle and popup.html.
(function () {
  "use strict";
  const ES = (globalThis.ES = globalThis.ES || {});
  const { sanitizeNonNeg, sanitizeSound } = ES;

  const defaults = {
    // Section master. On by default, but both threshold alerts default off, so
    // the feature ships in a no-op resting state until the user opts one in.
    notifyEnabled: true,

    // Auction-ending notification: two "seconds left" thresholds that each fire the
    // alert chime + a click-to-focus notification once. Each has its own enable.
    notifyEnabled1: false,
    notifyEnabled2: false,
    notifyAt1: 60,
    notifyAt2: 30,
    // Which alert sound to play (a key of SOUNDS in sounds.js); coin by default.
    notifySound: "coin",
    // The badge notification always fires when a threshold is reached; this only
    // gates the accompanying alert chime. Off by default — the badge is silent
    // until the user opts the sound in.
    notifySoundEnabled: false,
    // When the auction ends, the outstanding "ending soon" badges are always
    // auto-dismissed (the countdown is over). This opt-in additionally leaves one
    // persistent "auction ended" badge in their place. Off by default.
    notifyEndedPersist: false,
  };

  const sanitizers = {
    notifyAt1: (v) => Math.floor(sanitizeNonNeg(v, defaults.notifyAt1)),
    notifyAt2: (v) => Math.floor(sanitizeNonNeg(v, defaults.notifyAt2)),
    notifySound: (v) => sanitizeSound(v),
  };

  ES.registerSettings({ defaults, sanitizers });
})();
