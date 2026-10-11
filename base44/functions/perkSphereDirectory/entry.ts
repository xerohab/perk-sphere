import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { memberRequest, adminRequest, linuxResponse, PERK_SPHERE_ENDPOINTS } from '../../shared/perkSphereClient.ts';

// Member directory: list entries (websites, X accounts, YouTube channels)
// with Allowed/Disallowed/Neutral classifications.
// Admin directory: upsert (create or update) entries.
//
// All requests are signed server-side. The actor object is derived from the
// authenticated Base44 user — never from browser input.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action, filters, entry, entryId, scope } = body;

    // ── List directory entries ─────────────────────────────────────────
    // Admin Directory Management (scope: "all") uses adminRequest() with
    // destinations.view. Member directory uses memberRequest().
    if (action === "list") {
      if (scope === "all") {
        const result = await adminRequest(base44, PERK_SPHERE_ENDPOINTS.DIRECTORY_LIST, { filters: filters || {}, include_unpublished: true }, "destinations.view");
        return linuxResponse(result);
      }
      const result = await memberRequest(base44, PERK_SPHERE_ENDPOINTS.DIRECTORY_LIST, { filters: filters || {} });
      return linuxResponse(result);
    }

    // ── Upsert directory entry (admin) ─────────────────────────────────
    if (action === "upsert") {
      if (!entry || !entry.name || !entry.type) {
        return Response.json({ error: "Entry name and type are required" }, { status: 400 });
      }
      const validTypes = ["website", "x_account", "youtube_channel"];
      if (!validTypes.includes(entry.type)) {
        return Response.json({ error: "Invalid entry type" }, { status: 400 });
      }
      const validClassifications = ["allowed", "disallowed", "neutral"];
      if (entry.classification && !validClassifications.includes(entry.classification)) {
        return Response.json({ error: "Invalid classification" }, { status: 400 });
      }
      const result = await adminRequest(base44, PERK_SPHERE_ENDPOINTS.DIRECTORY_UPSERT, { entry, entryId }, "destinations.manage");
      return linuxResponse(result);
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
