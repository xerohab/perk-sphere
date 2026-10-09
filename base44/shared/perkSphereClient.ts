// Central server-side client for Perk Sphere Linux API member/admin routes.
//
// SECURITY: The actor object (user_reference, role, permissions) is ALWAYS
// derived server-side from the authenticated Base44 user. Never accepts
// actor fields from browser input. The Linux backend trusts the signed
// actor because the HMAC signature is valid — Base44 is the authoritative
// source of user identity and role.
//
// Stage 1 (current): Signed actor objects. Linux accepts the actor as-is.
// Stage 2 (future): Linux independently verifies the browser user's identity.
// Do NOT enable Stage 2 features (automatic reward payouts, ledger updates)
// until the Base44 identity integration has been implemented and tested.

import { linuxTrustedPost } from "./linuxClient.ts";
import { loadStaff, evaluateAccess } from "./permissions.ts";

export const PERK_SPHERE_ENDPOINTS = {
  DIRECTORY_LIST: "/v1/perk-sphere/directory/list",
  DIRECTORY_UPSERT: "/v1/perk-sphere/directory/upsert",
  REQUESTS_CREATE: "/v1/perk-sphere/requests/create",
  REQUESTS_LIST: "/v1/perk-sphere/requests/list",
  REQUESTS_REVIEW: "/v1/perk-sphere/requests/review",
  QUIZZES_CREATE: "/v1/perk-sphere/quizzes/create",
  QUIZZES_LIST: "/v1/perk-sphere/quizzes/list",
  QUIZZES_QUESTIONS: "/v1/perk-sphere/quizzes/questions",
  QUIZZES_PUBLISH: "/v1/perk-sphere/quizzes/publish",
  GRADING_SUBMIT: "/v1/perk-sphere/grading/submit",
  GRADING_HISTORY: "/v1/perk-sphere/grading/history",
  REPORTS_PREVIEW: "/v1/perk-sphere/reports/preview",
  REPORTS_DETAIL: "/v1/perk-sphere/report-archives/detail",
  REPORTS_ARCHIVES: "/v1/perk-sphere/report-archives/archives",
  REPORTS_ARCHIVE: "/v1/perk-sphere/report-archives/archive",
  REWARD_REVIEW_MINE: "/v1/perk-sphere/reward-review/mine",
  REWARD_REVIEW_QUEUE: "/v1/perk-sphere/reward-review/review-queue",
  REWARD_REVIEW_DECISION: "/v1/perk-sphere/reward-review/decision"
};

// Derives the actor object server-side from the authenticated Base44 user.
// Never accepts actor fields from browser input.
export function deriveActor(user, staff) {
  const actor = {
    user_reference: user.id,
    role: user.role === "admin" ? "admin" : "member",
    email: user.email || "",
    display_name: user.full_name || (user.email ? user.email.split("@")[0] : "Member")
  };
  if (staff) {
    actor.staff_role = staff.role;
    actor.permissions = staff.permissions;
  }
  return actor;
}

// Sends a member request to the Linux perk-sphere API.
// Authenticates the user server-side and derives the actor.
// Returns { ok, status, data } or { ok: false, status, code, error }.
export async function memberRequest(base44, path, body) {
  let user = null;
  try { user = await base44.auth.me(); } catch { user = null; }
  if (!user) return { ok: false, status: 401, code: "unauthorized", error: "Authentication required" };
  const actor = deriveActor(user, null);
  return linuxTrustedPost(path, { ...body, actor });
}

// Sends an admin request to the Linux perk-sphere API.
// Authenticates the user, checks staff permissions, and derives the actor.
// Returns { ok, status, data } or { ok: false, status, code, error }.
export async function adminRequest(base44, path, body, permission) {
  let user = null;
  try { user = await base44.auth.me(); } catch { user = null; }
  if (!user) return { ok: false, status: 401, code: "unauthorized", error: "Authentication required" };
  const staff = user.role === "admin" ? await loadStaff(base44.asServiceRole, user) : null;
  const verdict = evaluateAccess(user, staff, permission);
  if (!verdict.ok) return { ok: false, status: verdict.status, code: "forbidden", error: verdict.error };
  const actor = deriveActor(user, staff);
  return linuxTrustedPost(path, { ...body, actor });
}

// Wraps a Linux API result into a Response.json call.
export function linuxResponse(result) {
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error, code: result.code }, { status: result.status || 500 });
  }
  return Response.json({ ok: true, data: result.data });
}