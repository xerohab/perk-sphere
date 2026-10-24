// Fetches Chromium extension release metadata from the public Linux release
// endpoint server-to-server. This avoids browser CORS issues — the frontend
// calls this function via the SDK instead of fetching api.perksphere.org
// directly.
//
// The release endpoint is intentionally public. It requires NO HMAC
// authentication, NO user credentials, NO device tokens, and NO pairing
// codes. No secrets are sent to or used by this function.
//
// The Linux response is validated server-side before safe fields are returned
// to the frontend. If validation fails, a safe "unavailable" error is returned
// and the frontend shows its existing "coming soon" state.

const LINUX_RELEASE_URL = "https://api.perksphere.org/v1/extension/releases/chromium";
const ALLOWED_DOWNLOAD_HOST = "api.perksphere.org";

function isSha256Hex(s) {
  return typeof s === "string" && /^[a-f0-9]{64}$/.test(s);
}

function fail(code) {
  return Response.json(
    { ok: false, error: { code, message: "Extension release metadata is currently unavailable." } },
    { status: 502 }
  );
}

async function perkSphereHandler(req) {
  try {
    const res = await fetch(LINUX_RELEASE_URL, {
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return fail("release_unavailable");

    const json = await res.json();
    if (!json || !json.ok || !json.data) return fail("release_unavailable");

    const d = json.data;

    // Required field validation
    if (d.browser !== "chromium") return fail("release_invalid");
    if (d.channel !== "stable") return fail("release_invalid");
    if (!d.version || typeof d.version !== "string") return fail("release_invalid");
    if (!isSha256Hex(d.sha256)) return fail("release_invalid");
    if (!d.published_at || typeof d.published_at !== "string") return fail("release_invalid");

    // download_url must be HTTPS on the allowed host
    let url;
    try {
      url = new URL(d.download_url);
    } catch {
      return fail("release_invalid");
    }
    if (url.protocol !== "https:" || url.hostname !== ALLOWED_DOWNLOAD_HOST) {
      return fail("release_invalid");
    }

    // Return only safe fields
    return Response.json({
      ok: true,
      data: {
        browser: d.browser,
        channel: d.channel,
        version: d.version,
        download_url: d.download_url,
        sha256: d.sha256,
        published_at: d.published_at,
        filename: typeof d.filename === "string" ? d.filename : null,
        size_bytes: typeof d.size_bytes === "number" ? d.size_bytes : null
      }
    });
  } catch (_error) {
    return fail("release_unavailable");
  }
}
export default perkSphereHandler;
if (typeof Deno !== 'undefined') Deno.serve(perkSphereHandler);
