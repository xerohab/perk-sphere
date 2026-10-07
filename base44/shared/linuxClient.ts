// Shared server-side helper for trusted outbound requests from Base44 to the
// Perk Sphere Linux API. Signs every request with the same HMAC-SHA256
// canonical format used by the inbound trusted bridge:
//
//   POST\n<request_path>\n<timestamp>\n<nonce>\n<sha256_hex(raw_body)>
//
// Signature: HMAC-SHA256(secret, canonical_request), lowercase hexadecimal.
//
// Reuses the existing PERKSPHERE_LINUX_KEY_ID / PERKSPHERE_LINUX_HMAC_SECRET
// secrets — no second credential pair is introduced.
//
// This module is server-side only. It must never be imported from frontend code.
// It never logs secrets, signatures, pairing codes, device tokens, or token hashes.

import { secrets } from "base44:runtime";

const LINUX_API_BASE = "https://api.perksphere.org";

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Hex(secret, text) {
  const keyData = new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Signs and sends a trusted POST to the Linux API.
// Returns { ok: true, status, data } on success or
// { ok: false, status, code, error } on failure.
export async function linuxTrustedPost(path, body) {
  const keyId = secrets.get("PERKSPHERE_LINUX_KEY_ID");
  const hmacSecret = secrets.get("PERKSPHERE_LINUX_HMAC_SECRET");
  if (!keyId || !hmacSecret) {
    return { ok: false, status: 500, code: "server_misconfigured", error: "Linux API credentials are not configured." };
  }

  const rawBody = JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomUUID();
  const bodyHash = await sha256Hex(rawBody);
  const canonical = ["POST", path, timestamp, nonce, bodyHash].join("\n");
  const signature = await hmacSha256Hex(hmacSecret, canonical);

  let res;
  try {
    res = await fetch(LINUX_API_BASE + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PS-Key-ID": keyId,
        "X-PS-Timestamp": timestamp,
        "X-PS-Nonce": nonce,
        "X-PS-Signature": signature
      },
      body: rawBody
    });
  } catch (_e) {
    return { ok: false, status: 503, code: "linux_unreachable", error: "Pairing service is temporarily unavailable." };
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      code: (data && data.error && data.error.code) || "linux_error",
      error: (data && data.error && data.error.message) || "Linux API request failed."
    };
  }
  return { ok: true, status: res.status, data: (data && data.data) || data };
}