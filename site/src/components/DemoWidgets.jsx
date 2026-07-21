// eBay Σummer. Copyright (C) 2026 lvuCodes. Licensed under GPL-3.0-or-later; see LICENSE.md.

import { useEffect, useRef } from "react";
import { initDemo } from "./demo-controller.js";

// Renders the extension's estimation box + bid calculator markup, then hands the
// two roots to the imperative controller (ported from the extension) in an effect.
export default function DemoWidgets() {
  const boxRef = useRef(null);
  const calcRef = useRef(null);

  useEffect(() => initDemo(boxRef.current, calcRef.current), []);

  return (
    <div className="demo">
      <div className="demo-widgets">
        <div
          ref={boxRef}
          className="ebay-estimation ebay-estimation--lg"
          data-item="49.24"
          data-ship="0"
          data-tax="0.0825"
        >
          <div className="ebay-estimation__body">
            <div className="ebay-estimation__main">
              <span className="ebay-estimation__label">Est. total</span>
              <span className="ebay-estimation__amount" />
              <span className="ebay-estimation__sub" />
            </div>
            <div className="ebay-estimation__panel" hidden>
              <span className="ebay-estimation__stepper">
                <button type="button" className="ebay-estimation__step" data-step="-1" aria-label="decrease count">−</button>
                <input type="text" className="ebay-estimation__count" defaultValue="1" aria-label="item count or =formula" />
                <button type="button" className="ebay-estimation__step" data-step="1" aria-label="increase count">+</button>
              </span>
              <span className="ebay-estimation__field-label">Cost per unit</span>
              <div className="ebay-estimation__perunit" />
              <button type="button" className="ebay-estimation__ship" aria-pressed="true" title="Include shipping in the per-unit price">
                <span className="ebay-estimation__ship-box" aria-hidden="true" />
                <span>Incl. shipping</span>
              </button>
            </div>
          </div>
          <button type="button" className="ebay-estimation__toggle" aria-expanded="false" title="Per-item cost">⏵</button>
        </div>

        <div ref={calcRef} className="ebay-bid-calc">
          <div className="ebay-bid-calc__head">
            <span className="ebay-bid-calc__label">Bid calculator</span>
            <button type="button" className="ebay-bid-calc__reset" aria-label="Clear both fields" title="Clear both fields">✕ Clear</button>
          </div>
          <div className="ebay-bid-calc__row">
            <span className="ebay-bid-calc__field ebay-bid-calc__field--bid">
              <span className="ebay-bid-calc__dollar" aria-hidden="true">$</span>
              <input type="text" className="ebay-bid-calc__input" placeholder="bid or =2*4" aria-label="bid amount or =expression" />
            </span>
            <span className="ebay-bid-calc__mid">
              <span className="ebay-bid-calc__calc" hidden />
              <span className="ebay-bid-calc__arrow">⇄</span>
            </span>
            <span className="ebay-bid-calc__total-line">
              <span className="ebay-bid-calc__field ebay-bid-calc__field--total">
                <span className="ebay-bid-calc__dollar" aria-hidden="true">$</span>
                <input type="text" className="ebay-bid-calc__total" placeholder="target total" aria-label="target landed total incl. tax and shipping, or =expression" />
              </span>
              <span className="ebay-bid-calc__total-calc" hidden />
              <span className="ebay-bid-calc__perunit" hidden />
            </span>
            <span className="ebay-bid-calc__sub" />
          </div>
        </div>
      </div>
    </div>
  );
}
