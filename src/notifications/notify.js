// eBay Σummer. Copyright (C) 2026 lvuCodes. Licensed under GPL-3.0-or-later; see LICENSE.md.
//
// Auction-ending notifications — listing pages only (a single auction you're
// viewing; deliberately not the bids/search pages, which have many simultaneous
// countdowns and would fire a burst). Watches the page's countdown once a
// second, and when an enabled threshold is reached plays the chosen chime and
// messages the worker to raise a click-to-focus notification. Registered as the
// notifications feature's init hook — the core calls it once at startup.
(function () {
  "use strict";
  const ES = (globalThis.ES = globalThis.ES || {});
  const { config, playSound, parseTimeLeft, tickAlerts } = ES;

  // Coin chime, synthesized via Web Audio (no bundled file). The AudioContext
  // starts suspended until a user gesture, so we warm it up on the first click;
  // after that, timer-fired plays are allowed by the autoplay policy.
  let audioCtx = null;
  function getCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }
  function playAlert() {
    // Sound is an opt-out sub-toggle: the badge notification always fires, but
    // the accompanying chime can be silenced without disabling the alert.
    if (!config.notifySoundEnabled) return;
    let ctx;
    try {
      ctx = getCtx();
    } catch (e) {
      return;
    }
    // Only play when the context is already running. Before the user has
    // interacted with the page the context is suspended, and the autoplay policy
    // blocks playback and logs "AudioContext was not allowed to start" on every
    // resume() attempt. warmupAudio resumes it on the first pointerdown, so a
    // suspended context here just means "no gesture yet" — skip silently (the
    // visual notification still fires via the worker).
    if (ctx.state !== "running") return;
    // The chosen preset (coin by default), synthesized by the shared playSound.
    playSound(ctx, config.notifySound);
  }
  function warmupAudio() {
    try {
      const ctx = getCtx();
      if (ctx.state === "suspended") ctx.resume();
    } catch (e) {}
    window.removeEventListener("pointerdown", warmupAudio, true);
  }

  // The listing's item title, for the notification body.
  function titleFor() {
    const h = document.querySelector("h1 .ux-textspans, .x-item-title__mainTitle");
    return (h && h.textContent.trim()) || document.title;
  }

  // The listing's main photo URL, used as the notification icon (falls back to
  // the bundled icon in the worker if this is null or fails to load).
  function itemImageUrl() {
    const img =
      document.querySelector(".ux-image-carousel-item.active img") ||
      document.querySelector(".ux-image-carousel-item img") ||
      document.querySelector(".ux-image img");
    const url = img && (img.currentSrc || img.src);
    return /^https?:\/\//.test(url || "") ? url : null;
  }

  // Per-page alert state for the single auction (alerts.js's tickAlerts owns the
  // logic). `notified` dedups across the several `.ux-timer__text` mirrors a
  // listing renders (main area, sticky bid bar, …) — a fire is keyed by threshold,
  // not element. `armed`/`ended` drive the seed-suppression (don't retro-fire an
  // alert for a threshold the tab opened below) and the one-shot ending transition.
  // The page IS one auction, and a different listing is a full reload (fresh state).
  const state = { armed: false, ended: false, notified: new Set() };
  let intervalId = null;

  // Raise one "ending soon" badge for a reached threshold.
  function fireEndingSoon(T) {
    playAlert();
    try {
      chrome.runtime.sendMessage({
        type: "ending-soon",
        threshold: T,
        title: titleFor(),
        iconUrl: itemImageUrl(),
      });
    } catch (e) {}
  }

  // The auction ended: tell the worker to auto-dismiss this tab's outstanding
  // "ending soon" badges, and (if opted in) leave a persistent "ended" badge.
  function fireAuctionEnded() {
    try {
      chrome.runtime.sendMessage({
        type: "auction-ended",
        persistent: !!config.notifyEndedPersist,
        title: titleFor(),
        iconUrl: itemImageUrl(),
      });
    } catch (e) {}
  }

  function watchTick() {
    // Master off, or the Auction Ending Notification section toggled off.
    if (!config.enabled || !config.notifyEnabled) return;
    // Each alert has its own enable checkbox; tickAlerts (via pendingThresholds)
    // drops any that aren't > 0 and de-dupes equal ones.
    const thresholds = [];
    if (config.notifyEnabled1) thresholds.push(config.notifyAt1);
    if (config.notifyEnabled2) thresholds.push(config.notifyAt2);
    // The auction's remaining seconds: the smallest positive countdown across the
    // mirrored timer nodes (they should agree; min is defensive). null once the
    // countdown is gone — i.e. the listing has ended (see tickAlerts).
    let secs = null;
    document.querySelectorAll(".ux-timer__text").forEach(function (el) {
      const s = parseTimeLeft(el.textContent);
      if (s != null && s > 0 && (secs == null || s < secs)) secs = s;
    });
    const { fire, ended } = tickAlerts(secs, thresholds, state);
    fire.forEach(fireEndingSoon);
    if (ended) {
      // Nothing to dismiss and no persistent badge wanted → skip the message, but
      // still stop polling (the auction won't come back on this page).
      if (config.notifyEnabled1 || config.notifyEnabled2 || config.notifyEndedPersist) {
        fireAuctionEnded();
      }
      if (intervalId) clearInterval(intervalId);
    }
  }

  // Wire the audio warm-up + the once-a-second countdown watch. Listing pages
  // only — nothing to watch elsewhere, so don't even poll.
  function initAuctionAlerts(kind) {
    if (kind !== "listing") return;
    window.addEventListener("pointerdown", warmupAudio, true);
    intervalId = setInterval(watchTick, 1000);
  }

  // Auction-ending countdown watch + chime (listing pages only; no-op elsewhere).
  // Purely init-driven — nothing to render, clear, or re-run per pass: watchTick
  // reads the live config each second, so settings changes apply on the next tick.
  ES.registerFeature({ key: "notifications", init: initAuctionAlerts });

  Object.assign(ES, { initAuctionAlerts });
})();
