// Pure calculation helpers for the landing-page demo widgets — a framework-free
// port of the extension's src/calculator/calc.js math. DOM-free and dependency-
// free, so demo-controller.js stays a thin DOM shell and this math is unit-tested
// under node:test (see demo-calc.test.js) exactly like the extension's own calc.

export function fmt(n) {
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function pctText(tax) {
  return (tax * 100).toFixed(2) + "%";
}

export function calcTotal(item, ship, tax) {
  const t = item * tax;
  return { tax: t, total: item + t + (ship || 0) };
}

export function shipLabel(ship) {
  return ship > 0 ? "+ $" + fmt(ship) + " ship" : ship === 0 ? "+ free ship" : "+ ship n/a";
}

export function clampCount(n) {
  const c = Math.floor(Number(n));
  return Number.isFinite(c) && c >= 1 ? c : 1;
}

// Recursive-descent evaluator for the =formula fields — arithmetic only, no
// eval(). Returns null on any malformed/unsafe input (illegal chars, no digit,
// div-by-zero, unbalanced parens, trailing junk).
export function evalExpr(expr) {
  const s = String(expr == null ? "" : expr);
  if (!/^[\d\s.+\-*/()]*$/.test(s)) return null;
  if (!/\d/.test(s)) return null;
  let i = 0;
  function skip() { while (i < s.length && s[i] === " ") i++; }
  function parseExpr() {
    let v = parseTerm(); if (v == null) return null;
    for (;;) {
      skip(); const c = s[i];
      if (c === "+" || c === "-") { i++; const r = parseTerm(); if (r == null) return null; v = c === "+" ? v + r : v - r; }
      else break;
    }
    return v;
  }
  function parseTerm() {
    let v = parseFactor(); if (v == null) return null;
    for (;;) {
      skip(); const c = s[i];
      if (c === "*" || c === "/") {
        i++; const r = parseFactor(); if (r == null) return null;
        if (c === "/") { if (r === 0) return null; v = v / r; } else v = v * r;
      }
      else break;
    }
    return v;
  }
  function parseFactor() {
    skip(); let sign = 1;
    while (s[i] === "+" || s[i] === "-") { if (s[i] === "-") sign = -sign; i++; skip(); }
    if (s[i] === "(") { i++; const v = parseExpr(); skip(); if (v == null || s[i] !== ")") return null; i++; return sign * v; }
    const start = i;
    while (i < s.length && /[\d.]/.test(s[i])) i++;
    if (i === start) return null;
    const num = parseFloat(s.slice(start, i));
    return Number.isFinite(num) ? sign * num : null;
  }
  const result = parseExpr(); skip();
  if (i !== s.length) return null;
  return result != null && Number.isFinite(result) ? result : null;
}

export function readInput(raw) {
  const s = String(raw == null ? "" : raw).trim();
  if (s === "") return { isFunction: false, value: null };
  if (s[0] === "=") return { isFunction: true, value: evalExpr(s.slice(1)) };
  const cleaned = s.replace(/[$,\s]/g, "");
  if (!/^\d*\.?\d+$/.test(cleaned)) return { isFunction: false, value: null };
  const n = parseFloat(cleaned);
  return { isFunction: false, value: Number.isFinite(n) ? n : null };
}
