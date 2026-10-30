import './runtime-mocks.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, createHash } from 'node:crypto';
import { isValidLinuxPath } from '../base44/shared/linuxPath.ts';
import { linuxTrustedPost } from '../base44/shared/linuxClient.ts';
import { verifyTrustedRequest } from '../base44/shared/hmac.ts';
import { computePossessionSignature } from '../base44/shared/partnerSign.ts';
import { memberRequest, deriveActor } from '../base44/shared/perkSphereClient.ts';
import { canAssignRole, evaluateAccess } from '../base44/shared/permissions.ts';
import completeTask from '../base44/functions/completeTask/entry.ts';
import startTask from '../base44/functions/startTask/entry.ts';
import updateRedemption from '../base44/functions/updateRedemption/entry.ts';
const key = 'test-inbound';
const secret = 'test secret verbatim with spaces ';
globalThis.__testSecrets = { PERKSPHERE_LINUX_INBOUND_KEY_ID: key, PERKSPHERE_LINUX_INBOUND_HMAC_SECRET: secret };
const post = body => new Request('https://example.test/function', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
const request = (rawBody = '{"event":"test"}', options = {}) => {
  const timestamp = options.timestamp || String(Math.floor(Date.now() / 1000));
  const nonce = options.nonce || 'test-nonce-123456';
  const hash = createHash('sha256').update(rawBody).digest('hex');
  const signature = createHmac('sha256', secret).update(['POST', '/functions/trustedActivityBridge', timestamp, nonce, hash].join('\n')).digest('hex');
  return new Request('https://example.test/run/internal', { method: 'POST', body: options.body || rawBody, headers: { 'X-PS-Key-ID': key, 'X-PS-Timestamp': timestamp, 'X-PS-Nonce': nonce, 'X-PS-Signature': signature, ...options.headers } });
};
function nonceStore() {
  const rows = [];
  return { rows, entities: { TrustedApiNonce: { filter: async ({ key_id, nonce }) => rows.filter(r => r.key_id === key_id && r.nonce === nonce), create: async row => rows.push(row) } } };
}
test('Linux path validation rejects URL normalisation and authority tricks', () => {
  for (const path of ['/partners/activate', '/v1/perk-sphere/directory/list', '/v1/partner-links/confirm']) assert.equal(isValidLinuxPath(path), true);
  for (const path of ['//evil.test/partners/activate', '/partners/../events', '/partners/%2e%2e/events', '/partners/\\evil', '/partners/activate?x=y', '/partners/activate#x', '/partners//activate', 'https://evil.test', '/events', null]) assert.equal(isValidLinuxPath(path), false, String(path));
});
test('invalid outbound path is rejected before credentials or fetch', async () => {
  const result = await linuxTrustedPost('/partners/%2e%2e/events', {}); assert.equal(result.code, 'invalid_path');
});
test('HMAC accepts canonical body with verbatim secret and rejects sequential nonce replay', async () => {
  const store = nonceStore(); assert.equal((await verifyTrustedRequest(request(), store)).ok, true);
  assert.equal((await verifyTrustedRequest(request(), store)).code, 'replay_detected'); assert.equal(store.rows.length, 1);
});
test('HMAC rejects missing headers, unknown key, changed body, stale and invalid timestamps before nonce writes', async () => {
  const store = nonceStore();
  assert.equal((await verifyTrustedRequest(post({}), store)).code, 'missing_auth_headers');
  for (const [options, code] of [[{ headers: { 'X-PS-Key-ID': 'wrong' } }, 'unknown_key_id'], [{ body: '{"event":"changed"}' }, 'invalid_signature'], [{ timestamp: '1' }, 'stale_timestamp'], [{ timestamp: 'bad' }, 'invalid_timestamp'], [{ nonce: 'bad nonce' }, 'invalid_nonce']]) {
    assert.equal((await verifyTrustedRequest(request(undefined, options), store)).code, code);
  }
  assert.equal(store.rows.length, 0);
});
test('partner possession proof matches independent Node HMAC', async () => {
  const expected = createHmac('sha256', secret).update('PS-POSSESSION\nkey\nchallenge-id\nchallenge').digest('hex');
  assert.equal(await computePossessionSignature(secret, 'key', 'challenge-id', 'challenge'), expected);
});
test('member actor never inherits browser fields or arbitrary roles', async () => {
  assert.deepEqual(deriveActor({ id: 'member', role: 'super_admin' }), { user_reference: 'member', role: 'member' });
  const result = await memberRequest({ auth: { me: async () => ({ id: 'member', role: 'user' }) } }, '/v1/perk-sphere/quizzes/publish', { actor: { role: 'admin' } });
  assert.equal(result.status, 403);
});
test('staff permissions block escalation and restricted accounts', () => {
  assert.equal(canAssignRole('admin', 'super_admin'), false); assert.equal(canAssignRole('support', 'admin'), false);
  assert.equal(evaluateAccess({ role: 'user' }, null, 'rewards.manage').ok, false);
  assert.equal(evaluateAccess({ role: 'admin', account_status: 'banned' }, { permissions: ['rewards.manage'] }, 'rewards.manage').ok, false);
});
test('ordinary member cannot self-complete manual tasks or start hidden tasks', async () => {
  globalThis.__testClient = { auth: { me: async () => ({ id: 'member', role: 'user' }) }, asServiceRole: { entities: { Task: { get: async () => ({ id: 'task', verification_mode: 'manual', publicly_visible: false }) }, User: { get: async () => ({ id: 'member' }) } } } };
  assert.equal((await completeTask(post({ taskId: 'task' }))).status, 403);
  assert.equal((await startTask(post({ taskId: 'task' }))).status, 403);
});
test('redemption returned statuses cannot reopen, and repeated status does not write or notify', async () => {
  let writes = 0;
  globalThis.__testClient = { auth: { me: async () => ({ id: 'staff', role: 'admin' }) }, asServiceRole: { entities: {
    StaffMember: { filter: async () => [{ active: true, staff_role: 'support' }] },
    Redemption: { get: async () => ({ id: 'redemption', status: 'refunded' }), update: async () => { writes++; } }
  } } };
  assert.equal((await updateRedemption(post({ redemptionId: 'redemption', status: 'approved' }))).status, 400);
  assert.deepEqual(await (await updateRedemption(post({ redemptionId: 'redemption', status: 'refunded' }))).json(), { ok: true, unchanged: true });
  assert.equal(writes, 0);
});

test('partner-backed task cannot create browser-started watch progress', async () => {
  globalThis.__testClient = { auth: { me: async () => ({ id: 'member', role: 'user' }) }, asServiceRole: { entities: { Task: { get: async () => ({ id: 'task', task_type: 'watch_video', active: true, publicly_visible: true, verification_mode: 'client_assisted', reward_processing: 'linux_partner' }) }, get TaskProgress() { throw Error('MUST_NOT_CREATE_PROGRESS'); }, get WatchSession() { throw Error('MUST_NOT_CREATE_SESSION'); } } } };
  const response = await startTask(post({ taskId: 'task' }));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).pending_verification, true);
});
