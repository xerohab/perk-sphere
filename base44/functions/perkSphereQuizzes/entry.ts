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

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action, quiz, quizId, answers, filters } = body;

    // ── Create quiz (admin) ────────────────────────────────────────────
    if (action === "create") {
      if (!quiz || !quiz.title || !quiz.video_ref) {
        return Response.json({ error: "Quiz title and video reference are required" }, { status: 400 });
      }
      if (!quiz.questions || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
        return Response.json({ error: "At least one question is required" }, { status: 400 });
      }
      for (const q of quiz.questions) {
        if (!q.text || !q.choices || !Array.isArray(q.choices) || q.choices.length < 2) {
          return Response.json({ error: "Each question needs text and at least 2 choices" }, { status: 400 });
        }
        if (q.correct_choice === undefined || q.correct_choice === null) {
          return Response.json({ error: "Each question needs a correct answer (visible to admins only)" }, { status: 400 });
        }
      }
      const result = await adminRequest(base44, PERK_SPHERE_ENDPOINTS.QUIZZES_CREATE, { quiz }, "tasks.create");
      return linuxResponse(result);
    }

    // ── List quizzes (member sees published; admin sees all) ──────────
    if (action === "list") {
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
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}