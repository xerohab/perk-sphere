import React, { useState } from "react";
import { Globe, KeyRound, Link2, Send, RefreshCw, Shield, AlertTriangle, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const LINUX_API_BASE = "https://api.perksphere.org";

function Section({ icon: Icon, title, children, id }) {
  return (
    <section id={id} className="scroll-mt-20 rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-semibold"><Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /> {title}</h2>
      <div className="mt-3 space-y-3 text-sm text-muted-foreground leading-relaxed">{children}</div>
    </section>
  );
}

function CodeBlock({ code }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative rounded-lg bg-secondary p-3 pr-10">
      <pre className="overflow-x-auto text-xs font-mono text-foreground">{code}</pre>
      <button onClick={copy} className="absolute right-2 top-2 rounded p-1.5 text-muted-foreground hover:bg-accent" title="Copy">
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

const EVENT_TYPES = [
  { type: "registration_completed", description: "User registered on the partner site" },
  { type: "video_watch_progress", description: "Video viewing progress (eligible seconds)" },
  { type: "purchase_completed", description: "Purchase completed" },
  { type: "stream_watch_progress", description: "Live stream viewing progress (eligible seconds)" },
  { type: "stream_ended", description: "Live stream ended" }
];

export default function PartnerGuide() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Partner Integration Guide</h1>
        <p className="mt-1 text-sm text-muted-foreground">Complete documentation for integrating your platform with Perk Sphere via the Linux API.</p>
      </div>

      {/* Table of contents */}
      <div className="mb-6 flex flex-wrap gap-2 rounded-xl border border-border bg-secondary/30 p-4">
        {[
          { id: "architecture", label: "Architecture" },
          { id: "dns", label: "DNS Setup" },
          { id: "credentials", label: "Credentials" },
          { id: "hmac", label: "HMAC Auth" },
          { id: "events", label: "Events" },
          { id: "account-linking", label: "Account Linking" },
          { id: "rotation", label: "Rotation" },
          { id: "troubleshooting", label: "Troubleshooting" },
          { id: "go-live", label: "Go-Live" }
        ].map((item) => (
          <a key={item.id} href={`#${item.id}`} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            {item.label}
          </a>
        ))}
      </div>

      <div className="space-y-4">
        <Section icon={Globe} title="Architecture" id="architecture">
          <p>Your platform sends HMAC-signed events to the Linux API. Linux validates credentials, prevents replay, and forwards eligible verified activity to Perk Sphere. Perk Sphere is the sole reward authority — no partner or Linux event can issue Points or XP directly.</p>
          <CodeBlock code={`Partner Backend  →  Linux API (${LINUX_API_BASE})  →  Perk Sphere (reward authority)`} />
          <p>Events feed task progress. Rewards are issued exclusively through Perk Sphere's server-side completion path.</p>
        </Section>

        <Section icon={Globe} title="DNS TXT Configuration" id="dns">
          <p>To prove domain ownership, publish a DNS TXT record:</p>
          <div className="rounded-lg border border-border p-3 text-xs">
            <div className="grid gap-2">
              <div><span className="font-medium text-foreground">Record type:</span> TXT</div>
              <div><span className="font-medium text-foreground">Name / Host:</span> <code className="font-mono">_perksphere.your-domain.com</code></div>
              <div><span className="font-medium text-foreground">Value / Content:</span> <code className="font-mono break-all">ps-verify-xxxxx</code> (your unique token)</div>
              <div><span className="font-medium text-foreground">TTL:</span> 3600 (1 hour)</div>
            </div>
          </div>
          <p>The token is issued by Linux during provisioning. Do not generate your own token or reuse another partner's token. An administrator verifies the record via the Verify Domain button — verification is confirmed by the Linux API.</p>
          <p className="text-xs"><AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-amber-500" />DNS propagation can take up to 48 hours. If verification fails, wait and retry — do not repeatedly retry.</p>
        </Section>

        <Section icon={KeyRound} title="Secure Credential Handling" id="credentials">
          <p>Your HMAC credentials (<code className="font-mono">PERKSPHERE_PARTNER_KEY_ID</code> and <code className="font-mono">PERKSPHERE_PARTNER_HMAC_SECRET</code>) are issued once during provisioning.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Store credentials in your backend secrets manager — never in client-side JavaScript or public repositories.</li>
            <li>Use server-to-server calls from your backend to the Linux API.</li>
            <li>If the secret is lost, contact the Perk Sphere administrator for an authorised reissue or rotation. There is no self-service recovery.</li>
            <li>The secret is never logged, never returned in API responses after initial issuance, and never exposed to the frontend.</li>
          </ul>
        </Section>

        <Section icon={Shield} title="Backend HMAC Authentication" id="hmac">
          <p>Every request to the Linux API must be authenticated with HMAC-SHA256. Include these headers:</p>
          <div className="rounded-lg border border-border p-3 text-xs">
            <div className="grid gap-1">
              <div><code className="font-mono text-foreground">X-PS-Key-ID</code> — your Partner Key ID</div>
              <div><code className="font-mono text-foreground">X-PS-Timestamp</code> — Unix epoch seconds (±300s clock skew allowed)</div>
              <div><code className="font-mono text-foreground">X-PS-Nonce</code> — unique random string (8–128 chars, [A-Za-z0-9._-])</div>
              <div><code className="font-mono text-foreground">X-PS-Signature</code> — HMAC-SHA256 hex of the canonical string</div>
            </div>
          </div>
          <p>Canonical string (lines joined with <code className="font-mono">\n</code>):</p>
          <CodeBlock code={`METHOD\nPATH_WITH_QUERY\nTIMESTAMP\nNONCE\nBODY_SHA256`} />
          <p>Where:</p>
          <ul className="list-disc space-y-1 pl-5 text-xs">
            <li><code className="font-mono">METHOD</code> — HTTP method (e.g. <code className="font-mono">POST</code>)</li>
            <li><code className="font-mono">PATH_WITH_QUERY</code> — the path and query string (e.g. <code className="font-mono">/v1/partners/events</code>)</li>
            <li><code className="font-mono">TIMESTAMP</code> — the same value as the X-PS-Timestamp header</li>
            <li><code className="font-mono">NONCE</code> — the same value as the X-PS-Nonce header</li>
            <li><code className="font-mono">BODY_SHA256</code> — SHA-256 hex of the raw request body</li>
          </ul>
          <CodeBlock code={`const signature = hmacSha256(secret, canonicalString).toString('hex');`} />
          <p>Nonces are single-use. Replayed requests are rejected. Timestamps outside ±300 seconds are rejected.</p>
        </Section>

        <Section icon={Send} title="Partner Event Submission" id="events">
          <p>Submit events to the Linux API event receiver:</p>
          <CodeBlock code={`POST ${LINUX_API_BASE}/v1/partners/events\nPOST ${LINUX_API_BASE}/events`} />
          <p className="text-xs text-muted-foreground">Both paths are supported. Use the one that matches your integration kit.</p>
          <p>Supported event types (subject to your partner's configured allowlist):</p>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-secondary">
                <tr><th className="px-3 py-2 text-left font-medium">Event Type</th><th className="px-3 py-2 text-left font-medium">Description</th></tr>
              </thead>
              <tbody>
                {EVENT_TYPES.map((et) => (
                  <tr key={et.type} className="border-t border-border">
                    <td className="px-3 py-2 font-mono">{et.type}</td>
                    <td className="px-3 py-2">{et.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs"><AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-amber-500" />Do not send an event type that is not authorised for your partner. Check your configured allowlist.</p>
          <p>Example payload:</p>
          <CodeBlock code={`{
  "external_event_id": "evt_20261009_001",
  "event_type": "stream_watch_progress",
  "user_reference": "user_abc123",
  "content_id": "video_456",
  "content_url": "https://example.com/watch/456",
  "eligible_seconds": 120,
  "source_timestamp": "2026-10-09T17:30:00Z",
  "metadata": {}
}`} />
          <p><strong>Event deduplication:</strong> <code className="font-mono">external_event_id</code> is idempotent. If you send the same ID twice, the second request returns the stored result without reprocessing. Generate a unique ID for each event.</p>
          <p><strong>Error handling:</strong> 200 = accepted, 400 = validation error, 401 = auth failure, 403 = forbidden, 500 = server error. Retry with exponential backoff on 500/503. Do not retry on 400/401/403 — fix the request first.</p>
        </Section>

        <Section icon={Link2} title="Account Linking and Unlinking" id="account-linking">
          <p>Account linking connects a Perk Sphere user to their account on your platform.</p>
          <p><strong>Challenge creation</strong> requires authenticated Perk Sphere service access — the user initiates a link from the Perk Sphere app, and Perk Sphere requests a challenge from Linux:</p>
          <CodeBlock code={`POST ${LINUX_API_BASE}/v1/partner-links/challenges
{ "partner_uuid": "...", "user_reference": "..." }`} />
          <p><strong>Partner-link confirmation</strong> requires partner HMAC authentication — your backend confirms the challenge with the user's account reference:</p>
          <CodeBlock code={`POST ${LINUX_API_BASE}/v1/partner-links/confirm
{ "challenge_token": "...", "partner_account_reference": "user123" }`} />
          <p>Linux verifies the challenge, links the accounts, and notifies Perk Sphere via a <code className="font-mono">PARTNER_LINK_CONFIRMED</code> event. Perk Sphere does not accept account references from unauthenticated browsers.</p>
          <p><strong>Unlinking:</strong></p>
          <CodeBlock code={`POST ${LINUX_API_BASE}/partners/account-link/unlink
{ "partner_uuid": "...", "user_reference": "..." }`} />
          <p className="text-xs"><AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-amber-500" />Inactive partners cannot accept account-link requests. Linking is only available for active partners.</p>
        </Section>

        <Section icon={RefreshCw} title="Credential Rotation and Revocation" id="rotation">
          <p><strong>Rotation:</strong> An administrator rotates your credentials via the Linux API. Old credentials are revoked; new ones are issued. You must re-complete proof-of-possession with the new credential.</p>
          <CodeBlock code={`POST ${LINUX_API_BASE}/partners/rotate-credential
{ "partner_uuid": "..." }`} />
          <p><strong>Revocation:</strong> An administrator revokes all credentials. The partner is disabled and cannot send events.</p>
          <CodeBlock code={`POST ${LINUX_API_BASE}/partners/revoke
{ "partner_uuid": "..." }`} />
          <p className="text-xs"><AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-amber-500" />If your secret is compromised, contact the administrator immediately for emergency rotation. Do not continue using a compromised secret.</p>
        </Section>

        <Section icon={AlertTriangle} title="Troubleshooting" id="troubleshooting">
          <div className="space-y-2">
            <div><strong className="text-foreground">401 invalid_signature:</strong> Your HMAC signature is wrong. Verify the canonical string format and that you are using the correct secret.</div>
            <div><strong className="text-foreground">401 unknown_key_id:</strong> Your key ID is not recognised. Check that you are using the current key ID after rotation.</div>
            <div><strong className="text-foreground">401 stale_timestamp:</strong> Your server clock is more than 300 seconds off. Sync with NTP.</div>
            <div><strong className="text-foreground">401 replay_detected:</strong> You reused a nonce. Generate a unique nonce for every request.</div>
            <div><strong className="text-foreground">400 validation_error:</strong> Your payload is missing required fields or has invalid values. Check the event type and required fields.</div>
            <div><strong className="text-foreground">422 domain_verification_failed:</strong> DNS TXT record not found. Wait for DNS propagation and retry.</div>
            <div><strong className="text-foreground">503 partner_management_unavailable:</strong> Linux is temporarily unavailable. Retry with backoff.</div>
          </div>
        </Section>

        <Section icon={Check} title="Testing and Go-Live Requirements" id="go-live">
          <p>Before activation, all onboarding steps must be complete:</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Partner registered in Perk Sphere</li>
            <li>Credentials generated by Linux</li>
            <li>Domain ownership verified (DNS TXT)</li>
            <li>Administrator review approved</li>
            <li>Credentials configured on Linux API</li>
            <li>Partner-side implementation complete</li>
            <li>Proof of possession verified</li>
            <li>Test event verification passed</li>
          </ol>
          <p className="text-xs"><AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-amber-500" />The Linux event receiver requires an active partner. Pre-activation test events are not supported — test event verification is performed after activation in a controlled environment. Do not activate a partner solely to test events.</p>
          <p className="text-xs"><AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-amber-500" />YouTube events always award zero Points and zero XP, regardless of configuration.</p>
          <p>Activation requires independent administrator approval via a signed Linux activation process. Base44 admin approval does not automatically activate a partner.</p>
        </Section>
      </div>

      <div className="mt-8 rounded-xl border border-indigo-300 bg-indigo-50 p-5 dark:border-indigo-700 dark:bg-indigo-950/30">
        <h3 className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">Ready to register?</h3>
        <p className="mt-1 text-xs text-indigo-700 dark:text-indigo-400">If you have not yet registered your partner integration, start the self-service registration process.</p>
        <a href="/partners/register"><Button className="mt-3" size="sm"><Globe className="mr-2 h-4 w-4" /> Register Partner</Button></a>
      </div>
    </div>
  );
}