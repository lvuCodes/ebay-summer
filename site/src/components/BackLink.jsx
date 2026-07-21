// eBay Σummer. Copyright (C) 2026 lvuCodes. Licensed under GPL-3.0-or-later; see LICENSE.md.

// Back link to the author's home page. Overlays the page's top-left corner so
// it never displaces the brand stripe or the header below it.
export default function BackLink({
  href = "https://lvucodes.github.io",
  label = "← Home",
}) {
  return (
    <nav className="back-nav">
      <a className="pill" href={href}>{label}</a>
    </nav>
  );
}
