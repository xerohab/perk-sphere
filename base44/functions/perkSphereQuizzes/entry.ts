import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { memberRequest, adminRequest, linuxResponse, PERK_SPHERE_ENDPOINTS } from '../../shared/perkSphereClient.ts';

// Video Quiz Manager: create, list, get questions, publish, submit answers, history.
//
// SECURITY: Correct answers are NEVER sent to the browser before grading.
// The questions endpoint returns only question text and choices — never
// which choice is correct. Grading happens server-side on Linux.
//
// REWARD GATE: The installed quiz routes support draft creation, publication
// and grading of non-rewarded quizzes. They do not yet provide production-ready
// Points/XP payouts. Reward settings are shown as disabled until the verified
// backend capability exists. YouTube viewing awards ZERO Points and ZERO XP.

async function handleQuizRequest(req) {
  try {
    if (req.method !== 'POST') return Response.json({error:'method_not_allowed'}, {status:405, headers:{Allow:'POST'}});
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id) return Response.json({error:'unauthorized'}, {status:401});
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some(key => !['action','quiz','quizId','answers','filters','scope'].includes(key))) {
      return Response.json({error:'invalid_request'}, {status:400});
    }
    const { action, quiz, quizId, answers, filters, scope } = body;

    // ── Create quiz (admin) ────────────────────────────────────────────
    if (action === "create") {
      if (!quiz || typeof quiz !== 'object' || Array.isArray(quiz) || typeof quiz.title !== 'string' || !quiz.title.trim() || quiz.title.length > 200 || typeof quiz.video_ref !== 'string' || !quiz.video_ref.trim()) {
        return Response.json({ error: "Quiz title and video reference are required" }, { status: 400 });
      }
      if (!quiz.questions || !Array.isArray(quiz.questions) || quiz.questions.length === 0 || quiz.questions.length > 30) {
        return Response.json({ error: "At least one question is required" }, { status: 400 });
      }
      for (const q of quiz.questions) {
        if (!q || typeof q.text !== 'string' || !q.text.trim() || q.text.length > 2000 || !Array.isArray(q.choices) || q.choices.length < 2 || q.choices.length > 6 || q.choices.some(choice => typeof choice !== 'string' || !choice.trim() || choice.length > 1000)) {
          return Response.json({ error: "Each question needs text and at least 2 choices" }, { status: 400 });
        }
        if (!Number.isInteger(q.correct_choice) || q.correct_choice < 0 || q.correct_choice >= q.choices.length) {
          return Response.json({ error: "Each question needs a correct answer (visible to admins only)" }, { status: 400 });
        }
      }
      const result = await adminRequest(base44, PERK_SPHERE_ENDPOINTS.QUIZZES_CREATE, { quiz }, "tasks.create");
      return linuxResponse(result);
    }

    // ── List quizzes ──────────────────────────────────────────────────
    // Admin Quiz Manager (scope: "all") uses adminRequest() with tasks.view
    // to list all quizzes including drafts. Member quiz page uses
    // memberRequest() to list published quizzes only.
    if (action === "list") {
      if (scope === "all") {
        const result = await adminRequest(base44, PERK_SPHERE_ENDPOINTS.QUIZZES_LIST, { filters: filters || {} }, "tasks.view");
        return linuxResponse(result);
      }
      const result = await memberRequest(base44, PERK_SPHERE_ENDPOINTS.QUIZZES_LIST, { filters: filters || {} });
      return linuxResponse(result);
    }

    // ── Get quiz questions (member — no correct answers returned) ──────
    if (action === "questions") {
      if (!quizId) return Response.json({ error: "Missing quizId" }, { status: 400 });
      const result = await memberRequest(base44, PERK_SPHERE_ENDPOINTS.QUIZZES_QUESTIONS, { quizId });
      return linuxResponse(result);
    }

    // ── Publish quiz (admin) ───────────────────────────────────────────
    if (action === "publish") {
      if (!quizId) return Response.json({ error: "Missing quizId" }, { status: 400 });
      const result = await adminRequest(base44, PERK_SPHERE_ENDPOINTS.QUIZZES_PUBLISH, { quizId }, "tasks.publish");
      return linuxResponse(result);
    }

    // ── Submit answers for grading (member) ────────────────────────────
    // Grading happens server-side. Correct answers are never sent before
    // submission. Duplicate submissions are handled by Linux (idempotent
    // source reference).
    if (action === "submit") {
      if (!quizId) return Response.json({ error: "Missing quizId" }, { status: 400 });
      if (!answers || !Array.isArray(answers)) {
        return Response.json({ error: "Answers array is required" }, { status: 400 });
      }
      const result = await memberRequest(base44, PERK_SPHERE_ENDPOINTS.GRADING_SUBMIT, { quizId, answers });
      return linuxResponse(result);
    }

    // ── View attempt history (member) ──────────────────────────────────
    if (action === "history") {
      const result = await memberRequest(base44, PERK_SPHERE_ENDPOINTS.GRADING_HISTORY, { filters: filters || {} });
      return linuxResponse(result);
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return Response.json({ error: 'Quiz service is temporarily unavailable. Please retry.' }, { status: 503 });
  }
}
async function perkSphereHandler(req) {
  const response = await handleQuizRequest(req);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
export default perkSphereHandler;
if (typeof Deno !== 'undefined') Deno.serve(perkSphereHandler);
