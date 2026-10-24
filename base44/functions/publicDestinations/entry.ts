import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { websiteToDestination, accountToDestination, isPublicDestination, toPublic } from '../../shared/destinations.ts';

// Public directory feed. Anonymous callers are allowed on purpose.
// Website / TrackedAccount are admin-only entities, so this reads them with the
// service role and returns ONLY active + publicly visible destinations, projected
// through toPublic() (no notes, rule values, tracking switches, ids of other systems
// or user data).
async function perkSphereHandler(req) {
  try {
    const base44 = createClientFromRequest(req);
    const admin = base44.asServiceRole;
    const [websites, accounts] = await Promise.all([
      admin.entities.Website.list('-updated_date', 1000),
      admin.entities.TrackedAccount.list('-updated_date', 1000)
    ]);

    const destinations = [
      ...(websites || []).map(websiteToDestination),
      ...(accounts || []).map(accountToDestination)
    ]
      .filter(isPublicDestination)
      .map(toPublic)
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));

    return Response.json({ ok: true, destinations });
  } catch (error) {
    return Response.json({ error: 'Unable to load destinations' }, { status: 500 });
  }
}
export default perkSphereHandler;
if (typeof Deno !== 'undefined') Deno.serve(perkSphereHandler);
