import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { websiteToDestination, accountToDestination, isPublicDestination } from '../../shared/destinations.ts';

// Public, API-ready endpoint for the destination classification list.
// Returns only active, publicly-visible destinations with safe fields.
// No notes, internal IDs beyond the record id, fraud data, admin settings,
// OAuth tokens or user data. Intended for the public directory and the
// future Perk Sphere browser extension.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const [websites, accounts] = await Promise.all([
      base44.entities.Website.list('-updated_date', 500),
      base44.entities.TrackedAccount.list('-updated_date', 500)
    ]);

    const dests = [
      ...(websites || []).map(websiteToDestination),
      ...(accounts || []).map(accountToDestination)
    ].filter(isPublicDestination);

    return Response.json({ ok: true, destinations: dests });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}