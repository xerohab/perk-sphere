import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from "base44:runtime";
import { authorize, writeAudit } from '../../shared/permissions.ts';
import { encryptToken, sha256Hex } from '../../shared/oauth.ts';
import { generatePartnerKeyId, generatePartnerSecret } from '../../shared/partners.ts';

// Admin partner integration management. All writes go through this permission-checked
// function — the PartnerIntegration entity is write-locked for app users via RLS.
// Partner HMAC secrets are encrypted at rest (AES-GCM) in PartnerCredential and never
// stored in plaintext or exposed to the browser. New integrations default to Pending/Disabled.

const ACTION_PERMS = {
  create: 'partners.manage',
  update: 'partners.manage',
  delete: 'partners.manage',
  rotateCredential: 'partners.manage',
  revokeCredential: 'partners.manage',
  setStatus: 'partners.manage'
};

const SYSTEM_FIELDS = ['id', 'created_date', 'updated_date', 'created_by', 'created_by_id', 'is_sample', 'partner_key_id', 'partner_secret_hash', 'partner_secret'];

function clean(data) {
  const out = {};
  Object.keys(data || {}).forEach((k) => {
    if (SYSTEM_FIELDS.includes(k)) return;
    if (data[k] !== undefined) out[k] = data[k];
  });
  return out;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action, partnerId, data, status } = body;
    const perm = ACTION_PERMS[action];
    if (!perm) return Response.json({ error: 'Unknown action' }, { status: 400 });

    const auth = await authorize(base44, perm);
    if (auth.error) return auth.error;
    const { user } = auth;
    const admin = base44.asServiceRole;

    if (action === 'create') {
      const payload = clean(data);
      if (!payload.name) return Response.json({ error: 'Name is required' }, { status: 400 });
      if (!payload.partner_type) return Response.json({ error: 'Partner type is required' }, { status: 400 });
      // New integrations always default to Pending/Disabled — no reward-bearing activity until approved.
      payload.integration_status = 'pending';
      payload.active = false;
      payload.connection_health = 'unconfigured';
      payload.total_events_received = 0;
      payload.total_delivery_failures = 0;
      // Generate credentials
      const keyId = generatePartnerKeyId();
      const secret = generatePartnerSecret();
      payload.partner_key_id = keyId;
      payload.partner_secret_hash = await sha256Hex(secret);
      const record = await admin.entities.PartnerIntegration.create(payload);
      // Store encrypted credential
      const encKey = secrets.get('OAUTH_TOKEN_ENCRYPTION_KEY');
      if (encKey) {
        const { ciphertext, iv } = await encryptToken(secret, encKey);
        await admin.entities.PartnerCredential.create({
          partner_integration_id: record.id,
          encrypted_hmac_secret: ciphertext,
          hmac_secret_iv: iv,
          rotated_at: new Date().toISOString()
        });
      }
      await writeAudit(admin, { adminId: user.id, action: 'partner_created', entityType: 'PartnerIntegration', entityId: record.id, next: { name: record.name, partner_type: record.partner_type } });
      // Return the secret ONCE — it is never retrievable again.
      return Response.json({ ok: true, record, partner_key_id: keyId, partner_secret: secret });
    }

    if (!partnerId) return Response.json({ error: 'Missing partnerId' }, { status: 400 });

    if (action === 'update') {
      const before = await admin.entities.PartnerIntegration.get(partnerId);
      const payload = clean(data);
      const record = await admin.entities.PartnerIntegration.update(partnerId, payload);
      await writeAudit(admin, { adminId: user.id, action: 'partner_updated', entityType: 'PartnerIntegration', entityId: partnerId, previous: { name: before.name, integration_status: before.integration_status }, next: payload });
      return Response.json({ ok: true, record });
    }

    if (action === 'setStatus') {
      const before = await admin.entities.PartnerIntegration.get(partnerId);
      const validStatuses = ['pending', 'active', 'suspended', 'disabled', 'archived'];
      if (!validStatuses.includes(status)) return Response.json({ error: 'Invalid status' }, { status: 400 });
      const isActive = status === 'active';
      const record = await admin.entities.PartnerIntegration.update(partnerId, { integration_status: status, active: isActive });
      await writeAudit(admin, { adminId: user.id, action: 'partner_status_changed', entityType: 'PartnerIntegration', entityId: partnerId, previous: { integration_status: before.integration_status }, next: { integration_status: status } });
      return Response.json({ ok: true, record });
    }

    if (action === 'rotateCredential') {
      const before = await admin.entities.PartnerIntegration.get(partnerId);
      // Revoke all existing credentials
      const oldCreds = await admin.entities.PartnerCredential.filter({ partner_integration_id: partnerId });
      for (const c of (oldCreds || [])) {
        if (!c.revoked_at) {
          await admin.entities.PartnerCredential.update(c.id, { revoked_at: new Date().toISOString() });
        }
      }
      // Generate new credentials
      const keyId = generatePartnerKeyId();
      const secret = generatePartnerSecret();
      await admin.entities.PartnerIntegration.update(partnerId, { partner_key_id: keyId, partner_secret_hash: await sha256Hex(secret) });
      const encKey = secrets.get('OAUTH_TOKEN_ENCRYPTION_KEY');
      if (encKey) {
        const { ciphertext, iv } = await encryptToken(secret, encKey);
        await admin.entities.PartnerCredential.create({
          partner_integration_id: partnerId,
          encrypted_hmac_secret: ciphertext,
          hmac_secret_iv: iv,
          rotated_at: new Date().toISOString()
        });
      }
      await writeAudit(admin, { adminId: user.id, action: 'partner_credential_rotated', entityType: 'PartnerIntegration', entityId: partnerId, previous: { partner_key_id: before.partner_key_id } });
      return Response.json({ ok: true, partner_key_id: keyId, partner_secret: secret });
    }

    if (action === 'revokeCredential') {
      const creds = await admin.entities.PartnerCredential.filter({ partner_integration_id: partnerId });
      for (const c of (creds || [])) {
        if (!c.revoked_at) {
          await admin.entities.PartnerCredential.update(c.id, { revoked_at: new Date().toISOString() });
        }
      }
      await admin.entities.PartnerIntegration.update(partnerId, { integration_status: 'disabled', active: false });
      await writeAudit(admin, { adminId: user.id, action: 'partner_credential_revoked', entityType: 'PartnerIntegration', entityId: partnerId });
      return Response.json({ ok: true });
    }

    if (action === 'delete') {
      await admin.entities.PartnerIntegration.delete(partnerId);
      await writeAudit(admin, { adminId: user.id, action: 'partner_deleted', entityType: 'PartnerIntegration', entityId: partnerId });
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}