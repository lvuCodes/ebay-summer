import BrandStripe from "../components/BrandStripe.jsx";
import DemoWidgets from "../components/DemoWidgets.jsx";
import { latestRelease } from "../lib/releases.js";
import { REPO_URL, LICENSE_URL } from "../lib/site.js";
import releasesData from "../data/releases.json";

const FEATURES = [
  { icon: "🧮", title: "Estimated total", body: "A dashed-purple box beside the price shows item + tax + shipping on listing, search, watchlist, bids/offers, and home pages." },
  { icon: "🟢🟡🔴", title: "Shipping dots", body: "A colored dot flags shipping at a glance — free, high on one count, high on both, or 📍🏃 pickup-only — against your own thresholds." },
  { icon: "🔨", title: "Bid calculator", body: <>On auctions and Best Offer listings, type a prospective bid (or an <code>=</code> formula) and see the live landed total — no <code>eval()</code>.</> },
  { icon: "⏰", title: "Auction alerts", body: 'Get a sound + system notification as an auction crosses your "seconds left" thresholds. Click the alert to jump straight to the tab.' },
  { icon: "📦", title: "Per-item breakdown", body: <>Expand any box for a live <em>@ $X.XX/unit</em> figure — divide a lot's total by a count, formulas included, for accurate per-piece pricing.</> },
  { icon: "🌍", title: "Ranges & currencies", body: "Multi-variation price ranges and non-US-currency listings both compute correctly from the US figures eBay shows." },
];

export default function Landing() {
  const latest = latestRelease(releasesData);

  return (
    <>
      <BrandStripe />

      <header className="hero">
        <img className="logo" src="assets/logo.png" alt="eBay Σummer logo" />
        {latest && (
          <div>
            <a className="version-badge" href="changelog.html" title="View the changelog">
              v{latest.version} · Changelog ↗
            </a>
          </div>
        )}
        <h1>eBay Σummer</h1>
        <p className="tagline">Know the total cost, <strong>before</strong> checkout.</p>
        <p className="sub">A Chrome extension that adds an <strong>EST. TOTAL</strong> box on eBay pages, so you can see the total cost (item price + sales tax + shipping) at a glance.</p>
        <div className="cta-row">
          <a className="btn btn-primary" href={REPO_URL}>Chrome Web Store ↗</a>
        </div>
        <DemoWidgets />
        <p className="note">Tune the tax rate, shipping-flag thresholds, per-page toggles, and auction alerts from the toolbar popup. Every field takes effect on open eBay tabs live.</p>

      </header>

      <section>
        <div className="wrap">
          <h2 className="section-title">What it does</h2>
          <div className="grid">
            {FEATURES.map((f) => (
              <div className="card" key={f.title}>

                <h3><span className="icon">{f.icon}</span>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="install">
        <div className="wrap">
          <h2 className="section-title">Install it via Github</h2>
          <div className="install">
            <ol className="steps">
              <li><div><a href={REPO_URL}>Download or clone the repo</a> from GitHub.</div></li>
              <li><div>Open <code>chrome://extensions</code> and enable <strong>Developer mode</strong> (top-right).</div></li>
              <li><div>Click <strong>Load unpacked</strong> and select the project folder.</div></li>
              <li><div>Visit any eBay listing, search, or bids/offers page — the boxes appear automatically.</div></li>
            </ol>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <p className="sig">eBay Σummer · Chrome extension</p>
          <p>Not affiliated with eBay Inc. · <a href="changelog.html">Changelog</a> · <a href={REPO_URL}>Source on GitHub</a></p>
          <p className="copyright">© 2026 lvuCodes · Licensed under <a href={LICENSE_URL}>GPL-3.0</a></p>
        </div>
      </footer>
    </>
  );
}
