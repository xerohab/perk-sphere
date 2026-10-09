import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { LINUX_API_BASE, LINUX_PARTNER_ENDPOINTS, linuxTrustedPost } from '../../shared/linuxClient.ts';
import { partnerProvisionRequest, saveLinuxProvisioning } from '../../shared/partnerProvisioning.ts';
import { partnerSignedPost, computeProofSignature, computeProofSignatureRaw, sha256Hex, hmacSha256Hex } from '../../shared/partnerSign.ts';
import { parseTarget, buildResult } from '../../shared/classify.ts';
import { ONBOARDING_STEPS } from '../../shared/partners.ts';

// Comprehensive live integration test — compact response to avoid truncation.
// All HTTP calls go to the real Linux API. No mocks. Admin-only.
export default async function(req) {
  const R = { ts: new Date().toISOString(), base: LINUX_API_BASE, act: false, rew: false };
  let admin, record, pk, ps, lpid, uid;
  const sens = [];
  const blk = [];
  const redact = (v) => { let t = String(v||''); for (const s of sens) if (s) t = t.split(s).join('*'); return t.slice(0, 300); };
  const L = (l, d) => ({ t: 'LIVE', l, ...d });
  const C = (l, d) => ({ t: 'CODE', l, ...d });

  // Raw fetch with full response capture for debugging.
  async function rawPost(path, body, authHeaders) {
    const rawBody = JSON.stringify(body);
    let res;
    try {
      res = await fetch(LINUX_API_BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders }, body: rawBody, signal: AbortSignal.timeout(10000) });
    } catch (e) { return { st: 0, err: String(e.message || e) }; }
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = null; }
    return { st: res.status, ok: res.ok, data: json?.data || null, err: json?.error || null, raw: redact(text).slice(0, 200) };
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    admin = base44.asServiceRole;
    uid = user.id;
    const keyId = secrets.get('PERKSPHERE_LINUX_KEY_ID') || '';
    const hmacSecret = secrets.get('PERKSPHERE_LINUX_HMAC_SECRET') || '';
    const encKey = secrets.get('OAUTH_TOKEN_ENCRYPTION_KEY') || '';
    sens.push(keyId, keyId.trim(), hmacSecret, encKey);

    // 1. Existing partners
    try {
      const ex = await admin.entities.PartnerIntegration.filter({ active: false }, { limit: 20, fields: ['name', 'integration_status', 'linux_api_partner_id', 'created_date'] });
      R.p1 = L('Existing inactive partners', { n: ex.items?.length || 0, names: (ex.items||[]).map(p => p.name) });
    } catch (e) { R.p1 = { err: redact(e.message) }; }

    // 2. Health
    try {
      const t0 = Date.now();
      const res = await fetch(LINUX_API_BASE + '/health', { signal: AbortSignal.timeout(10000) });
      await res.text();
      R.p2 = L('GET /health', { st: res.status, ms: Date.now()-t0 });
    } catch (e) { R.p2 = L('GET /health', { st: 0, err: redact(e.message) }); blk.push('Health failed'); }

    // 3. Provision
    const tn = 'DISPOSABLE FULL SUITE ' + crypto.randomUUID().slice(0, 8);
    record = await admin.entities.PartnerIntegration.create({
      name: tn, description: 'Disposable full-suite live test', partner_type: 'custom_website', integration_kit_type: 'universal_api',
      website_url: 'https://perksphere.org', verified_domains: ['perksphere.org'],
      supported_event_types: ['ACCOUNT_REGISTERED', 'STREAM_VIEW_PROGRESS', 'STREAM_ENDED'],
      integration_status: 'linux_integration_pending', verification_status: 'unverified', active: false,
      connection_health: 'unconfigured', points_per_event: 0, xp_per_event: 0, daily_points_limit: 0, daily_xp_limit: 0,
      proof_of_possession_verified: false, test_event_verified: false,
      setup_checklist: { base44_registered: true, credentials_generated: false, domain_verified: false, admin_reviewed: false, linux_api_configured: false, partner_implemented: false, proof_of_possession: false, test_event_verified: false, activated: false }
    });
    const prov = await linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.PROVISION, partnerProvisionRequest(record));
    if (!prov.ok) { blk.push('Provision failed: ' + prov.code); throw new Error('Provision failed'); }
    const pd = prov.data || {};
    pk = pd.partner_key_id; ps = pd.partner_secret; lpid = pd.partner_uuid;
    sens.push(pk, ps, pd.domain_verification_token);
    R.p3 = L('POST /partners/provision', { st: prov.status, ok: prov.ok, f: { uuid: !!lpid, key: !!pk, secret: !!ps, dvt: !!pd.domain_verification_token } });
    await saveLinuxProvisioning(admin, record, pd);
    // Small delay to let Linux commit the new partner.
    await new Promise(r => setTimeout(r, 1500));

    // 4. Domain verification (expect failure — no DNS TXT)
    const dv = await linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.VERIFY_DOMAIN, { partner_uuid: lpid });
    R.p4 = L('verify-domain', { st: dv.status, ok: dv.ok, ec: dv.ok ? null : dv.code, note: 'No DNS TXT. Expected fail.' });

    // 5. Proof-of-possession — capture raw response for debugging
    try {
      const ch = await linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.PROOF_CHALLENGE, { partner_uuid: lpid });
      R.p5a = L('proof-challenge', { st: ch.status, ok: ch.ok, ec: ch.ok ? null : ch.code, uuid_ok: lpid?.length === 36 });
      if (ch.ok) {
        const cd = ch.data || {};
        const cid = cd.challenge_id, chal = cd.challenge;
        const ts = String(Math.floor(Date.now()/1000)), nc = crypto.randomUUID();
        const path = LINUX_PARTNER_ENDPOINTS.PROOF_CONFIRM;
        // Try canonical format
        const sig1 = await computeProofSignature(ps, path, ts, nc, chal);
        const cf1 = await linuxTrustedPost(path, { partner_uuid: lpid, challenge_id: cid, timestamp: ts, nonce: nc, signature: sig1 });
        R.p5b = L('confirm (canonical)', { st: cf1.status, ok: cf1.ok, ec: cf1.ok ? null : cf1.code, em: cf1.ok ? null : redact(cf1.error) });
        if (!cf1.ok) {
          // Try raw challenge format with new challenge
          const ch2 = await linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.PROOF_CHALLENGE, { partner_uuid: lpid });
          if (ch2.ok) {
            const cd2 = ch2.data || {};
            const sig2 = await computeProofSignatureRaw(ps, cd2.challenge);
            const ts2 = String(Math.floor(Date.now()/1000)), nc2 = crypto.randomUUID();
            const cf2 = await linuxTrustedPost(path, { partner_uuid: lpid, challenge_id: cd2.challenge_id, timestamp: ts2, nonce: nc2, signature: sig2 });
            R.p5c = L('confirm (raw challenge)', { st: cf2.status, ok: cf2.ok, ec: cf2.ok ? null : cf2.code, em: cf2.ok ? null : redact(cf2.error) });
            if (cf2.ok) {
              // Replay test
              const cf3 = await linuxTrustedPost(path, { partner_uuid: lpid, challenge_id: cd2.challenge_id, timestamp: ts2, nonce: crypto.randomUUID(), signature: sig2 });
              R.p5d = L('confirm (replay)', { st: cf3.status, ok: cf3.ok, rejected: !cf3.ok, ec: cf3.ok ? null : cf3.code });
            }
          }
        } else {
          // Replay test (canonical succeeded)
          const cf3 = await linuxTrustedPost(path, { partner_uuid: lpid, challenge_id: cid, timestamp: ts, nonce: crypto.randomUUID(), signature: sig1 });
          R.p5d = L('confirm (replay)', { st: cf3.status, ok: cf3.ok, rejected: !cf3.ok, ec: cf3.ok ? null : cf3.code });
        }
      } else { blk.push('Proof challenge failed: ' + ch.code); }
    } catch (e) { R.p5err = redact(e.message); }

    // 6. Account-link
    try {
      const lc = await linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.ACCOUNT_LINK_CREATE, { partner_uuid: lpid, user_reference: uid });
      R.p6a = L('link-create-challenge', { st: lc.status, ok: lc.ok, ec: lc.ok ? null : lc.code, em: lc.ok ? null : redact(lc.error) });
      if (lc.ok) {
        const lcd = lc.data || {};
        const ct = lcd.challenge_token;
        sens.push(ct);
        const chHash = await sha256Hex(ct);
        const link = await admin.entities.PartnerAccountLink.create({ user_id: uid, partner_integration_id: record.id, partner_name: tn, challenge_hash: chHash, status: 'pending', expires_at: new Date(Date.now()+600000).toISOString() });
        // Confirm as partner
        const cf = await partnerSignedPost(LINUX_PARTNER_ENDPOINTS.ACCOUNT_LINK_CONFIRM, { challenge_token: ct, partner_account_reference: 'test_ref_' + crypto.randomUUID().slice(0,8) }, pk, ps);
        R.p6b = L('POST /v1/partner-links/confirm (partner auth)', { st: cf.status, ok: cf.ok, ec: cf.ok ? null : cf.code, em: cf.ok ? null : redact(cf.error) });
        // Invalid challenge
        const inv = await partnerSignedPost(LINUX_PARTNER_ENDPOINTS.ACCOUNT_LINK_CONFIRM, { challenge_token: 'al_invalid_fake', partner_account_reference: 'test_inv' }, pk, ps);
        R.p6c = L('confirm (invalid challenge)', { st: inv.status, ok: inv.ok, rejected: !inv.ok, ec: inv.ok ? null : inv.code, em: inv.ok ? null : redact(inv.error) });
        // Reused challenge
        const ru = await partnerSignedPost(LINUX_PARTNER_ENDPOINTS.ACCOUNT_LINK_CONFIRM, { challenge_token: ct, partner_account_reference: 'test_ru' }, pk, ps);
        R.p6d = L('confirm (reused challenge)', { st: ru.status, ok: ru.ok, rejected: !ru.ok, ec: ru.ok ? null : ru.code, em: ru.ok ? null : redact(ru.error) });
        // Wait for bridge
        await new Promise(r => setTimeout(r, 3000));
        const cs = await admin.entities.ConnectedService.filter({ user_id: uid, service: 'partner_' + record.id }, { limit: 1 });
        R.p6e = L('Bridge PARTNER_LINK_CONFIRMED', { cs_created: (cs.items||[]).length > 0, n: (cs.items||[]).length });
        // Unlink
        const ul = await linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.ACCOUNT_LINK_UNLINK, { partner_uuid: lpid, user_reference: uid });
        R.p6f = L('POST /partners/account-link/unlink', { st: ul.status, ok: ul.ok, ec: ul.ok ? null : ul.code });
        // Cleanup
        await admin.entities.PartnerAccountLink.deleteMany({ id: link.id });
        if ((cs.items||[]).length > 0) await admin.entities.ConnectedService.deleteMany({ id: cs.items[0].id });
      } else { blk.push('Account-link challenge failed: ' + lc.code); }
    } catch (e) { R.p6err = redact(e.message); }

    // 7. Event ingestion
    try {
      const eid = 'evt_test_' + crypto.randomUUID().slice(0, 12);
      const eb = { external_event_id: eid, event_type: 'ACCOUNT_REGISTERED', user_reference: uid, task_id: 'nonexistent_test_task', is_test: true, source_timestamp: new Date().toISOString(), metadata: { test: true } };
      const ev = await partnerSignedPost('/events', eb, pk, ps);
      R.p7a = L('Linux /events', { st: ev.status, ok: ev.ok, ec: ev.ok ? null : ev.code });
      // Also test Base44 migration endpoint to verify signing is correct
      try {
        const b44Path = '/functions/partnerEventIngest';
        const b44Body = JSON.stringify({ external_event_id: 'evt_b44_test_' + crypto.randomUUID().slice(0,8), event_type: 'ACCOUNT_REGISTERED', user_reference: uid, task_id: 'nonexistent_test', is_test: true, source_timestamp: new Date().toISOString(), metadata: { test: true } });
        const tsB = String(Math.floor(Date.now()/1000)), ncB = crypto.randomUUID();
        const bhB = await sha256Hex(b44Body);
        const canonB = ['POST', b44Path, tsB, ncB, bhB].join('\n');
        const sigB = await hmacSha256Hex(ps, canonB);
        const b44Res = await fetch('https://perk-sphere-hub.base44.app' + b44Path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-PS-Partner-Key': pk, 'X-PS-Timestamp': tsB, 'X-PS-Nonce': ncB, 'X-PS-Signature': sigB }, body: b44Body, signal: AbortSignal.timeout(10000) });
        const b44Data = await b44Res.json().catch(() => null);
        R.p7a2 = L('Base44 migration endpoint (partner auth)', { st: b44Res.status, ok: b44Res.ok, ec: b44Data?.error?.code || null, note: 'Proves signing correct' });
        // Clean up migration event if created
        if (b44Res.ok) {
          const me = await admin.entities.PartnerEvent.filter({ partner_integration_id: record.id }, { limit: 5, sort: '-created_date' });
          for (const e of (me.items||[])) { if (e.is_test_event) await admin.entities.PartnerEvent.deleteMany({ id: e.id }); }
        }
      } catch (e) { R.p7a2 = { err: redact(e.message) }; }
      // Duplicate (same 401 expected since auth fails)
      const du = await partnerSignedPost('/events', eb, pk, ps);
      R.p7b = L('POST /events (dup)', { st: du.status, ok: du.ok, rej: !du.ok });
      // Wait for bridge forward
      await new Promise(r => setTimeout(r, 3000));
      const be = await admin.entities.TrustedActivityEvent.filter({ external_event_id: eid }, { limit: 1 });
      const bev = (be.items||[])[0];
      R.p7c = L('Bridge recv', { recv: !!bev, ps: bev?.processing_status || 'none' });
      // No rewards check
      const pt = await admin.entities.PointsTransaction.filter({ user_id: uid }, { limit: 3, sort: '-created_date', fields: ['created_date'] });
      const xt = await admin.entities.XpTransaction.filter({ user_id: uid }, { limit: 3, sort: '-created_date', fields: ['created_date'] });
      const recentPts = (pt.items||[]).filter(p => p.created_date >= R.ts);
      const recentXp = (xt.items||[]).filter(p => p.created_date >= R.ts);
      R.p7d = L('No direct rewards', { pts: recentPts.length, xp: recentXp.length, ok: recentPts.length === 0 && recentXp.length === 0 });
      if (bev) await admin.entities.TrustedActivityEvent.deleteMany({ id: bev.id });
    } catch (e) { R.p7err = redact(e.message); }

    // 8. Activation blocking (CODE)
    try {
      const fr = await admin.entities.PartnerIntegration.get(record.id);
      const cl = fr.setup_checklist || {};
      const stepsOk = ONBOARDING_STEPS.filter(s => s.key !== 'activated').every(s => cl[s.key]);
      const canAct = stepsOk && !!fr.domain_verified_at && !!fr.proof_of_possession_verified && !!cl.admin_reviewed && !!fr.linux_api_partner_id;
      R.p8 = C('Activation blocking', { steps: stepsOk, dv: !!fr.domain_verified_at, pv: !!fr.proof_of_possession_verified, ar: !!cl.admin_reviewed, lid: !!fr.linux_api_partner_id, blocked: !canAct });
    } catch (e) { R.p8 = { err: redact(e.message) }; }

    // 9. YouTube zero-reward (CODE)
    try {
      const yt = buildResult(parseTarget({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }), [], []);
      const nm = buildResult(parseTarget({ url: 'https://perksphere.org' }), [], []);
      R.p9 = C('YouTube zero-reward', { yt_plat: yt.target?.platform, yt_cls: yt.classification, yt_pts: yt.points_eligible, yt_xp: yt.xp_eligible, yt_trk: yt.tracking_enabled, ctrl_cls: nm.classification });
    } catch (e) { R.p9 = { err: redact(e.message) }; }

    // 10. Extension release
    try {
      const t0 = Date.now();
      const res = await fetch(LINUX_API_BASE + '/v1/extension/releases/chromium', { signal: AbortSignal.timeout(10000) });
      const j = await res.json().catch(() => null);
      R.p10 = L('GET /v1/extension/releases/chromium', { st: res.status, ms: Date.now()-t0, ok: !!(j?.ok && j?.data), ver: j?.data?.version || null, ch: j?.data?.channel || null, dl_ok: j?.data?.download_url ? (() => { try { return new URL(j.data.download_url).hostname === 'api.perksphere.org'; } catch { return false; } })() : null });
    } catch (e) { R.p10 = L('GET /v1/extension/releases/chromium', { st: 0, err: redact(e.message) }); }

  } catch (error) {
    R.err = { name: redact(error.name), msg: redact(error.message) };
  } finally {
    // Cleanup
    if (record && admin) {
      try {
        if (lpid) { const rv = await linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.REVOKE, { partner_uuid: lpid }); R.rev = { st: rv.status, ok: rv.ok }; }
        await admin.entities.PartnerCredential.deleteMany({ partner_integration_id: record.id });
        await admin.entities.PartnerAccountLink.deleteMany({ partner_integration_id: record.id });
        await admin.entities.ConnectedService.deleteMany({ user_id: uid, service: 'partner_' + record.id });
        await admin.entities.PartnerIntegration.delete(record.id);
        const [rp, rc] = await Promise.all([admin.entities.PartnerIntegration.count({ id: record.id }), admin.entities.PartnerCredential.count({ partner_integration_id: record.id })]);
        R.cleanup = { partner: rp === 0, creds: rc === 0 };
      } catch (e) { R.cleanup = { err: redact(e.message) }; }
    }
  }

  R.blk = blk;
  R.end = new Date().toISOString();
  return Response.json(R);
}