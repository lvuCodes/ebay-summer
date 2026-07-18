// The popup's feature seam, mirroring registerSettings/registerFeature in
// registry.js. A feature contributes its whole popup presence here — markup,
// controls, and wiring — so a build that omits the feature's <script> lines gets
// no orphaned markup, no dangling handler, and no control bound to a setting
// whose schema never registered.
//
// registerPopupSection({ id, title, master, masterTitle, column, render,
//                        controls, toggles, init })
//   id          section id; the chrome becomes #header-<id> / #body-<id>
//   title       the group header text
//   master      optional element id for the section's header on/off switch. Not
//               necessarily a stored setting — a select-all header is pure UI and
//               simply registers no matching `checks` entry.
//   masterTitle optional tooltip on that switch
//   column      1 or 2 — which popup column the section renders into
//   render(body)  fills the section body with the feature's controls
//   controls    { fields, checks, selects, texts, radios, collapses } — any
//               subset; popup.js merges these into the tables its load/save loop
//               walks
//   toggles     [{ control, sections }] reveal/hide rules, applied on change
//   init(ctx)   optional wiring the generic loop cannot express (a preview
//               button, a clear button, a dependent row).
//               ctx = { save, load, onLoaded(fn) } — onLoaded registers a hook to
//               run after each load() fills the controls, for state derived from
//               them (e.g. a select-all's indeterminate flag).
//
// Registration order is <script> order in popup.html, which fixes the order
// sections appear within their column.
(function () {
  "use strict";
  const ES = (globalThis.ES = globalThis.ES || {});

  const CONTROL_KINDS = ["fields", "checks", "selects", "texts", "radios", "collapses"];

  ES.popupSections = [];
  ES.registerPopupSection = function (section) {
    ES.popupSections.push(section);
  };

  // Flatten one control kind across every registered section, in order. popup.js
  // walks the result exactly as it walked the old hand-maintained tables, so a
  // section that never registered contributes nothing to load(), save(), or the
  // listener wiring — the property that makes a feature safely omissible.
  ES.collectPopupControls = function (kind) {
    if (!CONTROL_KINDS.includes(kind)) throw new Error(`unknown control kind "${kind}"`);
    return ES.popupSections.flatMap((s) => (s.controls && s.controls[kind]) || []);
  };

  ES.collectPopupToggles = function () {
    return ES.popupSections.flatMap((s) => s.toggles || []);
  };
})();
