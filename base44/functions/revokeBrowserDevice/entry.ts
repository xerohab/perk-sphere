import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { waitUntil } from "base44:runtime";
import { linuxTrustedPost } from "../../shared/linuxClient.ts";
import { writeAudit } from "../../shared/permissions.ts";

// Revokes a browser-extension device for the authenticated user by calling the
// Linux API. The current user's Base44 ID is derived server-side —
// user_reference is NEVER accepted from the request body.
// Only device_uuid is accepted from the frontend. Linux enforces ownership
// using both user_reference and device_uuid.

const LINUX_PATH = "/v1/account-devices/revoke";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ ok: false, error: { code: "unauthorized", message: "Authentication required." } }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { device_uuid } = body;
    if (!device_uuid || typeof device_uuid !== "string") {
      return Response.json({ ok: false, error: { code: "missing_device_uuid", message: "device_uuid is required." } }, { status: 400 });
    }

    // user_reference is server-derived; only device_uuid comes from the client.
    const result = await linuxTrustedPost(LINUX_PATH, {
      user_reference: user.id,
      device_uuid
    });

    if (!result.ok) {
      return Response.json({ ok: false, error: { code: result.code, message: result.error } }, { status: result.status });
    }

    waitUntil(writeAudit(base44.asServiceRole, {
      adminId: user.id,
      action: "browser_device_revoked",
      entityType: "BrowserDevice",
      next: { device_uuid }
    }).catch(() => {}));

    return Response.json({ ok: true });
  } catch (_error) {
    return Response.json({ ok: false, error: { code: "internal_error", message: "Unable to revoke device." } }, { status: 500 });
  }
}