// eBay Σummer. Copyright (C) 2026 lvuCodes. Licensed under GPL-3.0-or-later; see LICENSE.md.
//
// DOM builders for the popup's feature components. The popup has no bundler, so
// a component's markup is built here rather than written into popup.html — that
// is what lets a package drop a feature's UI by omitting one <script> line, the
// same way it drops the feature's source.
//
// Only the popup loads this; the content-script bundle has no use for it.
(function () {
  "use strict";
  const ES = (globalThis.ES = globalThis.ES || {});

  // h("div", { class: "row" }, child, "text") -> Element. Children may be nodes,
  // strings, or nullish (skipped, so a caller can inline a conditional).
  function h(tag, props, ...children) {
    const node = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else node.setAttribute(k, v === true ? "" : String(v));
    });
    children.flat().forEach((c) => {
      if (c == null || c === false) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  // A labelled on/off switch. `id` is omitted for a switch that is pure UI state
  // (the select-all header) rather than a stored setting.
  function switchEl(id, label, variant, title) {
    return h(
      "label",
      { class: "switch" + (variant ? ` switch--${variant}` : ""), title },
      h("input", { type: "checkbox", id }),
      h("span", { class: "switch__slider" }),
      label ? h("span", { class: "switch__label", text: label }) : null
    );
  }

  // An ⓘ tooltip. The text is both the accessible name and the visible tip, so
  // callers pass it once.
  function infoEl(text) {
    return h(
      "span",
      { class: "info", tabindex: 0, role: "note", "aria-label": text },
      "ⓘ",
      h("span", { class: "info__tip", text })
    );
  }

  // A feature's section chrome: the header row (title + master toggle) and the
  // body its component fills. Returned separately because the two sit as
  // siblings in the column, not nested — the CSS grid depends on that.
  function sectionEl(id, title, masterId, masterTitle) {
    return {
      header: h(
        "div",
        { class: "group-header-row", id: `header-${id}` },
        h("p", { class: "group-header", text: title }),
        masterId ? switchEl(masterId, null, "header", masterTitle) : null
      ),
      body: h("div", { class: "group-body", id: `body-${id}` }),
    };
  }

  Object.assign(ES, { h, switchEl, infoEl, sectionEl });
})();
