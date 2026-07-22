// eBay Σummer. Copyright (C) 2026 lvuCodes. Licensed under GPL-3.0-or-later; see LICENSE.md.
//
// Tiny inline tokenizer for changelog item bodies. Supports two markers so the
// data stays plain JSON rather than HTML: `code` -> <code>, *emphasis* -> <em>.
// Returns an array of tokens the React layer maps to elements (no dangerous HTML).

export type InlineToken = { type: "text" | "code" | "em"; value: string };

export function tokenizeInline(text: unknown): InlineToken[] {
  const src = String(text == null ? "" : text);
  const tokens: InlineToken[] = [];
  const re = /`([^`]+)`|\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) tokens.push({ type: "text", value: src.slice(last, m.index) });
    if (m[1] != null) tokens.push({ type: "code", value: m[1] });
    else tokens.push({ type: "em", value: m[2] });
    last = re.lastIndex;
  }
  if (last < src.length) tokens.push({ type: "text", value: src.slice(last) });
  return tokens;
}
