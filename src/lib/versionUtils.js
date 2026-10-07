// Semantic version comparison utilities.
// Uses numeric comparison so 0.2.10 is correctly newer than 0.2.9,
// and 1.0.0 is newer than 0.9.9.

export function parseVersion(v) {
  if (!v || typeof v !== "string") return null;
  const parts = v.trim().split(".");
  const nums = parts.map((p) => {
    const n = parseInt(p, 10);
    return isNaN(n) ? null : n;
  });
  if (nums.some((n) => n === null)) return null;
  return nums;
}

// Returns 1 if a > b, -1 if a < b, 0 if equal, or null if either is unparseable.
export function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return null;
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

// Returns true only if installed is strictly older than latest.
// Never returns true if either version cannot be parsed.
export function isOutdated(installed, latest) {
  const cmp = compareVersions(installed, latest);
  if (cmp === null) return false;
  return cmp < 0;
}