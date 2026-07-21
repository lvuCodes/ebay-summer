// eBay Σummer. Copyright (C) 2026 lvuCodes. Licensed under GPL-3.0-or-later; see LICENSE.md.
//
// Auction-ending alert presets, synthesized via Web Audio (nothing bundled).
// Each note is [freqHz, startOffsetSec, durSec, waveTypeOverride?]. Shared by
// content.js (timer-fired) and the popup (on-demand preview). Coin is default.
(function () {
  "use strict";
  const ES = (globalThis.ES = globalThis.ES || {});

  const SOUNDS = {
    coin: { type: "square", gain: 0.18, notes: [[988, 0, 0.09], [1319, 0.08, 0.32]] },
    chime: { type: "sine", gain: 0.22, notes: [[784, 0, 0.5], [988, 0.06, 0.5], [1319, 0.12, 0.6]] },
    bell: { type: "sine", gain: 0.25, notes: [[1047, 0, 0.9], [1568, 0, 0.7]] },
    ding: { type: "sine", gain: 0.25, notes: [[1568, 0, 0.5]] },
    arcade: {
      type: "square",
      gain: 0.14,
      notes: [[660, 0, 0.07], [880, 0.07, 0.07], [1175, 0.14, 0.18]],
    },
  };
  const DEFAULT_SOUND = "coin";

  // The valid sound key or the default (used to sanitize stored/config values).
  function sanitizeSound(v) {
    return typeof v === "string" && SOUNDS[v] ? v : DEFAULT_SOUND;
  }

  // Schedule a preset on an existing (already-resumed) AudioContext. The caller
  // owns the ctx lifecycle (autoplay warm-up). Unknown ids fall back to the default.
  function playSound(ctx, id) {
    const preset = SOUNDS[id] || SOUNDS[DEFAULT_SOUND];
    const t0 = ctx.currentTime + 0.01;
    preset.notes.forEach(function (n) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = n[3] || preset.type;
      osc.frequency.value = n[0];
      const s = t0 + n[1];
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(preset.gain, s + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, s + n[2]);
      osc.connect(g).connect(ctx.destination);
      osc.start(s);
      osc.stop(s + n[2] + 0.02);
    });
  }

  Object.assign(ES, { SOUNDS, DEFAULT_SOUND, sanitizeSound, playSound });
})();
