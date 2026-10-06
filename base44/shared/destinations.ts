// Shared helpers for normalising Website + TrackedAccount records into a
// unified, public-safe "destination" shape used by the directory, homepage,
// dashboard and the future browser extension.

export function normalizePlatform(raw) {
  if (!raw) return "Website";
  const p = String(raw).toLowerCase();
  if (p.includes("youtube")) return "YouTube";
  if (p === "x" || p === "twitter") return "X";
  if (p.includes("website")) return "Website";
  return raw;
}

export function platformType(platform) {
  const p = normalizePlatform(platform);
  if (p === "YouTube") return "youtube";
  if (p === "X") return "x";
  if (p === "Website") return "website";
  return "other";
}

// Project a Website record into a public-safe destination object.
export function websiteToDestination(w) {
  return {
    id: w.id,
    kind: "website",
    name: w.site_name || w.domain || "Website",
    platform: normalizePlatform(w.platform || "Website"),
    domain: w.domain || null,
    handle: null,
    url: w.domain ? (w.domain.startsWith("http") ? w.domain : `https://${w.domain}`) : null,
    logo: w.logo || null,
    description: w.description || null,
    eligibility: w.eligibility || "neutral",
    active: w.status !== "inactive",
    publicly_visible: w.publicly_visible !== false,
    tracking_enabled: w.tracking_enabled !== false,
    points_eligible: w.points_eligible !== false,
    xp_eligible: w.xp_eligible !== false,
    updated_date: w.updated_date || w.created_date
  };
}

// Project a TrackedAccount record into a public-safe destination object.
export function accountToDestination(a) {
  return {
    id: a.id,
    kind: "account",
    name: a.account_name || a.username || "Account",
    platform: normalizePlatform(a.platform),
    domain: null,
    handle: a.username || null,
    url: a.profile_url || null,
    logo: null,
    description: a.description || null,
    eligibility: a.eligibility || "neutral",
    active: a.active !== false,
    publicly_visible: a.publicly_visible !== false,
    tracking_enabled: a.tracking_enabled !== false,
    points_eligible: a.points_eligible !== false,
    xp_eligible: a.xp_eligible !== false,
    updated_date: a.updated_date || a.created_date
  };
}

export function isPublicDestination(d) {
  return d.active && d.publicly_visible;
}