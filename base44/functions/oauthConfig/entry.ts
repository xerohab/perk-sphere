import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { isProviderConfigured, ALLOWED_PROVIDERS, privateOAuthResponse } from '../../shared/oauth.ts';

// Read-only provider configuration status. Returns a boolean per provider
// indicating whether the required server-side secrets are set. Does NOT expose
// any secret values, client IDs, or redirect URIs — only whether the provider
// has configuration present, not that provider approval or availability has been verified.
// Used by the Connected Services UI to distinguish "Not configured"
// from "Not connected".
async function configurationStatus(req) {
  try {
    if(req.method!=='POST')return Response.json({error:'method_not_allowed'},{status:405,headers:{Allow:'POST'}});
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch { user = null; }
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const providers = {};
    for (const p of ALLOWED_PROVIDERS) {
      providers[p] = { configured: isProviderConfigured(secrets, p), linking_rewards_available: ['youtube','x'].includes(p) && secrets.get('PERKSPHERE_SOCIAL_LINK_REWARDS_ENABLED') === 'true' && secrets.get('PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE') === 'true' };
    }
    return Response.json({ ok: true, providers });
  } catch {
    return Response.json({error:'Provider availability could not be checked.'},{status:503});
  }
}
async function handleRequest(req) { return privateOAuthResponse(await configurationStatus(req)); }
export default handleRequest;
if (typeof Deno !== 'undefined') Deno.serve(handleRequest);
