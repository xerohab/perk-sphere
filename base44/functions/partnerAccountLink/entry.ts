import {requestPartnerLinkReward} from '../../shared/partnerLinkReward.ts';

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { sha256Hex } from '../../shared/oauth.ts';
import { sanitizePartnerForUser } from '../../shared/partners.ts';
import {
  linuxTrustedPost,
  LINUX_PARTNER_ENDPOINTS
} from '../../shared/linuxClient.ts';

const CHALLENGE_TTL_MINUTES = 10;
const LINK_STATUS_PATH = '/v1/partner-links/status';

function serviceKey(partnerId) {
  return `partner_${partnerId}`;
}

function validVerifiedLink(data) {
  return data?.ok === true &&
    data?.linked === true &&
    data?.status === 'verified' &&
    typeof data?.link_uuid === 'string' &&
    data.link_uuid.length > 0 &&
    typeof data?.partner_account_reference === 'string' &&
    data.partner_account_reference.length > 0;
}

async function getLinuxStatus(partner, userId) {
  if (!partner?.linux_api_partner_id) {
    return { ok: false, code: 'partner_not_provisioned' };
  }

  return linuxTrustedPost(LINK_STATUS_PATH, {
    partner_uuid: partner.linux_api_partner_id,
    user_reference: userId
  });
}

async function syncVerifiedPartner(admin, userId, partner, links, connected) {
  const result = await getLinuxStatus(partner, userId);

  // Never infer a connection when Linux is unavailable.
  if (!result.ok) {
    return { synced: false, unavailable: true };
  }

  const data = result.data || {};

  if (!validVerifiedLink(data)) {
    // Only an explicit, well-formed negative is an authoritative absence.
    // A malformed success response must remain unavailable, never verified.
    return { synced: false, unavailable: !(data.ok === true && data.linked === false) };
  }

  const now = new Date().toISOString();
  const linkedAt = data.verified_at
    ? new Date(data.verified_at).toISOString()
    : now;

  const accountReference = data.partner_account_reference;
  const key = serviceKey(partner.id);

  const existingConnection = connected.find(
    c => c.service === key
  );

  const connectionData = {
    user_id: userId,
    service: key,
    status: 'connected',
    account_handle: accountReference,
    external_account_id: data.link_uuid,
    provider_user_id: accountReference,
    connected_at: linkedAt
  };

  if (existingConnection) {
    await admin.entities.ConnectedService.update(
      existingConnection.id,
      connectionData
    );
    Object.assign(existingConnection, connectionData);
  } else {
    const created = await admin.entities.ConnectedService.create(
      connectionData
    );
    connected.push(created);
  }

  // Reconcile the latest pending record for this partner.
  // Linux confirms ownership by partner UUID + authenticated user ID.
  const pending = links
    .filter(l =>
      l.partner_integration_id === partner.id &&
      l.status === 'pending'
    )
    .sort((a, b) =>
      new Date(b.created_date || 0).getTime() -
      new Date(a.created_date || 0).getTime()
    );

  const alreadyLinked = links.some(l =>
    l.partner_integration_id === partner.id &&
    l.status === 'linked'
  );

  if (!alreadyLinked && pending.length > 0) {
    const selected = pending[0];

    const updateData = {
      status: 'linked',
      linked_at: linkedAt,
      partner_account_reference: accountReference
    };

    await admin.entities.PartnerAccountLink.update(
      selected.id,
      updateData
    );

    Object.assign(selected, updateData);
  }

  // A reward failure must never undo or misreport an independently verified link.
  let reward = {issued:false,reason:'link_reward_pending'};
  try { reward = await requestPartnerLinkReward(partner.linux_api_partner_id,userId); } catch (_) { /* retry on the next sync */ }
  return { synced: true, unavailable: false, reward };
}

