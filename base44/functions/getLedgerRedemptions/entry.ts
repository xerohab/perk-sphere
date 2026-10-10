import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { linuxTrustedPost } from '../../shared/linuxClient.ts';

export default async function (req: Request) {
  try {
    if (req.method !== 'POST') {
      return Response.json({ ok: false, error: 'method_not_allowed' }, { status: 405 });
    }
    const client = createClientFromRequest(req);
    const user = await client.auth.me().catch(() => null);
    if (!user?.id) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
    const result = await linuxTrustedPost('/v1/perk-sphere/redemptions/history', {
      actor: { role: 'member', user_reference: String(user.id) }
    });
    if (!result.ok) {
      return Response.json({ ok: false, error: result.code || 'redemption_history_unavailable' },
        { status: result.status >= 400 && result.status <= 599 ? result.status : 503 });
    }
    return Response.json({ ok: true, data: result.data || [] }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch {
    return Response.json({ ok: false, error: 'redemption_history_unavailable' }, { status: 503 });
  }
}
