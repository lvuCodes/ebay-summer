// eBay Σummer. Copyright (C) 2026 lvuCodes. Licensed under GPL-3.0-or-later; see LICENSE.md.
//
// Framework-free helpers over the releases data. Kept React-free so they can be
// unit-tested under Vitest and reused by any future data source (e.g. a GitHub
// Releases fetch) without touching the render layer.

import { REPO_URL } from "./site.ts";

export type GroupType = "added" | "fixed" | "changed" | "known-issues";

export interface ReleaseItem {
  lead?: string;
  body?: string;
}

export interface ReleaseGroup {
  type: string;
  items: ReleaseItem[];
}

export interface Release {
  version: string;
  date: string;
  summary?: string;
  package?: string;
  groups?: ReleaseGroup[];
}

export interface ReleasesData {
  releases?: Release[];
}

export function listReleases(data: ReleasesData | null | undefined): Release[] {
  const releases = data && Array.isArray(data.releases) ? data.releases : [];
  return releases.slice().sort((a, b) => cmpVersion(b.version, a.version));
}

export function latestRelease(data: ReleasesData | null | undefined): Release | null {
  return listReleases(data)[0] || null;
}

export function cmpVersion(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

function parseVersion(v: string): number[] {
  return String(v == null ? "" : v)
    .split(".")
    .map((n) => {
      const x = parseInt(n, 10);
      return Number.isFinite(x) ? x : 0;
    });
}

// The zips live in the repo, not in docs/, so a page-relative href would 404 on
// Pages. /raw/ serves the bytes as a download rather than GitHub's blob viewer.
export function releaseUrl(path: string | null | undefined): string | null {
  return path ? `${REPO_URL}/raw/main/${path}` : null;
}

const GROUP_LABELS: Record<string, string> = {
  added: "Added",
  fixed: "Fixed",
  changed: "Changed",
  "known-issues": "Known Issues",
};

export function groupLabel(type: string): string {
  return GROUP_LABELS[type] || String(type || "");
}

// Throws on a malformed entry so a bad releases.json fails the build/tests loudly
// instead of rendering a broken changelog.
export function validateReleases(data: ReleasesData | null | undefined): boolean {
  const releases = listReleases(data);
  if (releases.length === 0) throw new Error("releases.json has no releases");
  for (const r of releases) {
    if (!r.version) throw new Error("release missing version");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.date || "")))
      throw new Error(`release ${r.version} has an invalid date`);
    for (const g of r.groups || []) {
      if (!GROUP_LABELS[g.type])
        throw new Error(`release ${r.version} has unknown group type "${g.type}"`);
      if (!Array.isArray(g.items) || g.items.length === 0)
        throw new Error(`release ${r.version} group "${g.type}" has no items`);
    }
  }
  return true;
}
