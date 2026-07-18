// Landing-page demo: wires a purple estimation box + orange bid calc given their
// root elements, and returns a teardown fn for React's useEffect cleanup. A thin
// DOM shell — all the math (evalExpr, calcTotal, per-unit, bidirectional
// bid<->total) lives, tested, in ../lib/demo-calc.js.
import { fmt, pctText, calcTotal, shipLabel, clampCount, readInput } from "../lib/demo-calc.js";

export function initDemo(box, calc) {
  if (!box || !calc) return () => {};

  const ITEM = parseFloat(box.dataset.item);
  const SHIP = parseFloat(box.dataset.ship);
  const TAX = parseFloat(box.dataset.tax);
  const hasShip = SHIP > 0;
  const pct = pctText(TAX);
  const listeners = [];
  const on = (el, ev, fn) => { el.addEventListener(ev, fn); listeners.push([el, ev, fn]); };

  let count = 1;
  let includeShip = true;
  let perUnitActive = false;
  const base = calcTotal(ITEM, SHIP, TAX);
  const totalNoShip = ITEM + base.tax;

  const amountEl = box.querySelector(".ebay-estimation__amount");
  const subEl = box.querySelector(".ebay-estimation__sub");
  const panel = box.querySelector(".ebay-estimation__panel");
  const toggle = box.querySelector(".ebay-estimation__toggle");
  const countEl = box.querySelector(".ebay-estimation__count");
  const perEl = box.querySelector(".ebay-estimation__perunit");
  const shipBtn = box.querySelector(".ebay-estimation__ship");

  amountEl.innerHTML = "US $" + fmt(base.total) +
    (SHIP === 0 ? ' <span class="ebay-estimation__flag">🟢</span>' : "");
  subEl.textContent = "US $" + fmt(ITEM) + " + (" + pct + " tax → $" + fmt(base.tax) + ") " + shipLabel(SHIP);

  function renderPanel() {
    const basis = includeShip ? base.total : totalNoShip;
    const note = hasShip ? (includeShip ? " (incl. ship)" : " (excl. ship)") : "";
    perEl.textContent = count + " @ $" + fmt(basis / count) + "/unit" + note;
  }
  function activate() { perUnitActive = true; renderBidPerUnit(); }
  function commitCount(n) {
    count = clampCount(n);
    countEl.value = String(count);
    renderPanel(); activate();
  }
  on(toggle, "click", function () {
    const willOpen = panel.hasAttribute("hidden");
    panel.toggleAttribute("hidden", !willOpen);
    toggle.textContent = willOpen ? "⏴" : "⏵";
    toggle.setAttribute("aria-expanded", String(willOpen));
    if (willOpen) { renderPanel(); activate(); }
  });
  on(countEl, "input", function () {
    count = clampCount(readInput(countEl.value).value);
    renderPanel(); activate();
  });
  on(countEl, "change", function () { commitCount(readInput(countEl.value).value); });
  on(countEl, "blur", function () { commitCount(readInput(countEl.value).value); });
  box.querySelectorAll(".ebay-estimation__step").forEach(function (btn) {
    on(btn, "click", function () {
      commitCount(clampCount(readInput(countEl.value).value) + Number(btn.getAttribute("data-step")));
    });
  });
  on(shipBtn, "click", function () {
    includeShip = !includeShip;
    shipBtn.setAttribute("aria-pressed", String(includeShip));
    renderPanel(); renderBidPerUnit();
  });
  renderPanel();

  const bidField = calc.querySelector(".ebay-bid-calc__field--bid");
  const totalFieldW = calc.querySelector(".ebay-bid-calc__field--total");
  const bidIn = calc.querySelector(".ebay-bid-calc__input");
  const totIn = calc.querySelector(".ebay-bid-calc__total");
  const calcEl = calc.querySelector(".ebay-bid-calc__calc");
  const totalCalcEl = calc.querySelector(".ebay-bid-calc__total-calc");
  const bidPerEl = calc.querySelector(".ebay-bid-calc__perunit");
  const bidSubEl = calc.querySelector(".ebay-bid-calc__sub");
  let lastTotal = null, lastTotalNoShip = null, lastValid = false;

  function syncDollar() {
    bidField.classList.toggle("ebay-bid-calc__field--formula", bidIn.value.trim()[0] === "=");
    totalFieldW.classList.toggle("ebay-bid-calc__field--formula", totIn.value.trim()[0] === "=");
  }
  function renderBidPerUnit() {
    if (lastValid && perUnitActive) {
      const basis = includeShip ? lastTotal : lastTotalNoShip;
      bidPerEl.textContent = "($" + fmt(basis / count) + "/unit)";
      bidPerEl.removeAttribute("hidden");
    } else bidPerEl.setAttribute("hidden", "");
  }
  function fromBid() {
    const r = readInput(bidIn.value);
    const typed = bidIn.value.trim() !== "";
    const valid = r.value != null && Number.isFinite(r.value) && r.value >= 0;
    if (r.isFunction && valid) { calcEl.textContent = "= $" + fmt(r.value); calcEl.removeAttribute("hidden"); }
    else calcEl.setAttribute("hidden", "");
    totalCalcEl.setAttribute("hidden", "");
    if (valid) {
      const c = calcTotal(r.value, SHIP, TAX);
      totIn.value = c.total.toFixed(2);
      lastTotal = c.total; lastTotalNoShip = r.value + c.tax; lastValid = true;
      bidSubEl.textContent = "incl. " + pct + " tax ($" + fmt(c.tax) + ") " + shipLabel(SHIP);
    } else {
      totIn.value = ""; lastValid = false;
      bidSubEl.textContent = "incl. " + pct + " tax " + shipLabel(SHIP);
    }
    bidIn.classList.toggle("ebay-bid-calc__field--invalid", typed && !valid);
    totIn.classList.remove("ebay-bid-calc__field--invalid");
    renderBidPerUnit(); syncDollar();
  }
  function fromTotal() {
    const r = readInput(totIn.value);
    const typed = totIn.value.trim() !== "";
    const valid = r.value != null && Number.isFinite(r.value) && r.value >= 0;
    const ship = SHIP || 0;
    const bid = valid ? (r.value - ship) / (1 + TAX) : null;
    const below = valid && bid < 0;
    calcEl.setAttribute("hidden", "");
    if (r.isFunction && valid) { totalCalcEl.textContent = "= $" + fmt(r.value); totalCalcEl.removeAttribute("hidden"); }
    else totalCalcEl.setAttribute("hidden", "");
    if (valid && !below) {
      bidIn.value = bid.toFixed(2);
      lastTotal = r.value; lastTotalNoShip = r.value - ship; lastValid = true;
      bidSubEl.textContent = "incl. " + pct + " tax ($" + fmt(bid * TAX) + ") " + shipLabel(SHIP);
    } else {
      bidIn.value = ""; lastValid = false;
      bidSubEl.textContent = below ? "target below $" + fmt(ship) + " shipping" : "incl. " + pct + " tax " + shipLabel(SHIP);
    }
    totIn.classList.toggle("ebay-bid-calc__field--invalid", typed && !valid);
    bidIn.classList.remove("ebay-bid-calc__field--invalid");
    renderBidPerUnit(); syncDollar();
  }
  on(bidIn, "input", fromBid);
  on(totIn, "input", fromTotal);
  on(calc.querySelector(".ebay-bid-calc__reset"), "click", function () {
    bidIn.value = ""; totIn.value = ""; fromBid(); bidIn.focus();
  });
  fromBid();

  return function teardown() {
    for (const [el, ev, fn] of listeners) el.removeEventListener(ev, fn);
  };
}
