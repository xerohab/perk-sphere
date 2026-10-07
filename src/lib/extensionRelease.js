// Central extension release configuration.
//
// Chromium release metadata is fetched via the Base44 backend function
// getBrowserExtensionRelease, which calls the public Linux release endpoint
// server-to-server. This avoids browser CORS issues — the frontend never
// fetches api.perksphere.org directly.
//
// Firefox is not published yet — the abstraction is preserved so it can be
// added later by extending the backend function.
//
// No secrets, HMAC keys, user IDs, device tokens, or pairing codes are used
// by this module.

import { base44 } from "@/api/base44Client";

const cache = {};

// Fetches and validates release metadata for the given browser.
// Returns the validated release object or null if unavailable/malformed.
// Never throws — callers get null on any failure.
export async function fetchRelease(browser = "chromium") {
  if (browser !== "chromium") return null; // Firefox not published yet

  if (cache[browser]) return cache[browser];

  try {
    const res = await base44.functions.invoke("getBrowserExtensionRelease", {});
    // The Base44 SDK wraps the function's JSON body under res.data.
    // Normalize both wrapped and direct shapes before validating.
    const body = res?.data ?? res;
    if (body?.ok && body.data) {
      const d = body.data;
      // Frontend-side double-check of key fields (mirrors server validation)
      if (
        d.browser === browser &&
        d.channel === "stable" &&
        typeof d.version === "string" && d.version &&
        typeof d.published_at === "string" && d.published_at &&
        typeof d.sha256 === "string" && /^[a-f0-9]{64}$/.test(d.sha256) &&
        typeof d.download_url === "string" && d.download_url
      ) {
        // download_url must be HTTPS on api.perksphere.org
        let url;
        try {
          url = new URL(d.download_url);
        } catch {
          return null;
        }
        if (url.protocol !== "https:" || url.hostname !== "api.perksphere.org") {
          return null;
        }
        cache[browser] = d;
        return d;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Synchronous access to the cached release (null if not yet fetched or unavailable).
export function getLatestRelease(browser = "chromium") {
  return cache[browser] || null;
}

export function isDownloadAvailable(browser = "chromium") {
  const r = getLatestRelease(browser);
  return !!(r && r.download_url && r.version);
}