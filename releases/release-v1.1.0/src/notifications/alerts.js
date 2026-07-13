// Pure auction-alert logic: the countdown parser and the threshold/ending
// state machine behind notify.js's once-a-second watch. No DOM, no config —
// every function takes its inputs as arguments, so the whole module is
// trivially testable.
(function () {
  "use strict";
  const ES = (globalThis.ES = globalThis.ES || {});

  // Parse an eBay countdown into whole seconds remaining. Handles every on-page
  // format: listing "Ends in 55m 0s", bids "2m 28s left", search "Time left 45s",
  // plus "2h 4m left" / "1d 3h left" / bare "45s". Returns null when no time is
  // present (e.g. an ended row or a Buy-It-Now card with no countdown).
  function parseTimeLeft(text) {
    if (!text) return null;
    const t = String(text).toLowerCase();
    if (!/\d/.test(t)) return null;
    const unit = (re) => {
      const m = t.match(re);
      return m ? parseInt(m[1], 10) : 0;
    };
    const d = unit(/(\d+)\s*d\b/);
    const h = unit(/(\d+)\s*h\b/);
    const m = unit(/(\d+)\s*m\b/);
    const s = unit(/(\d+)\s*s\b/);
    if (!d && !h && !m && !s) return null; // digits present but no time unit
    return d * 86400 + h * 3600 + m * 60 + s;
  }

  // Which of `thresholds` (seconds-left marks) should fire an alert now: those the
  // auction's remaining `secs` has reached (secs <= T) that haven't fired yet
  // (`fired` is a Set the caller updates). Dedup is keyed by the THRESHOLD, not by
  // the timer element — a listing mirrors its one countdown across several
  // `.ux-timer__text` nodes (main area, sticky bid bar, …), so element-keyed
  // tracking fired a duplicate notification per mirror; this collapses them to one
  // per threshold. Drops non-positive thresholds and de-dupes equal ones. Pure.
  function pendingThresholds(secs, thresholds, fired) {
    if (secs == null || secs <= 0) return [];
    const out = [];
    const seen = new Set();
    thresholds.forEach((T) => {
      if (T > 0 && secs <= T && !fired.has(T) && !seen.has(T)) {
        seen.add(T);
        out.push(T);
      }
    });
    return out;
  }

  // Advance the auction-alert state machine one tick, given the auction's current
  // remaining `secs` (null once the countdown is gone / the listing has ended) and
  // the enabled `thresholds`. `state` is caller-owned: { armed, ended, notified }
  // (notified is a Set of thresholds already handled). Returns
  // { fire: [thresholds to alert now], ended: <true only on the ending transition> }.
  //
  // Two behaviours beyond raw pendingThresholds:
  //  • Arming: the FIRST tick that sees a live countdown pre-marks every threshold
  //    the countdown is ALREADY past (secs <= T) as handled, WITHOUT firing — so a
  //    tab opened at 45s doesn't retro-fire the 60s alert; only a threshold we watch
  //    the countdown genuinely cross (e.g. 30s) fires.
  //  • End detection: once armed, the first tick with no live countdown flags the
  //    ending transition exactly once (auto-dismiss + optional persistent badge).
  // Pure aside from mutating the passed-in `state` (which the caller owns).
  function tickAlerts(secs, thresholds, state) {
    if (secs != null && secs > 0) {
      if (!state.armed) {
        state.armed = true;
        // Seed-suppress the already-passed thresholds; no alert on the arm tick.
        pendingThresholds(secs, thresholds, state.notified).forEach((T) => state.notified.add(T));
        return { fire: [], ended: false };
      }
      const fire = pendingThresholds(secs, thresholds, state.notified);
      fire.forEach((T) => state.notified.add(T));
      return { fire, ended: false };
    }
    // No live countdown. If we'd previously seen one, the auction just ended.
    if (state.armed && !state.ended) {
      state.ended = true;
      return { fire: [], ended: true };
    }
    return { fire: [], ended: false };
  }

  Object.assign(ES, { parseTimeLeft, pendingThresholds, tickAlerts });
})();
