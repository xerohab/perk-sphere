import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { isProviderConfigured, ALLOWED_PROVIDERS } from '../../shared/oauth.ts';

// Read-only provider configuration status. Returns a boolean per provider
// indicating whether the required server-side secrets are set. Does NOT expose
// any secret values, client IDs, or redirect URIs — only whether the provider
// is usable. Used by the Connected Services UI to distinguish "Not configured"
// from "Not connected".
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch { user = null; }
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const providers = {};
    for (const p of ALLOWED_PROVIDERS) {
      providers[p] = { configured: isProviderConfigured(secrets, p), linking_rewards_available: ['youtube','x'].includes(p) && secrets.get('PERKSPHERE_SOCIAL_LINK_REWARDS_ENABLED') === 'true' && secrets.get('PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE') === 'true' };
    }
    return Response.json({ ok: true, providers });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}