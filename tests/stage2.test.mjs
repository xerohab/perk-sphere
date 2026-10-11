import test from 'node:test';
import assert from 'node:assert/strict';
import { stage2Body, stage2Data } from '../base44/shared/stage2Contract.ts';
const path = name => '/v1/perk-sphere/' + name;
test('quiz adapter sends flat Linux fields and indexes without exposing correct answers', () => {
  assert.deepEqual(stage2Body(path('quizzes/create'), { quiz: { title: 'Test', video_ref: 'video123', questions: [{ text: 'Question', choices: ['A','B'], correct_choice: 1 }] } }), { title: 'Test', description: undefined, provider: 'youtube', partner_uuid: undefined, video_reference: 'video123', questions: [{ question_text: 'Question', options: ['A','B'], correct_index: 1 }] });
  assert.deepEqual(stage2Body(path('grading/submit'), { quizId: 'quiz', answers: [{ question_id: 'question', choice_id: 1 }] }), { quiz_uuid: 'quiz', answers: [{ question_uuid: 'question', selected_index: 1 }] });
  assert.deepEqual(stage2Body(path('quizzes/publish'), { quizId: 'quiz' }), { quiz_uuid: 'quiz' });
});
test('reward review sends Linux decision contract and cannot modify reward deltas', () => {
  assert.deepEqual(stage2Body(path('reward-review/decision'), { requestId: 'request', decision: 'approved', reason: 'verified', points_value: 999, actor: { role: 'admin' } }), { reward_request_uuid: 'request', decision: 'approve', reason: 'verified' });
  assert.deepEqual(stage2Body(path('reward-review/mine'), { filters: { forged: true } }), {});
});
test('directory and request adapters use canonical identifiers, not nested payloads', () => {
  assert.deepEqual(stage2Body(path('directory/upsert'), { entry: { name: 'Example', type: 'website', url: 'example.org', classification: 'allowed', active: false } }), { entry_type: 'website', canonical_identifier: 'example.org', display_name: 'Example', classification: 'allowed', status: 'archived', notes: '' });
  assert.deepEqual(stage2Body(path('requests/review'), { requestId: 'request', decision: 'denied', reason: 'not allowed' }), { request_uuid: 'request', decision: 'denied', reason: 'not allowed' });
});
test('Linux response rows retain stable UI IDs and display fields', () => {
  const result = stage2Data({ requests: [{ reward_request_uuid: 'request', status: 'rejected', points_delta: 10, xp_delta: 5 }] });
  assert.equal(result.requests[0].id, 'request'); assert.equal(result.requests[0].status, 'denied'); assert.equal(result.requests[0].points_value, 10);
  const question = stage2Data({ questions: [{ question_uuid: 'q', question_text: 'Question', options: ['A','B'] }] }).questions[0];
  assert.equal(question.id, 'q'); assert.equal(question.text, 'Question'); assert.deepEqual(question.choices, ['A','B']); assert.equal(question.correct_index, undefined);
  assert.equal(stage2Data([{ quiz_uuid: 'quiz', video_reference: 'video' }])[0].video_ref, 'video');
});
