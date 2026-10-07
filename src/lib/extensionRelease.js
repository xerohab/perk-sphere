// Central extension release configuration.
//
// Chromium stable release metadata is fetched from the public Linux release
// endpoint. Firefox is not published yet — the abstraction is preserved so it
// can be added later by providing a second endpoint URL.
//
// This endpoint is public and requires NO HMAC authentication, no user
// credentials, and no device tokens. Only public release metadata is returned.
// No secrets are ever sent to or used by this module.

const RELEASE_ENDPOINTS = {
  chromium: "https://api.perksphere.org/v1/extension/releases/chromium",
  firefox: null
};

const ALLOWED_DOWNLOAD_HOSTS = ["api.perksphere.org"];

function validateRelease(data, expectedBrowser) {
  if (!data || typeof data !== "object") return null;
  if (data.channel !== "stable") return null;
  if (data.browser !== expectedBrowser) return null;
  if (!data.version || typeof data.version !== "string") return null;
  if (!data.download_url || typeof data.download_url !== "string") return null;
  if (!data.sha256 || typeof data.sha256 !== "string") return null;
  if (!data.published_at || typeof data.published_at !== "string") return null;

  // download_url must be HTTPS on an allowed host.
  let url;
  try {
    url = new URL(data.download_url);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (!ALLOWED_DOWNLOAD_HOSTS.includes(url.hostname)) return null;

  return {
    channel: data.channel,
    browser: data.browser,
    version: data.version,
    download_url: data.download_url,
    sha256: data.sha256,
    published_at: data.published_at,
    filename: typeof data.filename === "string" ? data.filename : null,
    size_bytes: typeof data.size_bytes === "number" ? data.size_bytes : null
  };
}

// Cache so repeated calls within a session don't re-fetch.
const cache = {};

// Fetches and validates release metadata for the given browser.
// Returns the validated release object or null if unavailable/malformed.
// Never throws — callers get null on any failure.
export async function fetchRelease(browser = "chromium") {
  const endpoint = RELEASE_ENDPOINTS[browser];
  if (!endpoint) return null; // Firefox not published yet

  if (cache[browser]) return cache[browser];

  try {
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || !json.ok || !json.data) return null;
    const validated = validateRelease(json.data, browser);
    if (validated) cache[browser] = validated;
    return validated;
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