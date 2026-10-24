const PREFIXES = ['/v1/perk-sphere/', '/partners/', '/v1/partner-credentials/', '/v1/partner-links/'];
const ACCOUNT_DEVICE_PATHS = new Set(['/v1/account-devices/pairing/create', '/v1/account-devices/list', '/v1/account-devices/revoke']);

export function isValidLinuxPath(path) {
  // Only literal path segments: no authority, escapes, queries, fragments,
  // backslashes or dot segments that a URL parser could normalise after signing.
  if (typeof path !== 'string' || !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(path)) return false;
  return ACCOUNT_DEVICE_PATHS.has(path) || PREFIXES.some(prefix => path.startsWith(prefix));
}
