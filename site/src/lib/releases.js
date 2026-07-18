// Framework-free helpers over the releases data. Kept React-free so they can be
// unit-tested under node:test and reused by any future data source (e.g. a
// GitHub Releases fetch) without touching the render layer.

export function listReleases(data) {
  const releases = data && Array.isArray(data.releases) ? data.releases : [];
  return releases.slice().sort((a, b) => cmpVersion(b.version, a.version));
}

// The newest entry that has actually shipped — an unreleased entry sits at the
// top of the list but is not what users can install.
export function latestRelease(data) {
  return listReleases(data).find((r) => !r.unreleased) || null;
}

export function cmpVersion(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

function parseVersion(v) {
  return String(v == null ? "" : v)
    .split(".")
    .map((n) => {
      const x = parseInt(n, 10);
      return Number.isFinite(x) ? x : 0;
    });
}

const GROUP_LABELS = { added: "Added", fixed: "Fixed", changed: "Changed" };

export function groupLabel(type) {
  return GROUP_LABELS[type] || String(type || "");
}

// Throws on a malformed entry so a bad releases.json fails the build/tests loudly
// instead of rendering a broken changelog.
export function validateReleases(data) {
  const releases = listReleases(data);
  if (releases.length === 0) throw new Error("releases.json has no releases");
  for (const r of releases) {
    if (!r.version) throw new Error("release missing version");
    // An unreleased entry has no ship date yet; every other entry must carry one.
    if (!r.unreleased && !/^\d{4}-\d{2}-\d{2}$/.test(String(r.date || "")))
      throw new Error(`release ${r.version} has an invalid date`);
    if (r.unreleased && r.date)
      throw new Error(`release ${r.version} is unreleased but carries a date`);
    for (const g of r.groups || []) {
      if (!GROUP_LABELS[g.type])
        throw new Error(`release ${r.version} has unknown group type "${g.type}"`);
      if (!Array.isArray(g.items) || g.items.length === 0)
        throw new Error(`release ${r.version} group "${g.type}" has no items`);
    }
  }
  return true;
}
