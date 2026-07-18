// A compact, dependency-free fake DOM for exercising the extension's DOM-touching
// renderers under node:test (the project ships no jsdom). It implements only the
// subset of the DOM the src/ render modules actually use — element trees, a real
// CSS-selector engine (tag / .class / #id / [attr op val i] / :not / descendant /
// comma / universal), classList, dataset, style.setProperty, textContent, the
// insertion/removal methods, closest/matches/contains, and event
// listen+dispatch. Selector matching is genuine so the modules' idempotency
// guards ([data-ebay-total], .ebay-estimation--lg:not(--bin), …) behave as they
// do in a browser. globalThis.document is swapped per test via makeDoc().

// --- Selector engine -------------------------------------------------------

// Split a selector list on commas that are outside [] and ().
function splitGroups(sel) {
  return splitTop(sel, ",").map((s) => s.trim()).filter(Boolean);
}

// Split a compound/descendant selector on whitespace outside [] and ().
function splitCompounds(group) {
  const out = [];
  let buf = "";
  let depth = 0;
  for (let i = 0; i < group.length; i++) {
    const c = group[i];
    if (c === "[" || c === "(") depth++;
    else if (c === "]" || c === ")") depth--;
    if (/\s/.test(c) && depth === 0) {
      if (buf) out.push(buf), (buf = "");
    } else buf += c;
  }
  if (buf) out.push(buf);
  return out;
}

// Split `s` on `delim` at bracket/paren depth 0.
function splitTop(s, delim) {
  const out = [];
  let buf = "";
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "[" || c === "(") depth++;
    else if (c === "]" || c === ")") depth--;
    if (c === delim && depth === 0) out.push(buf), (buf = "");
    else buf += c;
  }
  out.push(buf);
  return out;
}

