// eBay Σummer. Copyright (C) 2026 lvuCodes. Licensed under GPL-3.0-or-later; see LICENSE.md.

import { tokenizeInline } from "../lib/inline.js";

// Renders a changelog body string with `code` and *emphasis* markers as elements.
export default function Inline({ text }) {
  return (
    <>
      {tokenizeInline(text).map((tok, i) => {
        if (tok.type === "code") return <code key={i}>{tok.value}</code>;
        if (tok.type === "em") return <em key={i}>{tok.value}</em>;
        return <span key={i}>{tok.value}</span>;
      })}
    </>
  );
}
