// URL / domain / account  ->  Allowed | Neutral | Disallowed  (extension-ready).
// Only active + publicly visible destinations are ever matched, so nothing private
// can be inferred from a classification response.
import {
  normalizePlatform, normalizeDomain, accountType,
  websiteToDestination, accountToDestination, isPublicDestination, toPublic
} from './destinations.ts';

const YT_HOSTS = ['youtube.com', 'youtube-nocookie.com'];
const X_HOSTS = ['x.com', 'twitter.com'];
const X_RESERVED = ['home', 'explore', 'search', 'notifications', 'messages', 'i', 'settings', 'login', 'signup', 'compose', 'intent', 'share', 'hashtag'];

function hostMatches(host, base) {
  return host === base || host.endsWith('.' + base);
}

export function parseTarget(input) {
  const out = { platform: 'Website', kind: 'website', hostname: null, handle: null, externalId: null };
  const raw = String((input && (input.url || input.domain)) || '').trim().slice(0, 2048);

  if (raw) {
    let u = null;
    try {
      u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : 'https://' + raw);
    } catch (_e) {
      u = null;
    }
    if (u) {
      out.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
      const parts = u.pathname.split('/').filter(Boolean);
      if (out.hostname === 'youtu.be') {
        out.platform = 'YouTube';
        out.kind = 'video';
        out.externalId = parts[0] || null;
      } else if (YT_HOSTS.some((h) => hostMatches(out.hostname, h))) {
        out.platform = 'YouTube';
        if (u.pathname === '/watch' && u.searchParams.get('v')) {
          out.kind = 'video';
          out.externalId = u.searchParams.get('v');
        } else if (['shorts', 'live', 'embed'].includes(parts[0]) && parts[1]) {
          out.kind = 'video';
          out.externalId = parts[1];
        } else if (parts[0] && parts[0].startsWith('@')) {
          out.kind = 'channel';
          out.handle = parts[0].slice(1).toLowerCase();
        } else if (parts[0] === 'channel' && parts[1]) {
          out.kind = 'channel';
          out.externalId = parts[1];
        } else if ((parts[0] === 'c' || parts[0] === 'user') && parts[1]) {
          out.kind = 'channel';
          out.handle = parts[1].toLowerCase();
        }
      } else if (X_HOSTS.some((h) => hostMatches(out.hostname, h))) {
        out.platform = 'X';
        if (parts[0] && !X_RESERVED.includes(parts[0].toLowerCase())) {
          out.handle = parts[0].toLowerCase();
          if (parts[1] === 'status' && parts[2]) {
            out.kind = 'post';
            out.externalId = parts[2];
          } else {
            out.kind = 'account';
          }
        }
      }
    }
  } else if (input && input.platform && input.handle) {
    out.platform = normalizePlatform(input.platform);
    out.kind = 'account';
    out.handle = String(input.handle).replace(/^@/, '').toLowerCase().slice(0, 100);
  }
  return out;
}

export function findMatch(target, websites, accounts) {
  const accs = (accounts || []).map((raw) => ({ raw, dest: accountToDestination(raw) })).filter((x) => isPublicDestination(x.dest));
  const sites = (websites || []).map((raw) => ({ raw, dest: websiteToDestination(raw) })).filter((x) => isPublicDestination(x.dest));

  if (target.platform !== 'Website') {
    const same = accs.filter((x) => x.dest.platform.toLowerCase() === target.platform.toLowerCase());

    if ((target.kind === 'video' || target.kind === 'post') && target.externalId) {
      const hit = same.find((x) =>
        accountType(x.raw) === target.kind &&
        (x.raw.external_platform_id === target.externalId || String(x.raw.profile_url || '').includes(target.externalId))
      );
      if (hit) return { level: 'content', dest: hit.dest };
    }

    if (target.handle || (target.kind === 'channel' && target.externalId)) {
      const hit = same.find((x) => {
        const t = accountType(x.raw);
        if (t === 'video' || t === 'post') return false;
        const uname = String(x.raw.username || '').replace(/^@/, '').toLowerCase();
        if (target.handle && uname === target.handle) return true;
        return !!(target.externalId && target.kind === 'channel' && x.raw.external_platform_id === target.externalId);
      });
      if (hit) return { level: 'account', dest: hit.dest };
    }
  }

  if (target.hostname) {
    let best = null;
    for (const s of sites) {
      const dom = normalizeDomain(s.raw.domain);
      if (dom && hostMatches(target.hostname, dom) && (!best || dom.length > best.len)) {
        best = { len: dom.length, dest: s.dest };
      }
    }
    if (best) return { level: 'website', dest: best.dest };
  }
  return null;
}

export function buildResult(target, websites, accounts) {
  const base = { target: { platform: target.platform, kind: target.kind, hostname: target.hostname } };
  // YouTube zero-reward hard enforcement — YouTube is never points- or XP-eligible,
  // regardless of how destinations are configured. The extension sees this and knows
  // not to expect rewards for YouTube activity.
  if (target.platform === "YouTube") {
    return { ...base, matched: false, classification: "disallowed", match_level: null, destination: null, tracking_enabled: false, points_eligible: false, xp_eligible: false };
  }
  const m = findMatch(target, websites, accounts);
  if (!m) {
    return { ...base, matched: false, classification: 'unknown', match_level: null, destination: null, tracking_enabled: false, points_eligible: false, xp_eligible: false };
  }
  const p = toPublic(m.dest);
  return {
    ...base,
    matched: true,
    classification: p.eligibility,
    match_level: m.level,
    destination: { id: p.id, name: p.name, platform: p.platform, type: p.type, type_label: p.type_label },
    tracking_enabled: m.dest.tracking_enabled,
    points_eligible: p.points_eligible,
    xp_eligible: p.xp_eligible
  };
}