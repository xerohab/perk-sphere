import React, { useState } from "react";
import { Code2, ShoppingBag, Radio, FileText, CheckCircle2, Clock, ArrowRight, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";

// Catalog of integration kits. The Universal API Kit is available now — its
// backend route (partnerEventIngest) exists and is deployed. WordPress and
// Streaming kits require external packages and are marked Coming Soon until
// their implementations are tested end-to-end.
const KITS = [
  {
    id: "universal_api",
    icon: Code2,
    name: "Universal API Kit",
    tagline: "Available now",
    status: "available",
    backendRoute: "/functions/partnerEventIngest",
    description: "HTTP + HMAC-SHA256 event submission to the Linux API. Works with any website or backend that can sign requests. This is the primary integration path.",
    delivers: [
      "Integration guide with endpoint and authentication spec",
      "Event payload schemas for all supported event types",
      "HMAC signing reference (signature canonical form, headers, replay protection)",
      "Per-partner credentials (key ID + secret) generated on registration"
    ],
    endpoint: "https://api.perksphere.org/events"
  },
  {
    id: "wordpress_woocommerce",
    icon: ShoppingBag,
    name: "WordPress / WooCommerce Package",
    tagline: "Coming soon",
    status: "coming_soon",
    backendRoute: null,
    description: "Drop-in WordPress plugin for WooCommerce stores. Automatically fires registration, purchase, subscription, and refund events without custom signing code.",
    delivers: [
      "WordPress plugin (external development required)",
      "WooCommerce order and subscription hooks",
      "Automatic user-account linking",
      "Admin settings panel for credential entry"
    ],
    endpoint: "https://api.perksphere.org/events"
  },
  {
    id: "streaming_sdk",
    icon: Radio,
    name: "Streaming SDK",
    tagline: "Coming soon",
    status: "coming_soon",
    backendRoute: null,
    description: "SDK for streaming platforms to emit watch-progress, stream-start, and stream-end events with accurate eligible-seconds tracking.",
    delivers: [
      "Streaming SDK (external development required)",
      "Watch-progress heartbeat events",
      "Broadcast lifecycle events (started, ended)",
      "Eligible-seconds calculation guidance"
    ],
    endpoint: "https://api.perksphere.org/events"
  }
];

const STATUS_BADGE = {
  available: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  coming_soon: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  setup_required: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400"
};

const EVENT_TYPES = [
  { type: "ACCOUNT_REGISTERED", desc: "User registered on the partner site", evidence: "user_reference" },
  { type: "ACCOUNT_LINKED", desc: "User linked their partner account to Perk Sphere", evidence: "challenge_token, user_reference" },
  { type: "ACCOUNT_DISABLED", desc: "User account disabled on the partner site", evidence: "user_reference" },
  { type: "VIDEO_WATCH_PROGRESS", desc: "User watched video content", evidence: "content_id OR content_url (required)" },
  { type: "STREAM_STARTED", desc: "A live stream broadcast started", evidence: "content_id" },
  { type: "STREAM_VIEW_PROGRESS", desc: "User watched a live stream", evidence: "content_id OR content_url (required)" },
  { type: "STREAM_ENDED", desc: "A live stream broadcast ended", evidence: "content_id" },
  { type: "PURCHASE_COMPLETED", desc: "User completed a purchase", evidence: "content_id, user_reference" },
  { type: "PURCHASE_REFUNDED", desc: "A purchase was refunded", evidence: "original_event_id (required)" },
  { type: "CHARGEBACK_ISSUED", desc: "A chargeback was filed", evidence: "original_event_id (required)" },
  { type: "SUBSCRIPTION_ACTIVATED", desc: "User activated a subscription", evidence: "content_id, user_reference" },
  { type: "SUBSCRIPTION_RENEWED", desc: "User renewed a subscription", evidence: "content_id, user_reference" },
  { type: "SUBSCRIPTION_CANCELLED", desc: "User cancelled a subscription", evidence: "user_reference" }
];

const ERROR_RESPONSES = [
  { code: "missing_auth_headers", status: 401, message: "One or more required headers are missing" },
  { code: "unknown_partner", status: 401, message: "The X-PS-Partner-Key does not match any registered partner" },
  { code: "partner_not_active", status: 403, message: "The partner integration is not in 'active' status" },
  { code: "partner_not_configured", status: 500, message: "Partner credentials are missing or could not be decrypted" },
  { code: "stale_timestamp", status: 401, message: "Timestamp is outside the ±300 second clock skew window" },
  { code: "invalid_nonce", status: 401, message: "Nonce is malformed (must be 8-128 chars, [A-Za-z0-9._-])" },
  { code: "replay_detected", status: 401, message: "This nonce has already been used (replay protection)" },
  { code: "invalid_signature", status: 401, message: "The HMAC signature does not match the canonical string" },
  { code: "missing_event_id", status: 400, message: "external_event_id is required" },
  { code: "unknown_event_type", status: 400, message: "The event_type is not in the supported list" },
  { code: "event_type_not_permitted", status: 400, message: "This event type is not in the partner's permitted list" },
  { code: "missing_content_evidence", status: 400, message: "Watch events require content_id or content_url" },
  { code: "missing_original_event_id", status: 400, message: "Refund/chargeback events require original_event_id" }
];

function DocumentationSection({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between p-4 text-left">
        <span className="text-sm font-semibold">{title}</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="border-t border-border p-4 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export default function PartnerIntegrationKits({ onSelectKit = undefined }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Integration Architecture</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Partner websites send authenticated events to the Linux API at <code className="rounded bg-secondary px-1 py-0.5 text-xs">api.perksphere.org</code>.
          The Linux API validates credentials, prevents replay, and delivers trusted events to Perk Sphere.
          Perk Sphere is the sole reward authority — no partner or Linux API event can issue Points or XP directly.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-lg bg-secondary px-2.5 py-1 font-medium">Partner Website</span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="rounded-lg bg-indigo-100 px-2.5 py-1 font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400">Linux API</span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="rounded-lg bg-secondary px-2.5 py-1 font-medium">Perk Sphere (rewards)</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {KITS.map((kit) => {
          const Icon = kit.icon;
          const isAvailable = kit.status === "available";
          const routeOk = !!kit.backendRoute;
          return (
            <div key={kit.id} className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="rounded-lg bg-secondary p-2.5">
                  <Icon className="h-5 w-5 text-foreground" />
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[kit.status]}`}>{kit.tagline}</span>
              </div>
              <h3 className="mt-3 text-base font-semibold">{kit.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{kit.description}</p>
              {!routeOk && isAvailable && (
                <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-400">
                  <AlertCircle className="h-3.5 w-3.5" /> Backend route not deployed
                </div>
              )}
              <ul className="mt-3 space-y-1.5">
                {kit.delivers.map((d) => (
                  <li key={d} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    {isAvailable && routeOk ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" /> : <Clock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />}
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 rounded-lg bg-secondary/60 p-2">
                <p className="text-xs font-medium text-muted-foreground">Endpoint</p>
                <p className="mt-0.5 font-mono text-xs">{kit.endpoint}</p>
              </div>
              {isAvailable && routeOk && onSelectKit && (
                <button
                  onClick={() => onSelectKit(kit.id)}
                  className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-accent"
                >
                  <FileText className="h-3.5 w-3.5" /> Use this kit
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Detailed Documentation */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Universal API — Full Documentation</h3>

        <DocumentationSection title="API Endpoint & HTTP Method">
          <div className="space-y-2">
            <p><strong>Endpoint:</strong> <code className="rounded bg-secondary px-1 font-mono text-xs">POST https://api.perksphere.org/events</code></p>
            <p><strong>Content-Type:</strong> <code className="rounded bg-secondary px-1 font-mono text-xs">application/json</code></p>
            <p><strong>Method:</strong> POST only. GET, PUT, DELETE are not accepted.</p>
            <p>All requests must be server-to-server from the partner backend. Never expose the partner secret in client-side JavaScript.</p>
          </div>
        </DocumentationSection>

        <DocumentationSection title="HMAC Signing Format">
          <div className="space-y-2">
            <p><strong>Required headers:</strong></p>
            <ul className="ml-4 list-disc space-y-0.5">
              <li><code className="rounded bg-secondary px-1 font-mono text-xs">X-PS-Partner-Key</code> — your Partner Key ID</li>
              <li><code className="rounded bg-secondary px-1 font-mono text-xs">X-PS-Timestamp</code> — Unix epoch seconds (±300s skew allowed)</li>
              <li><code className="rounded bg-secondary px-1 font-mono text-xs">X-PS-Nonce</code> — unique random string (8-128 chars, [A-Za-z0-9._-])</li>
              <li><code className="rounded bg-secondary px-1 font-mono text-xs">X-PS-Signature</code> — HMAC-SHA256 hex of the canonical string</li>
            </ul>
            <p className="mt-2"><strong>Canonical string</strong> (lines joined with \n):</p>
            <pre className="rounded-lg bg-secondary p-3 font-mono text-xs overflow-x-auto">{`METHOD\nPATH\nTIMESTAMP\nNONCE\nBODY_SHA256

METHOD      = POST
PATH        = /events
TIMESTAMP   = same as X-PS-Timestamp
NONCE       = same as X-PS-Nonce
BODY_SHA256 = SHA-256 hex of the raw request body`}</pre>
            <p><strong>Signature</strong> = <code className="rounded bg-secondary px-1 font-mono text-xs">HMAC-SHA256(partner_secret, canonical_string).toLowerCase()</code></p>
          </div>
        </DocumentationSection>

        <DocumentationSection title="Request Timestamps & Nonces">
          <div className="space-y-2">
            <p><strong>Timestamps:</strong> Unix epoch seconds. Requests with timestamps more than ±300 seconds from server time are rejected (<code className="font-mono text-xs">stale_timestamp</code>).</p>
            <p><strong>Nonces:</strong> Each request must include a unique nonce. Nonces are persisted server-side — a reused nonce is rejected as <code className="font-mono text-xs">replay_detected</code>. Nonces must be 8-128 characters, matching [A-Za-z0-9._-].</p>
            <p><strong>Replay protection:</strong> Nonces are stored for 600 seconds after first use. Any request reusing a nonce within that window is rejected. This prevents replay attacks even if a request is intercepted.</p>
          </div>
        </DocumentationSection>

        <DocumentationSection title="Event Identifiers & Idempotency">
          <div className="space-y-2">
            <p>Every event must include a unique <code className="rounded bg-secondary px-1 font-mono text-xs">external_event_id</code>. This is the idempotency key — if the same ID is sent twice, the second request returns the stored result without reprocessing.</p>
            <p>Use a UUID or a partner-specific unique identifier. The ID must be globally unique per partner.</p>
          </div>
        </DocumentationSection>

        <DocumentationSection title="Supported Event Types & Required Evidence">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-3 font-medium">Event Type</th>
                  <th className="pb-2 pr-3 font-medium">Description</th>
                  <th className="pb-2 font-medium">Required Evidence</th>
                </tr>
              </thead>
              <tbody>
                {EVENT_TYPES.map((e) => (
                  <tr key={e.type} className="border-b border-border/50">
                    <td className="py-2 pr-3 font-mono text-xs">{e.type}</td>
                    <td className="py-2 pr-3">{e.desc}</td>
                    <td className="py-2 text-xs">{e.evidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">Watch events (VIDEO_WATCH_PROGRESS, STREAM_VIEW_PROGRESS, STREAM_ENDED) require content_id or content_url. Self-reported eligible_seconds alone is never accepted as proof of genuine viewing.</p>
        </DocumentationSection>

        <DocumentationSection title="Error Responses">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-3 font-medium">Code</th>
                  <th className="pb-2 pr-3 font-medium">HTTP Status</th>
                  <th className="pb-2 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {ERROR_RESPONSES.map((e) => (
                  <tr key={e.code} className="border-b border-border/50">
                    <td className="py-2 pr-3 font-mono text-xs">{e.code}</td>
                    <td className="py-2 pr-3">{e.status}</td>
                    <td className="py-2">{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DocumentationSection>

        <DocumentationSection title="Retry Behaviour">
          <div className="space-y-2">
            <p>On a 5xx error or network timeout, retry the same request with the same <code className="font-mono text-xs">external_event_id</code> and nonce. Idempotency ensures duplicates are safely handled.</p>
            <p>On a 4xx error (authentication, validation), do NOT retry with the same nonce — generate a new nonce for each retry attempt. The original nonce may already be stored.</p>
            <p><strong>Recommended:</strong> exponential backoff (1s, 2s, 4s, 8s, max 60s), up to 5 retries.</p>
          </div>
        </DocumentationSection>

        <DocumentationSection title="Credential Rotation">
          <div className="space-y-2">
            <p>An administrator can rotate credentials from Admin → Partners. Rotation revokes the old secret and generates a new key ID + secret pair. The new secret is shown once.</p>
            <p>After rotation, proof-of-possession and test event verification must be repeated before the integration can be reactivated. The old credentials stop working immediately.</p>
            <p><strong>Grace period:</strong> None. Update your backend with the new credentials before rotation if you need zero downtime, or accept a brief interruption.</p>
          </div>
        </DocumentationSection>

        <DocumentationSection title="Account Linking">
          <div className="space-y-2">
            <p>Users link their partner account to their Perk Sphere profile using a signed, single-use challenge:</p>
            <ol className="ml-4 list-decimal space-y-1">
              <li>The user requests a link from Perk Sphere → a challenge token is generated (valid 10 minutes)</li>
              <li>The user provides the challenge token to the partner site</li>
              <li>The partner sends an <code className="font-mono text-xs">ACCOUNT_LINKED</code> event with the <code className="font-mono text-xs">challenge_token</code> and the user's account reference</li>
              <li>Perk Sphere verifies the challenge hash, links the accounts, and creates a connection record</li>
            </ol>
            <p className="text-xs text-amber-600 dark:text-amber-400">Challenges are single-use, expiring, user-specific, and partner-specific. This prevents linking someone else's account, challenge replay, and cross-partner confusion.</p>
          </div>
        </DocumentationSection>

        <DocumentationSection title="Sandbox Testing">
          <div className="space-y-2">
            <p>Partners can send test events by including <code className="rounded bg-secondary px-1 font-mono text-xs">"is_test": true</code> in the event payload. Test events are stored and processed but never enter reward processing or trigger completions.</p>
            <p>Test events are used during the onboarding verification step — an administrator confirms a test event was received and processed before activating the integration.</p>
            <p><strong>Test event payload:</strong></p>
            <pre className="rounded-lg bg-secondary p-3 font-mono text-xs overflow-x-auto">{`{
  "external_event_id": "test-001",
  "event_type": "PURCHASE_COMPLETED",
  "user_reference": "test-user-123",
  "content_id": "product-456",
  "is_test": true,
  "source_timestamp": "2026-01-15T10:30:00Z"
}`}</pre>
          </div>
        </DocumentationSection>

        <DocumentationSection title="Refund & Chargeback Handling">
          <div className="space-y-2">
            <p>Send <code className="font-mono text-xs">PURCHASE_REFUNDED</code> or <code className="font-mono text-xs">CHARGEBACK_ISSUED</code> events with the <code className="font-mono text-xs">original_event_id</code> of the original purchase. Perk Sphere flags the associated task completion for admin review — rewards are not silently reversed.</p>
            <p>An administrator reviews the fraud flag and decides whether to reverse the reward through the existing ledger adjustment workflow. This preserves the immutable ledger audit trail.</p>
          </div>
        </DocumentationSection>
      </div>
    </div>
  );
}
