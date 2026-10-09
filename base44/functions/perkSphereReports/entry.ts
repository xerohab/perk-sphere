import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { memberRequest, adminRequest, linuxResponse, PERK_SPHERE_ENDPOINTS } from '../../shared/perkSphereClient.ts';

// Weekly activity reports: preview, archives, detail, and admin archive creation.
//
// Reports use Monday-to-Sunday UTC weeks.
//
// CLEAR DISTINCTIONS:
// - Observed activity: activity the system detected (may not qualify)
// - Verified activity: activity that passed verification
// - Pending rewards: reward requests awaiting review
// - Acknowledged reward requests: Linux approved the request (NOT a ledger credit)
// - Confirmed ledger transactions: Base44 PointsTransaction/XpTransaction records
//
// Never label an acknowledged Linux request as a confirmed Base44 credit
// unless the ledger has been reconciled.

// Computes the Monday of the current week in UTC as YYYY-MM-DD.
// Reports use Monday-to-Sunday UTC weeks.
function getCurrentWeekStartUTC() {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const diff = (day === 0 ? 6 : day - 1); // days since Monday
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().split("T")[0];
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action, archiveId, userReference, filters } = body;

    // ── Current week preview (member) ─────────────────────────────────
    // Linux requires { actor, week_start }. week_start is a Monday in UTC
    // as YYYY-MM-DD. The actor is derived server-side by memberRequest().
    if (action === "preview") {
      const weekStart = body.week_start || getCurrentWeekStartUTC();
      const result = await memberRequest(base44, PERK_SPHERE_ENDPOINTS.REPORTS_PREVIEW, { week_start: weekStart });
      return linuxResponse(result);
    }

    // ── List archives (member — own only) ──────────────────────────────
    if (action === "archives") {
      const result = await memberRequest(base44, PERK_SPHERE_ENDPOINTS.REPORTS_ARCHIVES, { filters: filters || {} });
      return linuxResponse(result);
    }

    // ── Archive detail (member — own only) ────────────────────────────
    if (action === "detail") {
      if (!archiveId) return Response.json({ error: "Missing archiveId" }, { status: 400 });
      const result = await memberRequest(base44, PERK_SPHERE_ENDPOINTS.REPORTS_DETAIL, { archiveId });
      return linuxResponse(result);
    }

    // ── Admin: preview any member's report ────────────────────────────
    if (action === "adminPreview") {
      if (!userReference) return Response.json({ error: "Missing userReference" }, { status: 400 });
      const weekStart = body.week_start || getCurrentWeekStartUTC();
      const result = await adminRequest(base44, PERK_SPHERE_ENDPOINTS.REPORTS_PREVIEW, { userReference, week_start: weekStart }, "analytics.view");
      return linuxResponse(result);
    }

    // ── Admin: list all archives ──────────────────────────────────────
    if (action === "adminArchives") {
      const result = await adminRequest(base44, PERK_SPHERE_ENDPOINTS.REPORTS_ARCHIVES, { filters: filters || {} }, "analytics.view");
      return linuxResponse(result);
    }

    // ── Admin: archive detail ──────────────────────────────────────────
    if (action === "adminDetail") {
      if (!archiveId) return Response.json({ error: "Missing archiveId" }, { status: 400 });
      const result = await adminRequest(base44, PERK_SPHERE_ENDPOINTS.REPORTS_DETAIL, { archiveId }, "analytics.view");
      return linuxResponse(result);
    }

    // ── Admin: create weekly archive ──────────────────────────────────
    // Preserves historical report versions. Clearly identifies superseded reports.
    if (action === "archive") {
      const result = await adminRequest(base44, PERK_SPHERE_ENDPOINTS.REPORTS_ARCHIVE, {}, "analytics.view");
      return linuxResponse(result);
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}