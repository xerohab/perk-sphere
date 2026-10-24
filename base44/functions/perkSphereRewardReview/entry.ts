import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { memberRequest, adminRequest, linuxResponse, PERK_SPHERE_ENDPOINTS } from '../../shared/perkSphereClient.ts';

// Reward review: members view their own reward-request status; admins review
// the pending queue and make authorised decisions with recorded reasons.
//
// CRITICAL: Approval is NOT payout.
// A Linux reward request becoming "approved" does NOT mean the Base44 ledger
// has been updated. The interface clearly distinguishes:
//   - "approved" = Linux acknowledged the request
//   - "ledger_confirmed" = Base44 PointsTransaction/XpTransaction exists
//
// Payout controls remain DISABLED until the verified Base44 ledger handoff
// and reconciliation process is available.
//
// Disallowed activity does NOT automatically deduct Points or XP merely because
// a browser or extension reported it. The configured evidence and review policy
// is required.

async function perkSphereHandler(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action, filters, requestId, decision, reason, pointsValue, xpValue } = body;

    // ── Member: list own reward requests ───────────────────────────────
    if (action === "mine") {
      const result = await memberRequest(base44, PERK_SPHERE_ENDPOINTS.REWARD_REVIEW_MINE, { filters: filters || {} });
      return linuxResponse(result);
    }

    // ── Admin: review queue ────────────────────────────────────────────
    if (action === "reviewQueue") {
      const result = await adminRequest(base44, PERK_SPHERE_ENDPOINTS.REWARD_REVIEW_QUEUE, { filters: filters || {} }, "rewards.manage");
      return linuxResponse(result);
    }

    // ── Admin: make a decision ─────────────────────────────────────────
    if (action === "decision") {
      if (!requestId) return Response.json({ error: "Missing requestId" }, { status: 400 });
      if (!decision || !["approved", "denied"].includes(decision)) {
        return Response.json({ error: "Decision must be 'approved' or 'denied'" }, { status: 400 });
      }
      if (!reason || reason.trim().length < 5) {
        return Response.json({ error: "A reason is required" }, { status: 400 });
      }
      if (pointsValue !== undefined || xpValue !== undefined) {
        return Response.json({ error: "Reward amounts cannot be changed by review decisions." }, { status: 400 });
      }
      const payload = { requestId, decision, reason };
      const result = await adminRequest(base44, PERK_SPHERE_ENDPOINTS.REWARD_REVIEW_DECISION, payload, "rewards.manage");
      return linuxResponse(result);
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
export default perkSphereHandler;
if (typeof Deno !== 'undefined') Deno.serve(perkSphereHandler);
