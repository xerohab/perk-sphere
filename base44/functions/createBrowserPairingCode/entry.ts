import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { waitUntil } from "base44:runtime";
import { linuxTrustedPost } from "../../shared/linuxClient.ts";
import { writeAudit } from "../../shared/permissions.ts";

// Generates a one-time browser-extension pairing code by calling the Linux API.
// The current user's Base44 ID is derived server-side via base44.auth.me() —
// user_reference is NEVER accepted from the request body.
// The plaintext pairing code is returned to the authenticated user only and is
// never persisted in Base44 entities or audit logs.

const LINUX_PATH = "/v1/account-devices/pairing/create";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ ok: false, error: { code: "unauthorized", message: "Authentication required." } }, { status: 401 });
    }

    // user_reference is derived server-side from the authenticated session.
    const result = await linuxTrustedPost(LINUX_PATH, {
      user_reference: user.id,
      device_name: "Browser extension"
    });

    if (!result.ok) {
      return Response.json({ ok: false, error: { code: result.code, message: result.error } }, { status: result.status });
    }

    // Audit the action without recording the plaintext pairing code.
    waitUntil(writeAudit(base44.asServiceRole, {
      adminId: user.id,
      action: "browser_pairing_code_requested",
      entityType: "BrowserDevice"
    }).catch(() => {}));

    return Response.json({
      ok: true,
      data: {
        pairing_code: result.data && result.data.pairing_code,
        expires_in_seconds: (result.data && result.data.expires_in_seconds) || 600
      }
    });
  } catch (_error) {
    return Response.json({ ok: false, error: { code: "internal_error", message: "Unable to generate pairing code." } }, { status: 500 });
  }
}