async function perkSphereHandler(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action, partnerId } = body;
    const admin = base44.asServiceRole;

    let user;

    try {
      user = await base44.auth.me();
    } catch {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!user?.id) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (action === 'createChallenge') {
      if (!partnerId) {
        return Response.json(
          { error: 'Missing partnerId' },
          { status: 400 }
        );
      }

      const partner = await admin.entities.PartnerIntegration
        .get(partnerId)
        .catch(() => null);

      if (!partner) {
        return Response.json(
          { error: 'Partner not found' },
          { status: 404 }
        );
      }

      if (partner.integration_status !== 'active') {
        return Response.json(
          { error: 'Partner is not active for account linking' },
          { status: 400 }
        );
      }

      if (!partner.linux_api_partner_id) {
        return Response.json(
          { error: 'Partner is not provisioned for account linking' },
          { status: 400 }
        );
      }

      const existing = await admin.entities.ConnectedService.filter({
        user_id: user.id,
        service: serviceKey(partner.id)
      });

      const existingLinks = await admin.entities.PartnerAccountLink.filter({
        user_id: user.id,
        partner_integration_id: partner.id
      });

      // Check Linux before allowing a new challenge. This also
      // repairs connections confirmed before this function was updated.
      const statusResult = await getLinuxStatus(partner, user.id);

      if (!statusResult.ok) {
        return Response.json({
          error: 'Unable to verify existing account links. Please try again.',
          retry: true
        }, { status: 503 });
      }

      if (validVerifiedLink(statusResult.data)) {
        await syncVerifiedPartner(
          admin,
          user.id,
          partner,
          existingLinks || [],
          existing || []
        );

        return Response.json({
          error: 'You already have a linked account with this partner',
          already_linked: true
        }, { status: 409 });
      }

      // Never create a new challenge if a connected Base44
      // record exists but Linux does not confirm its state.
      if ((existing || []).some(c => c.status === 'connected')) {
        return Response.json({
          error: 'An existing connection requires verification before reconnecting.',
          retry: true
        }, { status: 409 });
      }

      const challengeResult = await linuxTrustedPost(
        LINUX_PARTNER_ENDPOINTS.ACCOUNT_LINK_CREATE,
        {
          partner_uuid: partner.linux_api_partner_id,
          user_reference: user.id
        }
      );

      if (!challengeResult.ok) {
        return Response.json({
          error: 'Account linking is temporarily unavailable.',
          code: challengeResult.code || 'linux_unavailable'
        }, { status: 503 });
      }

      const challengeData = challengeResult.data || {};
      const challenge =
        challengeData.challenge ?? challengeData.challenge_token;

      if (
        typeof challenge !== 'string' ||
        !/^[A-Za-z0-9_-]{43}$/.test(challenge)
      ) {
        return Response.json(
          { error: 'Failed to create challenge' },
          { status: 502 }
        );
      }

      const expiresAt = challengeData.expires_at ||
        new Date(
          Date.now() + CHALLENGE_TTL_MINUTES * 60000
        ).toISOString();

      const challengeHash = await sha256Hex(challenge);

      const link = await admin.entities.PartnerAccountLink.create({
        user_id: user.id,
        partner_integration_id: partner.id,
        partner_name: partner.name,
        challenge_hash: challengeHash,
        status: 'pending',
        expires_at: expiresAt
      });

      // Expire earlier Base44 pending entries only after the
      // new challenge has been successfully created.
      // Linux remains authoritative for their validity.
      for (const old of existingLinks || []) {
        if (old.status === 'pending') {
          await admin.entities.PartnerAccountLink.update(
            old.id,
            { status: 'expired' }
          );
        }
      }

      return Response.json({
        ok: true,
        user_reference: String(user.id),
        challenge_token: challenge,
        link_id: link.id,
        partner_name: partner.name,
        expires_at: expiresAt,
        instructions:
          'Enter this challenge in your partner account. ' +
          'It expires after 10 minutes.'
      });
    }

    if (action === 'listLinks') {
      const links = await admin.entities.PartnerAccountLink.filter({
        user_id: user.id
      });

      const connected = await admin.entities.ConnectedService.filter({
        user_id: user.id
      });

      const localLinks = links || [];
      const localConnected = connected || [];

      const partners = await admin.entities.PartnerIntegration.list(
        '-created_date',
        200
      );

      const eligiblePartners = (partners || []).filter(p =>
        p.integration_status === 'active' &&
        !!p.linux_api_partner_id
      );

      let syncUnavailable = false;
      const verification = {};

      // Check every active partner for an existing Linux-verified
      // account. This recovers links that Base44 missed previously.
      for (const partner of eligiblePartners) {
        const result = await syncVerifiedPartner(
          admin,
          user.id,
          partner,
          localLinks,
          localConnected
        );

        verification[partner.id] = result.unavailable ? 'unavailable' : result.synced ? 'verified' : 'not_linked';
        if (result.unavailable) {
          syncUnavailable = true;
        }
      }

      const sanitizedLinks = localLinks.map(l => ({
        id: l.id,
        partner_name: l.partner_name,
        partner_integration_id: l.partner_integration_id,
        status: l.status,
        linked_at: l.linked_at,
        partner_account_reference: l.partner_account_reference,
        expires_at: l.expires_at
      }));

      const sanitizedConnected = localConnected
        .filter(c => c.service?.startsWith('partner_'))
        .map(c => ({
          id: c.id,
          service: c.service,
          account_handle: c.account_handle,
          status: c.status,
          connected_at: c.connected_at
        }));

      return Response.json({
        ok: true,
        user_reference: String(user.id),
        links: sanitizedLinks,
        connected: sanitizedConnected,
        sync_unavailable: syncUnavailable,
        verification
      });
    }

    if (action === 'unlink') {
      const { connectedServiceId } = body;

      if (!connectedServiceId) {
        return Response.json(
          { error: 'Missing connectedServiceId' },
          { status: 400 }
        );
      }

      const conn = await admin.entities.ConnectedService
        .get(connectedServiceId)
        .catch(() => null);

      if (!conn || conn.user_id !== user.id) {
        return Response.json(
          { error: 'Not found' },
          { status: 404 }
        );
      }

      if (conn.service?.startsWith('partner_')) {
        const pid = conn.service.slice('partner_'.length);
        const partner = await admin.entities.PartnerIntegration
          .get(pid)
          .catch(() => null);

        if (!partner?.linux_api_partner_id) {
          return Response.json({
            error: 'Partner configuration unavailable. Cannot safely unlink.'
          }, { status: 503 });
        }

        const unlinkResult = await linuxTrustedPost(
          LINUX_PARTNER_ENDPOINTS.ACCOUNT_LINK_UNLINK,
          {
            partner_uuid: partner.linux_api_partner_id,
            user_reference: user.id
          }
        );

        if (!unlinkResult.ok) {
          return Response.json({
            error: 'Unlinking is temporarily unavailable.',
            code: unlinkResult.code || 'linux_unavailable',
            retry: true
          }, { status: 503 });
        }
      }

      await admin.entities.ConnectedService.update(
        connectedServiceId,
        {
          status: 'disconnected',
          revoked_at: new Date().toISOString()
        }
      );

      if (conn.service?.startsWith('partner_')) {
        const pid = conn.service.slice('partner_'.length);

        const linkedRecords = await admin.entities.PartnerAccountLink.filter({
          user_id: user.id,
          partner_integration_id: pid,
          status: 'linked'
        });

        for (const record of linkedRecords || []) {
          await admin.entities.PartnerAccountLink.update(
            record.id,
            {
              status: 'unlinked',
              unlinked_at: new Date().toISOString()
            }
          );
        }
      }

      return Response.json({ ok: true, user_reference: String(user.id) });
    }

    if (action === 'listPartners') {
      const partners = await admin.entities.PartnerIntegration.list(
        '-created_date',
        200
      );

      const available = (partners || []).filter(p =>
        p.integration_status === 'active' ||
        p.integration_status === 'setup_required' ||
        p.integration_status === 'linux_integration_pending'
      );

      return Response.json({
        ok: true,
        user_reference: String(user.id),
        partners: available.map(sanitizePartnerForUser)
      });
    }

    return Response.json(
      { error: 'Unknown action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('partnerAccountLink failed', {
      code: error?.code || 'unexpected_error'
    });

    return Response.json({
      error: 'Unable to process partner account linking.',
      retry: true
    }, { status: 500 });
  }
}
export default perkSphereHandler;
if (typeof Deno !== 'undefined') Deno.serve(perkSphereHandler);
