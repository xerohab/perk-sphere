// Explicit translation between the UI model and the installed Linux contracts.
// Actor identity is added separately by perkSphereClient, after this translation.
export function stage2Body(path, body = {}) {
  const filters = body.filters || {};
  if (path.endsWith('/directory/list')) return { limit: filters.limit, include_unpublished: body.include_unpublished };
  if (path.endsWith('/directory/upsert')) {
    const e = body.entry;
    return { entry_type: e.type, canonical_identifier: e.canonical_identifier || e.url, display_name: e.name, classification: e.classification || 'neutral', status: e.active === false ? 'archived' : 'published', notes: e.description || '' };
  }
  if (path.endsWith('/requests/create')) {
    const r = body.request;
    return { request_type: r.request_type, entry_type: r.entry_type || 'website', canonical_identifier: r.target_url || r.target_name, proposed_classification: r.requested_classification, explanation: r.reason };
  }
  if (path.endsWith('/requests/list')) return { status: filters.status, limit: filters.limit };
  if (path.endsWith('/requests/review')) return { request_uuid: body.requestId, decision: body.decision, reason: body.reason };
  if (path.endsWith('/quizzes/create')) {
    const q = body.quiz;
    return { title: q.title, description: q.description, provider: q.provider || 'youtube', partner_uuid: q.partner_uuid, video_reference: q.video_ref, questions: q.questions.map(question => ({ question_text: question.text, options: question.choices, correct_index: question.correct_choice })) };
  }
  if (path.endsWith('/quizzes/list')) return { limit: filters.limit };
  if (path.endsWith('/quizzes/questions') || path.endsWith('/quizzes/publish')) return { quiz_uuid: body.quizId };
  if (path.endsWith('/grading/submit')) return { quiz_uuid: body.quizId, answers: body.answers.map(answer => ({ question_uuid: answer.question_id, selected_index: answer.choice_id })) };
  if (path.endsWith('/grading/history')) return { quiz_uuid: filters.quiz_uuid };
  if (path.endsWith('/reward-review/mine') || path.endsWith('/reward-review/review-queue')) return {};
  if (path.endsWith('/reward-review/decision')) return { reward_request_uuid: body.requestId, decision: body.decision === 'approved' ? 'approve' : 'reject', reason: body.reason };
  if (path.endsWith('/report-archives/detail')) return body.archiveId ? { report_uuid: body.archiveId } : { week_start: body.week_start, user_reference: body.userReference };
  if (path.endsWith('/report-archives/archives')) return { user_reference: body.userReference || filters.user_reference };
  if (path.endsWith('/report-archives/archive')) return { week_start: body.week_start, user_reference: body.userReference };
  return body;
}

export function stage2Row(row) {
  if (!row || typeof row !== 'object') return row;
  return {
    ...row,
    id: row.id || row.entry_uuid || row.request_uuid || row.quiz_uuid || row.question_uuid || row.attempt_uuid || row.reward_request_uuid || row.report_uuid,
    ...(row.entry_type ? { type: row.entry_type, name: row.display_name, url: row.canonical_identifier, description: row.notes, active: row.status === 'published' } : {}),
    ...(row.request_uuid ? { target_name: row.canonical_identifier, target_url: row.canonical_identifier, reason: row.explanation } : {}),
    ...(row.video_reference ? { video_ref: row.video_reference } : {}),
    ...(row.question_uuid ? { text: row.question_text, choices: row.options } : {}),
    ...(row.reward_request_uuid ? { status: row.status === 'pending_review' ? 'pending' : row.status === 'rejected' ? 'denied' : row.status, points_value: row.points_delta, xp_value: row.xp_delta, reason: row.decision_reason, source: row.source_type } : {})
  };
}

export function stage2Data(data) {
  if (Array.isArray(data)) return data.map(stage2Row);
  if (!data || typeof data !== 'object') return data;
  const result = stage2Row(data);
  for (const key of ['entries', 'requests', 'quizzes', 'questions', 'attempts', 'archives', 'items']) {
    if (Array.isArray(data[key])) result[key] = data[key].map(stage2Row);
  }
  if (data.archive) result.archive = stage2Row(data.archive);
  return result;
}