// Parse one compound selector ("a.foo[href*='x' i]:not(.bar)") into simple parts.
function parseCompound(compound) {
  const parts = [];
  let s = compound;
  while (s.length) {
    let m;
    if (s[0] === "*") {
      parts.push({ t: "universal" });
      s = s.slice(1);
    } else if ((m = s.match(/^#([\w-]+)/))) {
      parts.push({ t: "id", v: m[1] });
      s = s.slice(m[0].length);
    } else if ((m = s.match(/^\.([\w-]+)/))) {
      parts.push({ t: "class", v: m[1] });
      s = s.slice(m[0].length);
    } else if ((m = s.match(/^:not\(([^)]*)\)/))) {
      parts.push({ t: "not", v: parseCompound(m[1].trim()) });
      s = s.slice(m[0].length);
    } else if (
      (m = s.match(
        /^\[([\w-]+)(?:([~^*$|]?=)(?:"([^"]*)"|'([^']*)'|([^\]\s]+)))?(\s+i)?\]/
      ))
    ) {
      const val = m[3] != null ? m[3] : m[4] != null ? m[4] : m[5];
      parts.push({ t: "attr", name: m[1], op: m[2] || null, val, ci: !!m[6] });
      s = s.slice(m[0].length);
    } else if ((m = s.match(/^([a-zA-Z][\w-]*)/))) {
      parts.push({ t: "tag", v: m[1].toLowerCase() });
      s = s.slice(m[0].length);
    } else {
      throw new Error("fake-dom: unparseable selector fragment: " + s);
    }
  }
  return parts;
}

function matchAttr(el, part) {
  const actual = el.getAttribute(part.name);
  if (actual == null) return false;
  if (!part.op) return true;
  let a = actual;
  let v = part.val == null ? "" : part.val;
  if (part.ci) {
    a = a.toLowerCase();
    v = v.toLowerCase();
  }
  switch (part.op) {
    case "=":
      return a === v;
    case "^=":
      return a.startsWith(v);
    case "*=":
      return a.indexOf(v) !== -1;
    case "$=":
      return a.endsWith(v);
    case "~=":
      return a.split(/\s+/).indexOf(v) !== -1;
    default:
      return false;
  }
}

function matchCompound(el, parts) {
  if (el.nodeType !== 1) return false;
  for (const p of parts) {
    if (p.t === "universal") continue;
    else if (p.t === "tag") {
      if (el.tagName.toLowerCase() !== p.v) return false;
    } else if (p.t === "class") {
      if (!el.classList.contains(p.v)) return false;
    } else if (p.t === "id") {
      if (el.id !== p.v) return false;
    } else if (p.t === "attr") {
      if (!matchAttr(el, p)) return false;
    } else if (p.t === "not") {
      if (matchCompound(el, p.v)) return false;
    }
  }
  return true;
}

// A group is a list of compounds separated by descendant combinators. The
// rightmost is the subject; each earlier compound must match some ancestor.
function matchesGroup(el, compounds) {
  let i = compounds.length - 1;
  if (!matchCompound(el, compounds[i])) return false;
  i--;
  let cur = el.parentElement;
  while (i >= 0 && cur) {
    if (matchCompound(cur, compounds[i])) i--;
    cur = cur.parentElement;
  }
  return i < 0;
}

function parseSelector(sel) {
  return splitGroups(sel).map((g) => splitCompounds(g).map(parseCompound));
}

function matchesSelector(el, sel) {
  return parseSelector(sel).some((compounds) => matchesGroup(el, compounds));
}

// --- Nodes -----------------------------------------------------------------

class ClassList {
  constructor(el) {
    this._el = el;
  }
  _set() {
    return this._el._classSet;
  }
  contains(c) {
    return this._el._classSet.has(c);
  }
  add(...cs) {
    cs.forEach((c) => c && this._el._classSet.add(c));
  }
  remove(...cs) {
    cs.forEach((c) => this._el._classSet.delete(c));
  }
  toggle(c, force) {
    const has = this._el._classSet.has(c);
    const want = force === undefined ? !has : !!force;
    if (want) this._el._classSet.add(c);
    else this._el._classSet.delete(c);
    return want;
  }
}

class TextNode {
  constructor(text) {
    this.nodeType = 3;
    this.nodeValue = text == null ? "" : String(text);
    this.parentNode = null;
  }
  get parentElement() {
    return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null;
  }
  get textContent() {
    return this.nodeValue;
  }
  set textContent(v) {
    this.nodeValue = v == null ? "" : String(v);
  }
  replaceWith(node) {
    if (this.parentNode) this.parentNode.replaceChild(node, this);
  }
}

class Style {
  constructor() {
    this._props = {};
  }
  setProperty(name, value, priority) {
    this._props[name] = { value, priority: priority || "" };
  }
  getPropertyValue(name) {
    return this._props[name] ? this._props[name].value : "";
  }
}

class Element {
  constructor(tag) {
    this.nodeType = 1;
    this.tagName = String(tag).toUpperCase();
    this.childNodes = [];
    this.parentNode = null;
    this._classSet = new Set();
    this._attrs = {};
    this._listeners = {};
    this.style = new Style();
    this.classList = new ClassList(this);
    this._dataset = makeDataset(this);
    this._innerHTML = "";
  }

  // --- attributes / identity ---
  get className() {
    return [...this._classSet].join(" ");
  }
  set className(v) {
    this._classSet = new Set(String(v).split(/\s+/).filter(Boolean));
  }
  get id() {
    return this._attrs.id || "";
  }
  set id(v) {
    this._attrs.id = String(v);
  }
  get dataset() {
    return this._dataset;
  }
  getAttribute(name) {
    if (name === "class") return this._classSet.size ? this.className : null;
    return name in this._attrs ? this._attrs[name] : null;
  }
  setAttribute(name, value) {
    if (name === "class") this.className = value;
    else this._attrs[name] = String(value);
  }
  hasAttribute(name) {
    if (name === "class") return this._classSet.size > 0;
    return name in this._attrs;
  }
  removeAttribute(name) {
    delete this._attrs[name];
  }

  // --- tree navigation ---
  get children() {
    return this.childNodes.filter((n) => n.nodeType === 1);
  }
  get firstChild() {
    return this.childNodes[0] || null;
  }
  get firstElementChild() {
    return this.children[0] || null;
  }
  get parentElement() {
    return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null;
  }
  get nextSibling() {
    if (!this.parentNode) return null;
    const kids = this.parentNode.childNodes;
    return kids[kids.indexOf(this) + 1] || null;
  }

  // --- text ---
  get textContent() {
    return this.childNodes
      .map((n) => (n.nodeType === 3 ? n.nodeValue : n.textContent))
      .join("");
  }
  set textContent(v) {
    this.childNodes.forEach((n) => (n.parentNode = null));
    this.childNodes = [];
    if (v != null && v !== "") this.appendChild(new TextNode(v));
  }
  set innerHTML(html) {
    // Minimal: drop existing children; parse only the simple <tag …>…</tag> and
    // self-injected single-span markup the extension uses. Enough for coverage.
    this.childNodes.forEach((n) => (n.parentNode = null));
    this.childNodes = [];
    this._innerHTML = String(html);
    const m = String(html).match(/^<(\w+)([^>]*)>(.*?)<\/\1>$/);
    if (m) {
      const child = new Element(m[1]);
      const cls = m[2].match(/class="([^"]*)"/);
      if (cls) child.className = cls[1];
      if (m[3]) child.appendChild(new TextNode(m[3]));
      this.appendChild(child);
    }
  }
  get innerHTML() {
    return this._innerHTML;
  }

  // --- mutation ---
  appendChild(node) {
    if (node.nodeType === 11) {
      node.childNodes.slice().forEach((c) => this.appendChild(c));
      return node;
    }
    if (node.parentNode) node.parentNode.removeChild(node);
    node.parentNode = this;
    this.childNodes.push(node);
    return node;
  }
  insertBefore(node, ref) {
    if (ref == null) return this.appendChild(node);
    if (node.nodeType === 11) {
      node.childNodes.slice().forEach((c) => this.insertBefore(c, ref));
      return node;
    }
    if (node.parentNode) node.parentNode.removeChild(node);
    const idx = this.childNodes.indexOf(ref);
    node.parentNode = this;
    if (idx === -1) this.childNodes.push(node);
    else this.childNodes.splice(idx, 0, node);
    return node;
  }
  removeChild(node) {
    const idx = this.childNodes.indexOf(node);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      node.parentNode = null;
    }
    return node;
  }
  replaceChild(newNode, oldNode) {
    const idx = this.childNodes.indexOf(oldNode);
    if (idx === -1) return oldNode;
    if (newNode.nodeType === 11) {
      const kids = newNode.childNodes.slice();
      this.childNodes.splice(idx, 1);
      oldNode.parentNode = null;
      kids.forEach((c, k) => {
        if (c.parentNode) c.parentNode.removeChild(c);
        c.parentNode = this;
        this.childNodes.splice(idx + k, 0, c);
      });
      return oldNode;
    }
    if (newNode.parentNode) newNode.parentNode.removeChild(newNode);
    newNode.parentNode = this;
    this.childNodes.splice(idx, 1, oldNode === newNode ? newNode : newNode);
    oldNode.parentNode = null;
    return oldNode;
  }
  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }
  replaceWith(node) {
    if (this.parentNode) this.parentNode.replaceChild(node, this);
  }
  insertAdjacentElement(position, el) {
    if (position === "beforebegin") {
      if (this.parentNode) this.parentNode.insertBefore(el, this);
    } else if (position === "afterend") {
      if (this.parentNode) this.parentNode.insertBefore(el, this.nextSibling);
    } else if (position === "afterbegin") {
      this.insertBefore(el, this.firstChild);
    } else if (position === "beforeend") {
      this.appendChild(el);
    }
    return el;
  }

  // --- query ---
  _descendants(out) {
    for (const n of this.childNodes) {
      if (n.nodeType === 1) {
        out.push(n);
        n._descendants(out);
      }
    }
    return out;
  }
  querySelectorAll(sel) {
    const groups = parseSelector(sel);
    const all = this._descendants([]);
    return all.filter((el) => groups.some((cs) => matchesGroup(el, cs)));
  }
  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }
  matches(sel) {
    return matchesSelector(this, sel);
  }
  closest(sel) {
    let cur = this;
    while (cur && cur.nodeType === 1) {
      if (cur.matches(sel)) return cur;
      cur = cur.parentElement;
    }
    return null;
  }
  contains(node) {
    let cur = node;
    while (cur) {
      if (cur === this) return true;
      cur = cur.parentNode;
    }
    return false;
  }

  // --- events ---
  addEventListener(type, fn) {
    (this._listeners[type] = this._listeners[type] || []).push(fn);
  }
  removeEventListener(type, fn) {
    const list = this._listeners[type];
    if (list) this._listeners[type] = list.filter((f) => f !== fn);
  }
  dispatch(type) {
    const ev = {
      type,
      preventDefault() {},
      stopPropagation() {},
      target: this,
    };
    (this._listeners[type] || []).forEach((fn) => fn.call(this, ev));
    return ev;
  }
}

