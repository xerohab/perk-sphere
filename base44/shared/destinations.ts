// Shared helpers for normalising Website + TrackedAccount records into a unified
// "destination" shape. toPublic() is the ONLY projection that leaves the server for
// the public directory, homepage, dashboard and the future browser extension.

export function normalizePlatform(raw) {
  if (!raw) return 'Website';
  const p = String(raw).toLowerCase();
  if (p.includes('youtube')) return 'YouTube';
  if (p === 'x' || p === 'twitter') return 'X';
  if (p.includes('website')) return 'Website';
  return raw;
}

export function platformType(platform) {
  const p = normalizePlatform(platform);
  if (p === 'YouTube') return 'youtube';
  if (p === 'X') return 'x';
  if (p === 'Website') return 'website';
  return 'other';
}

export function normalizeDomain(raw) {
  if (!raw) return '';
  let d = String(raw).trim().toLowerCase();
  d = d.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  d = d.split('/')[0].split('?')[0].split('#')[0];
  return d.replace(/^www\./, '');
}

// Domains for a destination — bare domain + deliberate www variant for exact matching.
export function domainsFor(domainish) {
  const d = normalizeDomain(domainish);
  if (!d) return [];
  return [d, 'www.' + d];
}

// Validate a browser target URL. Returns { ok: true, hostname } or { ok: false, error }.
// Rejects non-HTTPS, userinfo/credentials, unparseable URLs, and missing hostnames.
// The hostname is normalised to lowercase for exact matching against destination domains.
export function validateBrowserUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return { ok: false, error: 'missing_url' };
  let parsed;
  try { parsed = new URL(rawUrl); } catch { return { ok: false, error: 'invalid_url' }; }
  if (parsed.protocol !== 'https:') return { ok: false, error: 'non_https' };
  if (parsed.username || parsed.password) return { ok: false, error: 'userinfo_present' };
  const hostname = (parsed.hostname || '').toLowerCase();
  if (!hostname) return { ok: false, error: 'missing_hostname' };
  return { ok: true, hostname };
}

const TYPE_NAMES = { website: 'Website', channel: 'Channel', video: 'Video', account: 'Account', post: 'Post', other: 'Other' };

export function accountType(a) {
  if (a.destination_type) return a.destination_type;
  return normalizePlatform(a.platform) === 'YouTube' ? 'channel' : 'account';
}

export function typeLabel(platform, type) {
  if (type === 'website') return 'Website';
  const t = TYPE_NAMES[type] || 'Other';
  return platform && platform !== 'Website' ? platform + ' ' + t : t;
}

// Internal projection (includes flags used for filtering). Never returned directly.
export function websiteToDestination(w) {
  return {
    id: w.id,
    kind: 'website',
    name: w.site_name || w.domain || 'Website',
    platform: normalizePlatform(w.platform || 'Website'),
    type: 'website',
    domain: w.domain || null,
    handle: null,
    url: w.domain ? (String(w.domain).startsWith('http') ? w.domain : 'https://' + w.domain) : null,
    logo: w.logo || null,
    description: w.description || null,
    eligibility: w.eligibility || 'neutral',
    active: w.status !== 'inactive',
    publicly_visible: w.publicly_visible !== false,
    tracking_enabled: w.tracking_enabled !== false,
    points_eligible: w.points_eligible !== false,
    xp_eligible: w.xp_eligible !== false,
    updated_date: w.updated_date || w.created_date
  };
}

export function accountToDestination(a) {
  const platform = normalizePlatform(a.platform);
  return {
    id: a.id,
    kind: 'account',
    name: a.account_name || a.username || 'Account',
    platform,
    type: accountType(a),
    domain: null,
    handle: a.username || null,
    url: a.profile_url || null,
    logo: null,
    description: a.description || null,
    eligibility: a.eligibility || 'neutral',
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

// Public-safe fields only. No notes, no rule values, no tracking/visibility switches,
// no external ids, no created_by, nothing about users.
export function toPublic(d) {
  return {
    id: d.id,
    kind: d.kind,
    name: d.name,
    platform: d.platform,
    type: d.type,
    type_label: typeLabel(d.platform, d.type),
    domain: d.domain,
    handle: d.handle,
    url: d.url,
    logo: d.logo,
    description: d.description,
    eligibility: d.eligibility,
    points_eligible: d.points_eligible,
    xp_eligible: d.xp_eligible,
    updated_date: d.updated_date
  };
}