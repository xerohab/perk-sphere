import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { memberRequest, adminRequest, linuxResponse, PERK_SPHERE_ENDPOINTS } from '../../shared/perkSphereClient.ts';

// Member directory requests: create, list own, and admin review.
// Members can request addition, removal, or reclassification of directory entries.
// Admins can approve or deny requests with a recorded reason.
//
// Approved requests update the directory entry through the Linux backend,
// preserving the audit trail.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action, request, filters, requestId, decision, reason } = body;

    // ── Create a directory request (member) ───────────────────────────
    if (action === "create") {
      if (!request || !request.request_type || !request.target_name) {
        return Response.json({ error: "Request type and target name are required" }, { status: 400 });
      }
      const validTypes = ["add_allowed", "add_disallowed", "remove_disallowed", "reclassify"];
      if (!validTypes.includes(request.request_type)) {
        return Response.json({ error: "Invalid request type" }, { status: 400 });
      }
      if (!request.reason || request.reason.trim().length < 10) {
        return Response.json({ error: "A reason of at least 10 characters is required" }, { status: 400 });
      }
      const result = await memberRequest(base44, PERK_SPHERE_ENDPOINTS.REQUESTS_CREATE, { request });
      return linuxResponse(result);
    }

    // ── List own requests (member) ─────────────────────────────────────
    if (action === "list") {
      const result = await memberRequest(base44, PERK_SPHERE_ENDPOINTS.REQUESTS_LIST, { filters: filters || {}, scope: "mine" });
      return linuxResponse(result);
    }

    // ── List all requests (admin) ──────────────────────────────────────
    if (action === "listAll") {
      const result = await adminRequest(base44, PERK_SPHERE_ENDPOINTS.REQUESTS_LIST, { filters: filters || {}, scope: "all" }, "destinations.manage");
      return linuxResponse(result);
    }

    // ── Review a request (admin) ───────────────────────────────────────
    if (action === "review") {
      if (!requestId) return Response.json({ error: "Missing requestId" }, { status: 400 });
      if (!decision || !["approved", "denied"].includes(decision)) {
        return Response.json({ error: "Decision must be 'approved' or 'denied'" }, { status: 400 });
      }
      if (!reason || reason.trim().length < 3) {
        return Response.json({ error: "A reason is required" }, { status: 400 });
      }
      const result = await adminRequest(base44, PERK_SPHERE_ENDPOINTS.REQUESTS_REVIEW, { requestId, decision, reason }, "destinations.manage");
      return linuxResponse(result);
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}