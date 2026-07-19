// Landing-page demo: wires a purple estimation box + orange bid calc given their
// root elements, and returns a teardown fn for React's useEffect cleanup. A thin
// DOM shell — all the math (evalExpr, calcTotal, per-unit, bidirectional
// bid<->total) is the extension's own, bridged in via ../lib/extension-calc.js.
import {
  fmtMoney,
  pctText,
  calcTotal,
  shipLabel,
  clampCount,
  bidCalcInput,
  bidCalcParts,
  bidFromTotalParts,
} from "../lib/extension-calc.js";

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

  amountEl.innerHTML = "US $" + fmtMoney(base.total) +
    (SHIP === 0 ? ' <span class="ebay-estimation__flag">🟢</span>' : "");
  subEl.textContent = "US $" + fmtMoney(ITEM) + " + (" + pct + " tax → $" + fmtMoney(base.tax) + ") " + shipLabel(SHIP);

  function renderPanel() {
    const basis = includeShip ? base.total : totalNoShip;
    const note = hasShip ? (includeShip ? " (incl. ship)" : " (excl. ship)") : "";
    perEl.textContent = count + " @ $" + fmtMoney(basis / count) + "/unit" + note;
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
    count = clampCount(bidCalcInput(countEl.value).value);
    renderPanel(); activate();
  });
  on(countEl, "change", function () { commitCount(bidCalcInput(countEl.value).value); });
  on(countEl, "blur", function () { commitCount(bidCalcInput(countEl.value).value); });
  box.querySelectorAll(".ebay-estimation__step").forEach(function (btn) {
    on(btn, "click", function () {
      commitCount(clampCount(bidCalcInput(countEl.value).value) + Number(btn.getAttribute("data-step")));
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
      bidPerEl.textContent = "($" + fmtMoney(basis / count) + "/unit)";
      bidPerEl.removeAttribute("hidden");
    } else bidPerEl.setAttribute("hidden", "");
  }
  function fromBid() {
    const p = bidCalcParts(bidIn.value, SHIP, TAX);
    const typed = bidIn.value.trim() !== "";
    if (p.isFunction && p.valid) { calcEl.textContent = "= " + p.calcText; calcEl.removeAttribute("hidden"); }
    else calcEl.setAttribute("hidden", "");
    totalCalcEl.setAttribute("hidden", "");
    if (p.valid) {
      totIn.value = p.total.toFixed(2);
      lastTotal = p.total; lastTotalNoShip = p.totalNoShip; lastValid = true;
    } else {
      totIn.value = ""; lastValid = false;
    }
    bidSubEl.textContent = p.sub;
    bidIn.classList.toggle("ebay-bid-calc__field--invalid", typed && !p.valid);
    totIn.classList.remove("ebay-bid-calc__field--invalid");
    renderBidPerUnit(); syncDollar();
  }
  function fromTotal() {
    const p = bidFromTotalParts(totIn.value, SHIP, TAX);
    const typed = totIn.value.trim() !== "";
    // A target that can't cover shipping parses fine but yields no usable bid, so
    // it clears the bid field without flagging the total as malformed input.
    const parsed = p.value != null;
    calcEl.setAttribute("hidden", "");
    if (p.isFunction && parsed) {
      totalCalcEl.textContent = "= " + (p.calcText || "$" + fmtMoney(p.value));
      totalCalcEl.removeAttribute("hidden");
    } else totalCalcEl.setAttribute("hidden", "");
    if (p.valid) {
      bidIn.value = p.bid.toFixed(2);
      lastTotal = p.total; lastTotalNoShip = p.totalNoShip; lastValid = true;
    } else {
      bidIn.value = ""; lastValid = false;
    }
    bidSubEl.textContent = p.sub;
    totIn.classList.toggle("ebay-bid-calc__field--invalid", typed && !parsed);
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