function makeDataset(el) {
  return new Proxy(
    {},
    {
      get(_t, prop) {
        const attr = "data-" + String(prop).replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
        const v = el.getAttribute(attr);
        return v == null ? undefined : v;
      },
      set(_t, prop, value) {
        const attr = "data-" + String(prop).replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
        el.setAttribute(attr, value);
        return true;
      },
      has(_t, prop) {
        const attr = "data-" + String(prop).replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
        return el.hasAttribute(attr);
      },
    }
  );
}

class DocumentFragment {
  constructor() {
    this.nodeType = 11;
    this.childNodes = [];
    this.parentNode = null;
  }
  appendChild(node) {
    if (node.parentNode) node.parentNode.removeChild(node);
    node.parentNode = this;
    this.childNodes.push(node);
    return node;
  }
  removeChild(node) {
    const idx = this.childNodes.indexOf(node);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      node.parentNode = null;
    }
    return node;
  }
}

class FakeDocument {
  constructor() {
    this.nodeType = 9;
    this.documentElement = new Element("html");
    this.documentElement.parentNode = this;
    this.body = new Element("body");
    this.documentElement.appendChild(this.body);
    this.head = new Element("head");
    this.documentElement.insertBefore(this.head, this.body);
  }
  createElement(tag) {
    return new Element(tag);
  }
  createTextNode(text) {
    return new TextNode(text);
  }
  createDocumentFragment() {
    return new DocumentFragment();
  }
  _root() {
    return this.documentElement;
  }
  querySelectorAll(sel) {
    const groups = parseSelector(sel);
    const all = [this.documentElement, ...this.documentElement._descendants([])];
    return all.filter((el) => groups.some((cs) => matchesGroup(el, cs)));
  }
  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }
  getElementById(id) {
    return this.querySelector("#" + id) || null;
  }
  contains(node) {
    return this.documentElement.contains(node);
  }
}

