import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { parseTarget, buildResult } from '../../shared/classify.ts';

// Extension-ready classification endpoint.
//   POST { url }                       or { domain }  or { platform, handle }
//   POST { urls: [ ... up to 25 ] }    -> { results: [...] }
// Returns Allowed / Neutral / Disallowed / unknown plus the minimum a client needs
// (tracking + points/XP eligibility). Requires a signed-in Perk Sphere user.
// Never returns notes, rules, credentials, user data, fraud data or admin info, and
// only matches destinations that are active AND publicly visible.
async function perkSphereHandler(req) {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try {
      user = await base44.auth.me();
    } catch (_e) {
      user = null;
    }
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const isBatch = Array.isArray(body.urls);
    const inputs = isBatch ? body.urls.slice(0, 25).map((u) => ({ url: u })) : [body];
    const hasInput = inputs.some((i) => i && (i.url || i.domain || (i.platform && i.handle)));
    if (!hasInput) return Response.json({ error: 'Provide url, domain, or platform + handle' }, { status: 400 });

    const admin = base44.asServiceRole;
    const [websites, accounts] = await Promise.all([
      admin.entities.Website.list('-updated_date', 1000),
      admin.entities.TrackedAccount.list('-updated_date', 1000)
    ]);

    const results = inputs.map((i) => buildResult(parseTarget(i || {}), websites, accounts));
    if (isBatch) return Response.json({ ok: true, results });
    return Response.json({ ok: true, ...results[0] });
  } catch (error) {
    return Response.json({ error: 'Classification failed' }, { status: 500 });
  }
}
export default perkSphereHandler;
if (typeof Deno !== 'undefined') Deno.serve(perkSphereHandler);
