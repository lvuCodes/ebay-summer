// eBay Σummer. Copyright (C) 2026 lvuCodes. Licensed under GPL-3.0-or-later; see LICENSE.md.

import { BackLink } from "@lvucodes/ui";
import BrandStripe from "../components/BrandStripe.tsx";
import Inline from "../components/Inline.tsx";
import { listReleases, groupLabel, releaseUrl } from "../lib/releases.ts";
import { REPO_URL, LICENSE_URL } from "../lib/site.ts";
import releasesData from "../data/releases.json";

export default function Changelog() {
  const releases = listReleases(releasesData);

  return (
    <>
      <BrandStripe />
      <BackLink />

      <header className="page-head">
        <div className="wrap">
          <img className="logo" src="assets/logo.png" alt="eBay Σummer logo" />
          <h1>Changelog</h1>
          <p className="lead">
            Release history for the eBay Σummer Chrome extension. Newest first.
          </p>
          <a className="back-link" href="index.html">
            ← Back to eBay Σummer
          </a>
        </div>
      </header>

      <main>
        <div className="wrap">
          {releases.map((r, idx) => (
            <article className="release" key={r.version}>
              <div className="release-head">
                <h2>v{r.version}</h2>
                <span className="date">{r.date}</span>
                {idx === 0 && <span className="latest">Latest</span>}
              </div>
              {r.summary && <p className="release-summary">{r.summary}</p>}

              {(r.groups || []).map((g) => (
                <div className={`change-group ${g.type}`} key={g.type}>
                  <h3>
                    <span className={`tag tag-${g.type}`} />
                    {groupLabel(g.type)}
                  </h3>
                  <ul>
                    {g.items.map((it, i) => (
                      <li key={i}>
                        {it.lead && <strong>{it.lead}</strong>}
                        {it.lead && it.body ? " " : null}
                        {it.body && <Inline text={it.body} />}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              {r.package && (
                <p className="assets">
                  Package:{" "}
                  <a href={releaseUrl(r.package) || undefined}>
                    <code>{r.package}</code>
                  </a>
                </p>
              )}
            </article>
          ))}
        </div>
      </main>

      <footer>
        <div className="wrap">
          <p className="sig">eBay Σummer · Manifest V3 Chrome extension</p>
          <p>
            Not affiliated with eBay Inc. · <a href="index.html">Home</a> ·{" "}
            <a href={REPO_URL}>Source on GitHub</a>
          </p>
          <p className="copyright">
            © 2026 lvuCodes · Licensed under <a href={LICENSE_URL}>GPL-3.0</a>
          </p>
        </div>
      </footer>
    </>
  );
}
