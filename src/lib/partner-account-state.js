// Current verification is separate from a saved local connection.
export function getPartnerState(partner, links, connected, verification = {}) {
  const conn = connected.find(c => c.service === `partner_${partner.id}` && c.status === "connected")
    || connected.find(c => c.service === `partner_${partner.id}`);
  const current = verification[partner.id];
  if (conn?.status === "connected") {
    return { state: current === "verified" ? "connected" : current === "not_linked" ? "unverified" : "unavailable", conn };
  }
  if (partner.integration_status !== "active") return { state: "coming_soon" };
  if (!["verified", "not_linked"].includes(current)) return { state: "unavailable" };
  const link = links.find(l => l.partner_integration_id === partner.id && l.status === "pending");
  if (link) {
    const expired = link.expires_at && new Date(link.expires_at) < new Date();
    return { state: expired ? "expired" : "pending", link };
  }
  if (conn?.status === "disconnected") return { state: "disconnected", conn };
  return { state: "connect" };
}
