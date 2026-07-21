// eBay Σummer. Copyright (C) 2026 lvuCodes. Licensed under GPL-3.0-or-later; see LICENSE.md.

// Back link to the author's home page. Overlays the page's top-left corner so
// it never displaces the brand stripe or the header below it.
import { BACK_LINK_HREF, BACK_LINK_LABEL } from "../lib/site.js";

export default function BackLink({
  href = BACK_LINK_HREF,
  label = BACK_LINK_LABEL,
}) {
  return (
    <nav className="back-nav">
      <a className="pill" href={href}>{label}</a>
    </nav>
  );
}
