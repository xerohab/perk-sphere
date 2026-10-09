// Central server-side client for Perk Sphere Linux API member/admin routes.
//
// SECURITY: The signed actor object sent to Linux contains EXACTLY two
// properties: { user_reference, role }. It is ALWAYS derived server-side
// from the authenticated Base44 user via base44.auth.me(). Never accepts
// actor fields from browser input.
//
// Staff permissions are retained internally within Base44 for authorisation
// decisions but are NOT sent to Linux. The Linux backend trusts the signed
// actor because the HMAC signature is valid — Base44 is the authoritative
// source of user identity and role.
//
// memberRequest() uses an explicit server-side allowlist of member-safe paths.
// Privileged operations require adminRequest() with a staff permission check.
// Browser-provided actor, role, user ID or permission fields are never trusted.

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

// Explicit allowlist of member-safe Linux paths. memberRequest() rejects any
// path not in this set. Privileged operations (upsert, review, create quiz,
// publish, archive, decision, review-queue) are NOT in this list — they
// require adminRequest() with a staff permission check.
const MEMBER_SAFE_PATHS = new Set([
  PERK_SPHERE_ENDPOINTS.DIRECTORY_LIST,
  PERK_SPHERE_ENDPOINTS.REQUESTS_CREATE,
  PERK_SPHERE_ENDPOINTS.REQUESTS_LIST,
  PERK_SPHERE_ENDPOINTS.QUIZZES_LIST,
  PERK_SPHERE_ENDPOINTS.QUIZZES_QUESTIONS,
  PERK_SPHERE_ENDPOINTS.GRADING_SUBMIT,
  PERK_SPHERE_ENDPOINTS.GRADING_HISTORY,
  PERK_SPHERE_ENDPOINTS.REPORTS_PREVIEW,
  PERK_SPHERE_ENDPOINTS.REPORTS_ARCHIVES,
  PERK_SPHERE_ENDPOINTS.REPORTS_DETAIL,
  PERK_SPHERE_ENDPOINTS.REWARD_REVIEW_MINE
]);

// Derives the signed actor object server-side from the authenticated Base44
// user. The Linux Stage 2 API expects EXACTLY { user_reference, role }.
// Staff permissions are used internally for authorisation but NOT sent to Linux.
export function deriveActor(user) {
  return {
    user_reference: String(user.id),
    role: user.role === "admin" ? "admin" : "member"
  };
}

// Sends a member request to the Linux perk-sphere API.
// Authenticates the user server-side via base44.auth.me() and derives the actor.
// Uses an explicit allowlist of member-safe paths — privileged endpoints are
// rejected with 403. Never trusts browser-supplied actor, role or user ID fields.
// Returns { ok, status, data } or { ok: false, status, code, error }.
export async function memberRequest(base44, path, body) {
  if (!MEMBER_SAFE_PATHS.has(path)) {
    return { ok: false, status: 403, code: "forbidden", error: "This operation requires administrator authorisation." };
  }
  let user = null;
  try { user = await base44.auth.me(); } catch { user = null; }
  if (!user) return { ok: false, status: 401, code: "unauthorized", error: "Authentication required" };
  const actor = deriveActor(user);
  return linuxTrustedPost(path, { ...body, actor });
}

// Sends an admin request to the Linux perk-sphere API.
// Authenticates the user, checks staff permissions server-side, and derives
// the actor. The Linux admin role is derived ONLY from trusted Base44 identity
// and the applicable staff permission policy — never from browser input.
// Returns { ok, status, data } or { ok: false, status, code, error }.
export async function adminRequest(base44, path, body, permission) {
  let user = null;
  try { user = await base44.auth.me(); } catch { user = null; }
  if (!user) return { ok: false, status: 401, code: "unauthorized", error: "Authentication required" };
  const staff = user.role === "admin" ? await loadStaff(base44.asServiceRole, user) : null;
  const verdict = evaluateAccess(user, staff, permission);
  if (!verdict.ok) return { ok: false, status: verdict.status, code: "forbidden", error: verdict.error };
  const actor = deriveActor(user);
  return linuxTrustedPost(path, { ...body, actor });
}

// Wraps a Linux API result into a Response.json call.
export function linuxResponse(result) {
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error, code: result.code }, { status: result.status || 500 });
  }
  return Response.json({ ok: true, data: result.data });
}