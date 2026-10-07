import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { linuxTrustedPost } from "../../shared/linuxClient.ts";

// Lists browser-extension devices for the authenticated user by calling the
// Linux API. The current user's Base44 ID is derived server-side —
// user_reference is NEVER accepted from the request body.
// Sensitive fields (device_token, token_hash, HMAC data) are stripped before
// the response reaches the frontend.

const LINUX_PATH = "/v1/account-devices/list";

// Whitelist of safe device fields exposed to the frontend.
const SAFE_FIELDS = [
  "device_uuid",
  "device_type",
  "device_name",
  "platform",
  "client_version",
  "status",
  "last_seen_at",
  "created_at",
  "updated_at"
];

function sanitizeDevice(d) {
  const safe = {};
  for (const f of SAFE_FIELDS) {
    if (d && d[f] !== undefined) safe[f] = d[f];
  }
  return safe;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ ok: false, error: { code: "unauthorized", message: "Authentication required." } }, { status: 401 });
    }

    const result = await linuxTrustedPost(LINUX_PATH, {
      user_reference: user.id
    });

    if (!result.ok) {
      return Response.json({ ok: false, error: { code: result.code, message: result.error } }, { status: result.status });
    }

    const devices = ((result.data && result.data.devices) || []).map(sanitizeDevice);
    return Response.json({ ok: true, data: { devices } });
  } catch (_error) {
    return Response.json({ ok: false, error: { code: "internal_error", message: "Unable to load connected devices." } }, { status: 500 });
  }
}