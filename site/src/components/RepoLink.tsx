// eBay Σummer. Copyright (C) 2026 lvuCodes. Licensed under GPL-3.0-or-later; see LICENSE.md.

import { REPO_URL } from "../lib/site.ts";

export const REPO_LINK_LABEL = "ebay-summer on GitHub";

export function RepoLink() {
  return (
    <a href={REPO_URL} target="_blank" rel="noreferrer noopener">
      {REPO_LINK_LABEL}
    </a>
  );
}
