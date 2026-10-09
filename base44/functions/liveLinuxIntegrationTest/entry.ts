import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { LINUX_API_BASE, LINUX_PARTNER_ENDPOINTS, linuxTrustedPost } from '../../shared/linuxClient.ts';
import { partnerProvisionRequest, saveLinuxProvisioning } from '../../shared/partnerProvisioning.ts';
import { partnerSignedPost, computeProofSignature, computeProofSignatureRaw, sha256Hex, hmacSha256Hex } from '../../shared/partnerSign.ts';
import { parseTarget, buildResult } from '../../shared/classify.ts';
import { ONBOARDING_STEPS } from '../../shared/partners.ts';

// Comprehensive live integration test. All HTTP calls go to the real Linux API
// at api.perksphere.org. No mocks. Admin-only. Disposable test partner is created,
// tested, revoked and deleted. No activation, no rewards, no legitimate records harmed.
export default async function(req) {
  const report = {
    test_type: 'LIVE (real HTTP to api.perksphere.org) + CODE (in-process logic)',
    started_at: new Date().toISOString(),
    base_url: LINUX_API_BASE,
    activation_attempted: false,
    rewards_issued: false
  };
  let admin, record, partnerKeyId, partnerSecret, linuxPartnerId, testUserId;
  const sensitive = [];
  const blockers = [];

  function safe(value) {
    let text = String(value || '');
    for (const s of sensitive) if (s) text = text.split(s).join('[REDACTED]');
    return text.replace(/\b[A-Za-z0-9+/_=-]{32,}\b/g, '[REDACTED]').slice(0, 600);
  }
  function summarize(result) {
    const local = ['network_error', 'server_misconfigured', 'linux_unreachable'].includes(result.code);
    return { http_status: local ? null : result.status, ok: result.ok, error_code: result.ok ? null : safe(result.code || result.error?.code), error_message: result.ok ? null : safe(result.error?.message || result.error || result.code), response_received: !local };
  }
  function live(label, data) { return { type: 'LIVE', label, ...data }; }
  function code(label, data) { return { type: 'CODE', label, ...data }; }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    admin = base44.asServiceRole;
    testUserId = user.id;
    const keyId = secrets.get('PERKSPHERE_LINUX_KEY_ID') || '';
    const hmacSecret = secrets.get('PERKSPHERE_LINUX_HMAC_SECRET') || '';
    const encKey = secrets.get('OAUTH_TOKEN_ENCRYPTION_KEY') || '';
    sensitive.push(keyId, keyId.trim(), hmacSecret, encKey);

    // ── 1. Existing inactive partner check ──────────────────────────────
    try {
      const existing = await admin.entities.PartnerIntegration.filter({ active: false }, { limit: 20, fields: ['name', 'integration_status', 'active', 'linux_api_partner_id', 'partner_key_id', 'created_date'] });
      const items = existing.items || [];
      report.existing_partners = live('Existing inactive partners in Base44 DB', {
        count: items.length,
        partners: items.map(p => ({ id: p.id, name: p.name, status: p.integration_status, active: p.active, has_linux_id: !!p.linux_api_partner_id, created: p.created_date?.slice(0, 10) }))
      });
    } catch (e) { report.existing_partners = { error: safe(e.message) }; }

    // ── 2. Health ────────────────────────────────────────────────────────
    try {
      const t0 = Date.now();
      const res = await fetch(LINUX_API_BASE + '/health', { method: 'GET', signal: AbortSignal.timeout(10000) });
      await res.text();
      report.health = live('GET /health', { http_status: res.status, elapsed_ms: Date.now() - t0, server_date: res.headers.get('date') });
    } catch (e) { report.health = live('GET /health', { http_status: null, error: safe(e.message) }); blockers.push('Health check failed: ' + safe(e.message)); }

    // ── 3. Provision disposable test partner ────────────────────────────
    const testName = 'DISPOSABLE FULL SUITE TEST ' + new Date().toISOString().slice(0, 19) + ' ' + crypto.randomUUID().slice(0, 8);
    record = await admin.entities.PartnerIntegration.create({
      name: testName, description: 'Disposable full-suite live test. Never activate. No rewards. Revoke and delete after.',
      partner_type: 'custom_website', integration_kit_type: 'universal_api', website_url: 'https://perksphere.org',
      verified_domains: ['perksphere.org'], supported_event_types: ['ACCOUNT_REGISTERED', 'STREAM_VIEW_PROGRESS', 'STREAM_ENDED'],
      integration_status: 'linux_integration_pending', verification_status: 'unverified', active: false,
      connection_health: 'unconfigured', points_per_event: 0, xp_per_event: 0, daily_points_limit: 0, daily_xp_limit: 0,
      proof_of_possession_verified: false, test_event_verified: false,
      setup_checklist: { base44_registered: true, credentials_generated: false, domain_verified: false, admin_reviewed: false, linux_api_configured: false, partner_implemented: false, proof_of_possession: false, test_event_verified: false, activated: false }
    });
    const provision = await linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.PROVISION, partnerProvisionRequest(record));
    report.provisioning = live('POST /partners/provision', summarize(provision));
    if (!provision.ok) { blockers.push('Provisioning failed: ' + safe(provision.code)); throw new Error('Provisioning failed'); }
    const provData = provision.data || {};
    partnerKeyId = provData.partner_key_id;
    partnerSecret = provData.partner_secret;
    linuxPartnerId = provData.partner_uuid;
    sensitive.push(partnerKeyId, partnerSecret, provData.domain_verification_token);
    report.provisioning.response_fields = { partner_uuid: !!linuxPartnerId, partner_key_id: !!partnerKeyId, partner_secret: !!partnerSecret, domain_verification_token: !!provData.domain_verification_token };
    await saveLinuxProvisioning(admin, record, provData);

    // ── 4. Domain verification (expect failure — no DNS TXT published) ──
    const domainResult = await linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.VERIFY_DOMAIN, { partner_uuid: linuxPartnerId });
    report.domain_verification = live('POST /partners/verify-domain', { ...summarize(domainResult), note: 'No DNS TXT record published for perksphere.org test domain. Expected to fail.' });

    // ── 5. Proof-of-possession ──────────────────────────────────────────
    try {
      const challengeRes = await linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.PROOF_CHALLENGE, { partner_uuid: linuxPartnerId });
      report.proof_challenge = live('POST /v1/partner-credentials/challenge', summarize(challengeRes));
      if (challengeRes.ok) {
        const chData = challengeRes.data || {};
        const challengeId = chData.challenge_id;
        const challenge = chData.challenge;
        const proofTimestamp = String(Math.floor(Date.now() / 1000));
        const proofNonce = crypto.randomUUID();
        const proofPath = LINUX_PARTNER_ENDPOINTS.PROOF_CONFIRM;

        // Try canonical format first.
        const sigCanonical = await computeProofSignature(partnerSecret, proofPath, proofTimestamp, proofNonce, challenge);
        const confirmRes = await linuxTrustedPost(proofPath, { partner_uuid: linuxPartnerId, challenge_id: challengeId, timestamp: proofTimestamp, nonce: proofNonce, signature: sigCanonical });
        report.proof_confirm_canonical = live('POST /v1/partner-credentials/confirm (canonical format)', summarize(confirmRes));

        if (!confirmRes.ok) {
          // Try raw challenge format with a new challenge.
          const ch2 = await linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.PROOF_CHALLENGE, { partner_uuid: linuxPartnerId });
          if (ch2.ok) {
            const ch2Data = ch2.data || {};
            const sigRaw = await computeProofSignatureRaw(partnerSecret, ch2Data.challenge);
            const ts2 = String(Math.floor(Date.now() / 1000));
            const nc2 = crypto.randomUUID();
            const confirmRaw = await linuxTrustedPost(proofPath, { partner_uuid: linuxPartnerId, challenge_id: ch2Data.challenge_id, timestamp: ts2, nonce: nc2, signature: sigRaw });
            report.proof_confirm_raw = live('POST /v1/partner-credentials/confirm (raw challenge format)', summarize(confirmRaw));
          }
        } else {
          // Test replay — same challenge_id should be rejected.
          const replayRes = await linuxTrustedPost(proofPath, { partner_uuid: linuxPartnerId, challenge_id: challengeId, timestamp: proofTimestamp, nonce: crypto.randomUUID(), signature: sigCanonical });
          report.proof_replay = live('POST /v1/partner-credentials/confirm (replay same challenge_id)', { ...summarize(replayRes), replay_rejected: !replayRes.ok });
        }
      } else { blockers.push('Proof challenge creation failed: ' + safe(challengeRes.code)); }
    } catch (e) { report.proof_of_possession_error = safe(e.message); }

    // ── 6. Account-link ──────────────────────────────────────────────────
    try {
      const linkChRes = await linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.ACCOUNT_LINK_CREATE, { partner_uuid: linuxPartnerId, user_reference: testUserId });
      report.account_link_challenge = live('POST /v1/partner-links/create-challenge', summarize(linkChRes));
      if (linkChRes.ok) {
        const linkChData = linkChRes.data || {};
        const challengeToken = linkChData.challenge_token;
        sensitive.push(challengeToken);

        // Create PartnerAccountLink in Base44 so the bridge can match it.
        const challengeHash = await sha256Hex(challengeToken);
        const linkRecord = await admin.entities.PartnerAccountLink.create({
          user_id: testUserId, partner_integration_id: record.id, partner_name: testName,
          challenge_hash: challengeHash, challenge_token: challengeToken,
          status: 'pending', expires_at: new Date(Date.now() + 600000).toISOString()
        });

        // Confirm as partner (partner HMAC auth).
        const confirmRes = await partnerSignedPost(LINUX_PARTNER_ENDPOINTS.ACCOUNT_LINK_CONFIRM, { challenge_token: challengeToken, partner_account_reference: 'test_account_ref_' + crypto.randomUUID().slice(0, 8) }, partnerKeyId, partnerSecret);
        report.account_link_confirm = live('POST /v1/partner-links/confirm (partner-authenticated)', summarize(confirmRes));

        // Invalid challenge — fake token.
        const invalidRes = await partnerSignedPost(LINUX_PARTNER_ENDPOINTS.ACCOUNT_LINK_CONFIRM, { challenge_token: 'al_invalid_fake_token_not_real', partner_account_reference: 'test_invalid' }, partnerKeyId, partnerSecret);
        report.account_link_invalid = live('POST /v1/partner-links/confirm (invalid challenge)', { ...summarize(invalidRes), invalid_rejected: !invalidRes.ok });

        // Reused challenge — same token again.
        const reusedRes = await partnerSignedPost(LINUX_PARTNER_ENDPOINTS.ACCOUNT_LINK_CONFIRM, { challenge_token: challengeToken, partner_account_reference: 'test_reused' }, partnerKeyId, partnerSecret);
        report.account_link_reused = live('POST /v1/partner-links/confirm (reused challenge)', { ...summarize(reusedRes), reused_rejected: !reusedRes.ok });

        // Wait for bridge to process PARTNER_LINK_CONFIRMED notification.
        await new Promise(r => setTimeout(r, 3000));
        const csPage = await admin.entities.ConnectedService.filter({ user_id: testUserId, service: 'partner_' + record.id }, { limit: 1 });
        report.account_link_bridge = live('Bridge PARTNER_LINK_CONFIRMED processing', { connected_service_created: (csPage.items || []).length > 0, count: (csPage.items || []).length });

        // Unlink.
        const unlinkRes = await linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.ACCOUNT_LINK_UNLINK, { partner_uuid: linuxPartnerId, user_reference: testUserId });
        report.account_link_unlink = live('POST /partners/account-link/unlink', summarize(unlinkRes));

        // Clean up link record and connected service.
        await admin.entities.PartnerAccountLink.deleteMany({ id: linkRecord.id });
        if ((csPage.items || []).length > 0) await admin.entities.ConnectedService.deleteMany({ id: csPage.items[0].id });
      } else { blockers.push('Account-link challenge creation failed: ' + safe(linkChRes.code)); }
    } catch (e) { report.account_link_error = safe(e.message); }

    // ── 7. Event ingestion ───────────────────────────────────────────────
    try {
      const eventId = 'evt_live_test_' + crypto.randomUUID().slice(0, 12);
      const eventBody = {
        external_event_id: eventId, event_type: 'ACCOUNT_REGISTERED', user_reference: testUserId,
        task_id: 'nonexistent_task_for_test', source_timestamp: new Date().toISOString(), metadata: { test: true }
      };
      const eventRes = await partnerSignedPost('/events', eventBody, partnerKeyId, partnerSecret);
      report.event_ingestion = live('POST /events (partner-authenticated)', summarize(eventRes));

      // Duplicate — same external_event_id.
      const dupRes = await partnerSignedPost('/events', eventBody, partnerKeyId, partnerSecret);
      report.event_duplicate = live('POST /events (duplicate external_event_id)', { ...summarize(dupRes), duplicate_rejected: !dupRes.ok });

      // Wait for Linux to forward to bridge.
      await new Promise(r => setTimeout(r, 3000));
      const bridgePage = await admin.entities.TrustedActivityEvent.filter({ external_event_id: eventId }, { limit: 1 });
      const bridgeEvent = (bridgePage.items || [])[0];
      report.event_bridge_forwarded = live('Bridge received forwarded event', {
        received: !!bridgeEvent, processing_status: bridgeEvent?.processing_status || 'not_received',
        completion_triggered: bridgeEvent?.completion_triggered || false, error_code: bridgeEvent?.error_code || null
      });

      // Verify no Points/XP awarded.
      const pointsPage = await admin.entities.PointsTransaction.filter({ user_id: testUserId, created_date: { $gte: report.started_at.slice(0, 10) } }, { limit: 5, fields: ['id', 'reason', 'points_amount', 'created_date'] });
      const xpPage = await admin.entities.XpTransaction.filter({ user_id: testUserId, created_date: { $gte: report.started_at.slice(0, 10) } }, { limit: 5, fields: ['id', 'reason', 'xp_amount', 'created_date'] });
      report.no_direct_rewards = live('No Points/XP from partner event', {
        points_transactions_for_test_user: pointsPage.items?.length || 0,
        xp_transactions_for_test_user: xpPage.items?.length || 0,
        no_rewards_issued: (pointsPage.items?.length || 0) === 0 && (xpPage.items?.length || 0) === 0
      });
      // Clean up bridge event if created.
      if (bridgeEvent) await admin.entities.TrustedActivityEvent.deleteMany({ id: bridgeEvent.id });
    } catch (e) { report.event_ingestion_error = safe(e.message); }

    // ── 8. Activation blocking (CODE test) ───────────────────────────────
    try {
      const fresh = await admin.entities.PartnerIntegration.get(record.id);
      const cl = fresh.setup_checklist || {};
      const stepsComplete = ONBOARDING_STEPS.filter(s => s.key !== 'activated').every(s => cl[s.key]);
      const canActivate = stepsComplete && !!fresh.domain_verified_at && !!fresh.proof_of_possession_verified && !!cl.admin_reviewed && !!fresh.linux_api_partner_id;
      report.activation_blocking = code('Activation prerequisite check', {
        onboarding_complete: stepsComplete,
        domain_verified: !!fresh.domain_verified_at,
        proof_verified: !!fresh.proof_of_possession_verified,
        admin_reviewed: !!cl.admin_reviewed,
        has_linux_partner_id: !!fresh.linux_api_partner_id,
        activation_would_be_blocked: !canActivate,
        note: 'Activation requires all 8 onboarding steps + domain verified + proof verified + admin reviewed + Linux partner ID. Test partner has none of these.'
      });
    } catch (e) { report.activation_blocking = { error: safe(e.message) }; }

    // ── 9. YouTube zero-reward (CODE test) ──────────────────────────────
    try {
      const ytTarget = parseTarget({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
      const ytResult = buildResult(ytTarget, [], []);
      const normalTarget = parseTarget({ url: 'https://perksphere.org' });
      const normalResult = buildResult(normalTarget, [], []);
      report.youtube_zero_reward = code('YouTube classification (classify.ts)', {
        youtube_platform: ytResult.target?.platform,
        youtube_classification: ytResult.classification,
        youtube_points_eligible: ytResult.points_eligible,
        youtube_xp_eligible: ytResult.xp_eligible,
        youtube_tracking_enabled: ytResult.tracking_enabled,
        control_platform: normalResult.target?.platform,
        control_classification: normalResult.classification,
        note: 'YouTube always returns disallowed with 0 points/XP regardless of admin configuration.'
      });
    } catch (e) { report.youtube_zero_reward = { error: safe(e.message) }; }

    // ── 10. Chromium extension release ──────────────────────────────────
    try {
      const t0 = Date.now();
      const res = await fetch(LINUX_API_BASE + '/v1/extension/releases/chromium', { signal: AbortSignal.timeout(10000) });
      const json = await res.json().catch(() => null);
      report.extension_release = live('GET /v1/extension/releases/chromium', {
        http_status: res.status, elapsed_ms: Date.now() - t0,
        has_data: !!(json && json.ok && json.data),
        version: json?.data?.version || null,
        channel: json?.data?.channel || null,
        download_host_valid: json?.data?.download_url ? (() => { try { return new URL(json.data.download_url).hostname === 'api.perksphere.org'; } catch { return false; } })() : null
      });
    } catch (e) { report.extension_release = live('GET /v1/extension/releases/chromium', { http_status: null, error: safe(e.message) }); }

  } catch (error) {
    report.application_error = { name: safe(error.name), message: safe(error.message) };
  } finally {
    // ── Cleanup ─────────────────────────────────────────────────────────
    if (record && admin) {
      try {
        if (linuxPartnerId) {
          const revoked = await linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.REVOKE, { partner_uuid: linuxPartnerId });
          report.revocation = live('POST /partners/revoke', summarize(revoked));
        }
        await admin.entities.PartnerCredential.deleteMany({ partner_integration_id: record.id });
        await admin.entities.PartnerAccountLink.deleteMany({ partner_integration_id: record.id });
        await admin.entities.ConnectedService.deleteMany({ user_id: testUserId, service: 'partner_' + record.id });
        await admin.entities.PartnerIntegration.delete(record.id);
        const [remainingP, remainingC] = await Promise.all([
          admin.entities.PartnerIntegration.count({ id: record.id }),
          admin.entities.PartnerCredential.count({ partner_integration_id: record.id })
        ]);
        report.cleanup = { partner_removed: remainingP === 0, credentials_removed: remainingC === 0 };
      } catch (e) { report.cleanup = { error: safe(e.message) }; }
    }
  }

  report.blockers = blockers;
  report.finished_at = new Date().toISOString();
  return Response.json(report);
}