// --- helpers ---------------------------------------------------------------

// Build a small element with optional { class, id, attrs, text, html, children }.
function el(tag, opts = {}) {
  const e = new Element(tag);
  if (opts.class) e.className = opts.class;
  if (opts.id) e.id = opts.id;
  if (opts.attrs) Object.keys(opts.attrs).forEach((k) => e.setAttribute(k, opts.attrs[k]));
  if (opts.text != null) e.textContent = opts.text;
  if (opts.html != null) e.innerHTML = opts.html;
  (opts.children || []).forEach((c) => e.appendChild(c));
  return e;
}

function makeDoc() {
  return new FakeDocument();
}

// A minimal MutationObserver whose observe/disconnect are inert; trigger() fires
// the recorded callback so the render observer path can be exercised.
class FakeMutationObserver {
  constructor(cb) {
    this._cb = cb;
    FakeMutationObserver.instances.push(this);
  }
  observe() {
    this._observing = true;
  }
  disconnect() {
    this._observing = false;
    this._disconnected = true;
  }
  trigger() {
    this._cb([], this);
  }
}
FakeMutationObserver.instances = [];

// Install the window-level globals the render modules read at call time.
function installGlobals() {
  globalThis.MutationObserver = FakeMutationObserver;
  globalThis.requestAnimationFrame = (fn) => {
    fn();
    return 1;
  };
}

module.exports = {
  Element,
  TextNode,
  FakeDocument,
  FakeMutationObserver,
  makeDoc,
  el,
  installGlobals,
  matchesSelector,
  parseSelector,
};
