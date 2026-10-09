// Partner HMAC signing for partner-authenticated Linux API requests.
// Used by partners to submit events (/events) and confirm account links
// (/v1/partner-links/confirm). Server-side only — never imported from frontend.
//
// Canonical format (identical structure to Base44 → Linux, but with the
// partner's own key/secret and the X-PS-Partner-Key header):
//   POST\n<request_path>\n<timestamp>\n<nonce>\n<sha256_hex(raw_body)>

const LINUX_API_BASE = "https://api.perksphere.org";

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Hex(secret, text) {
  const keyData = new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Signs and sends a partner-authenticated POST to Linux.
// Returns { ok, status, data, error }.
export async function partnerSignedPost(path, body, partnerKeyId, partnerSecret) {
  const rawBody = JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomUUID();
  const bodyHash = await sha256Hex(rawBody);
  const canonical = ["POST", path, timestamp, nonce, bodyHash].join("\n");
  const signature = await hmacSha256Hex(partnerSecret, canonical);

  let res;
  try {
    res = await fetch(LINUX_API_BASE + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PS-Partner-Key": partnerKeyId,
        "X-PS-Timestamp": timestamp,
        "X-PS-Nonce": nonce,
        "X-PS-Signature": signature
      },
      body: rawBody,
      signal: AbortSignal.timeout(10000)
    });
  } catch (e) {
    return { ok: false, status: 503, code: "network_error", error: String(e.message || e) };
  }

  const data = await res.json().catch(() => null);
  const errObj = data && data.error;
  return {
    ok: res.ok,
    status: res.status,
    data: (data && (data.data || data)) || null,
    code: errObj?.code || null,
    error: errObj?.message || (typeof errObj === 'string' ? errObj : null) || null
  };
}

// Computes a proof-of-possession signature for the /v1/partner-credentials/confirm endpoint.
// The partner signs the challenge to prove they hold the HMAC secret.
// Format: HMAC-SHA256(partner_secret, "POST\n<path>\n<timestamp>\n<nonce>\n<sha256_hex(challenge)>")
export async function computeProofSignature(partnerSecret, path, timestamp, nonce, challenge) {
  const challengeHash = await sha256Hex(challenge);
  const canonical = ["POST", path, timestamp, nonce, challengeHash].join("\n");
  return await hmacSha256Hex(partnerSecret, canonical);
}

// Alternative proof format: HMAC-SHA256(partner_secret, challenge) — signs the raw challenge.
export async function computeProofSignatureRaw(partnerSecret, challenge) {
  return await hmacSha256Hex(partnerSecret, challenge);
}

export { sha256Hex, hmacSha256Hex };