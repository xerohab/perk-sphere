import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { linuxTrustedPost } from '../../shared/linuxClient.ts';

// Authenticated bridge only. The Linux service owns pricing, stock and debits.
// This function never reads or modifies Base44 Points/XP balances.
export default async function (req: Request) {
  try {
    if (req.method !== 'POST') {
      return Response.json({ ok: false, error: 'method_not_allowed' }, { status: 405 });
    }
    const client = createClientFromRequest(req);
    const user = await client.auth.me().catch(() => null);
    if (!user?.id) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).sort().join(',') !== 'item_reference,quantity,request_reference' ||
        typeof body.item_reference !== 'string' ||
        !/^[A-Za-z0-9_:@.-]{1,191}$/.test(body.item_reference) ||
        typeof body.request_reference !== 'string' ||
        !/^[A-Za-z0-9_:@.-]{1,191}$/.test(body.request_reference) ||
        !Number.isSafeInteger(body.quantity) || body.quantity < 1 || body.quantity > 100) {
      return Response.json({ ok: false, error: 'invalid_redemption_request' }, { status: 400 });
    }
    const result = await linuxTrustedPost('/v1/perk-sphere/redemptions/redeem', {
      actor: { role: 'member', user_reference: String(user.id) },
      item_reference: body.item_reference,
      quantity: body.quantity,
      request_reference: body.request_reference
    });
    if (!result.ok) return Response.json(
      { ok: false, error: result.code || 'redemption_unavailable' },
      { status: result.status >= 400 && result.status <= 599 ? result.status : 503 }
    );
    return Response.json({ ok: true, data: result.data }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch {
    return Response.json({ ok: false, error: 'redemption_unavailable' }, { status: 503 });
  }
}
