// eBay Σummer. Copyright (C) 2026 lvuCodes. Licensed under GPL-3.0-or-later; see LICENSE.md.
//
// Cross-widget live-refresh glue shared by the estimation box (box.js) and the
// bid calculator (bid-calc.js): the in-place re-render registry (refreshLive)
// and the shared per-unit state for the ONE item you're bidding on. No DOM
// building here — just state + callbacks.
(function () {
  "use strict";
  const ES = (globalThis.ES = globalThis.ES || {});
  const { clampCount } = ES; // from calc.js (loads first) — used by perUnit.set below

  // The one lifetime mechanism for both registries below: a `{ el, fn }` list
  // where `el` owns its entry's lifetime. Reverse-iterate, drop any entry whose
  // element has detached (a settings-driven clear+rebuild), and run `invoke` on
  // each survivor. So detached entries can never pile up — whether we're merely
  // registering, refreshing on a live-only change, or notifying a per-unit edit.
  function sweepAndRun(list, invoke) {
    for (let i = list.length - 1; i >= 0; i--) {
      if (!list[i].el.isConnected) {
        list.splice(i, 1);
        continue;
      }
      if (invoke) invoke(list[i]);
    }
  }

  // In-place live-refresh registry. Each open per-unit panel and each bid
  // calculator registers a re-render callback keyed by its element. refreshLive()
  // (called by content.js for a live-only settings change) re-runs them so the
  // per-unit lines pick up the new basis WITHOUT rebuilding — an expanded panel
  // stays expanded. Detached entries (from a full rebuild) are pruned on refresh
  // and on every registration, so the list can't grow across ordinary edits.
  const liveRenderers = [];
  function registerLive(el, fn) {
    sweepAndRun(liveRenderers); // prune detached before adding (no invoke)
    liveRenderers.push({ el, fn });
  }
  function refreshLive() {
    sweepAndRun(liveRenderers, (e) => e.fn());
  }

  // Shared per-unit state, scoped to the ONE item you're bidding on: the MAIN
  // listing box's per-unit panel writes the count, active flag, and shipping-inclusion
  // here, and the orange bid calculator subscribes so its "$X.XX/unit" line tracks the
  // same values. Compact card panels are independent (they keep their own local
  // count + shipping-inclusion) so toggling one card never affects the others.
  // Private to this module — cross-widget glue, not a calculation.
  const perUnit = {
    count: 1,
    active: false, // true once the user opens/uses the per-unit panel
    includeShip: true, // shipping-inclusion for the main item (seeded from config)
    _subs: [], // { el, fn } — el owns the subscription's lifetime
    // Subscribe a callback tied to `el`; the entry is dropped automatically once
    // `el` detaches (a settings-driven rebuild), so subscriptions can't pile up
    // across the many bid-calc rebuilds a session accrues.
    subscribe(el, fn) {
      this._subs.push({ el, fn });
      return fn;
    },
    _notify() {
      sweepAndRun(this._subs, (e) => e.fn(this.count, this.active));
    },
    set(count, active) {
      this.count = clampCount(count);
      if (active != null) this.active = !!active;
      this._notify();
    },
    setIncludeShip(v) {
      this.includeShip = !!v;
      this._notify();
    },
  };

  Object.assign(ES, { registerLive, refreshLive, perUnit });
})();
