import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { linuxTrustedPost } from '../../shared/linuxClient.ts';

// Read-only bridge. Linux remains authoritative; never fall back to Base44
// cached balances if the ledger is unavailable or not yet migrated.
async function perkSphereHandler(req: Request) {
  try {
    const client = createClientFromRequest(req);
    const user = await client.auth.me().catch(() => null);
    if (!user?.id) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
    const result = await linuxTrustedPost('/v1/perk-sphere/ledger/balance', {
      actor: { role: 'member', user_reference: String(user.id) }
    });
    if (!result.ok) {
      return Response.json(
        { ok: false, error: result.code || 'ledger_unavailable' },
        { status: result.status >= 400 && result.status <= 599 ? result.status : 503 }
      );
    }
    return Response.json({ ok: true, data: result.data || null }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (_error) {
    return Response.json({ ok: false, error: 'ledger_unavailable' }, { status: 503 });
  }
}
export default perkSphereHandler;
if (typeof Deno !== 'undefined') Deno.serve(perkSphereHandler);
