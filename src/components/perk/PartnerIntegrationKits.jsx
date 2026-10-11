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
    backendRoute: "/v1/partners/events",
    description: "HTTP + HMAC-SHA256 event submission to the Linux API. Works with any website or backend that can sign requests. This is the primary integration path.",
    delivers: [
      "Integration guide with endpoint and authentication spec",
      "Event payload schemas for all supported event types",
      "HMAC signing reference (signature canonical form, headers, replay protection)",
      "Per-partner credentials (key ID + secret) generated on registration"
    ],
    endpoint: "https://api.perksphere.org/v1/partners/events"
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
    endpoint: "https://api.perksphere.org/v1/partners/events"
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
    endpoint: "https://api.perksphere.org/v1/partners/events"
  }
];

const STATUS_BADGE = {
  available: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  coming_soon: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  setup_required: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400"
};

const EVENT_TYPES = [
  {
    "type": "ACCOUNT_REGISTERED",
    "desc": "Linux event_type: registration_completed",
    "evidence": "registration_reference"
  },
  {
    "type": "ACCOUNT_LINKED",
    "desc": "Linux event_type: account_linked",
    "evidence": "link_reference"
  },
  {
    "type": "ACCOUNT_DISABLED",
    "desc": "Linux event_type: account_disabled",
    "evidence": "account_reference, disabled_at"
  },
  {
    "type": "VIDEO_WATCH_PROGRESS",
    "desc": "Linux event_type: video_watch_progress",
    "evidence": "playback_session_id, content_id, eligible_seconds"
  },
  {
    "type": "STREAM_STARTED",
    "desc": "Linux event_type: stream_started",
    "evidence": "stream_id, started_at"
  },
  {
    "type": "STREAM_VIEW_PROGRESS",
    "desc": "Linux event_type: stream_watch_progress",
    "evidence": "stream_id, viewer_session_id, eligible_seconds"
  },
  {
    "type": "STREAM_ENDED",
    "desc": "Linux event_type: stream_ended",
    "evidence": "stream_id, ended_at"
  },
  {
    "type": "PURCHASE_COMPLETED",
    "desc": "Linux event_type: purchase_completed",
    "evidence": "transaction_reference, payment_status=captured, currency, amount_minor"
  },
  {
    "type": "PURCHASE_REFUNDED",
    "desc": "Linux event_type: purchase_refunded",
    "evidence": "transaction_reference, refund_reference, currency, amount_minor"
  },
  {
    "type": "CHARGEBACK_ISSUED",
    "desc": "Linux event_type: chargeback_issued",
    "evidence": "transaction_reference, chargeback_reference, currency, amount_minor"
  },
  {
    "type": "SUBSCRIPTION_ACTIVATED",
    "desc": "Linux event_type: subscription_activated",
    "evidence": "subscription_reference, transaction_reference, payment_status=captured, currency, amount_minor, period_start, period_end"
  },
  {
    "type": "SUBSCRIPTION_RENEWED",
    "desc": "Linux event_type: subscription_renewed",
    "evidence": "subscription_reference, transaction_reference, payment_status=captured, currency, amount_minor, period_start, period_end"
  },
  {
    "type": "SUBSCRIPTION_CANCELLED",
    "desc": "Linux event_type: subscription_cancelled",
    "evidence": "subscription_reference, cancelled_at"
  }
];

const ERROR_RESPONSES = [
  {
    "code": "invalid_partner_auth",
    "status": 401,
    "message": "Invalid credentials, signature or authentication headers"
  },
  {
    "code": "partner_not_active",
    "status": 403,
    "message": "Partner or credential is inactive"
  },
  {
    "code": "replayed_partner_request",
    "status": 409,
    "message": "Nonce has already been used"
  },
  {
    "code": "duplicate_partner_event",
    "status": 409,
    "message": "Event ID already received; do not replace it to retry"
  },
  {
    "code": "unsupported_event_type",
    "status": 422,
    "message": "Event type is not supported by the deployed API"
  },
  {
    "code": "event_not_allowed_for_partner",
    "status": 422,
    "message": "Partner is not permitted to submit this event"
  },
  {
    "code": "missing_event_evidence",
    "status": 422,
    "message": "Required evidence field is missing"
  },
  {
    "code": "invalid_event_evidence",
    "status": 422,
    "message": "Evidence values do not meet the contract"
  },
  {
    "code": "partner_event_unavailable",
    "status": 503,
    "message": "Temporary receiver failure"
  }
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
          Partner events are claims. Rewards require independent activity verification, an enabled server policy and the authoritative transactional ledger.
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
            <p><strong>Endpoint:</strong> <code className="rounded bg-secondary px-1 font-mono text-xs">POST https://api.perksphere.org/v1/partners/events</code></p>
            <p><strong>Content-Type:</strong> <code className="rounded bg-secondary px-1 font-mono text-xs">application/json</code></p>
            <p><strong>Method:</strong> POST only. GET, PUT, DELETE are not accepted.</p>
            <p>All requests must be server-to-server from the partner backend. Never expose the partner secret in client-side JavaScript.</p>
          </div>
        </DocumentationSection>

        <DocumentationSection title="HMAC Signing Format">
          <div className="space-y-2">
            <p><strong>Required headers:</strong></p>
            <ul className="ml-4 list-disc space-y-0.5">
              <li><code className="rounded bg-secondary px-1 font-mono text-xs">X-PS-Key-ID</code> — your Partner Key ID</li>
              <li><code className="rounded bg-secondary px-1 font-mono text-xs">X-PS-Timestamp</code> — Unix epoch seconds (±300s skew allowed)</li>
              <li><code className="rounded bg-secondary px-1 font-mono text-xs">X-PS-Nonce</code> — unique random string (16-128 chars, [A-Za-z0-9_-])</li>
              <li><code className="rounded bg-secondary px-1 font-mono text-xs">X-PS-Signature</code> — HMAC-SHA256 hex of the canonical string</li>
            </ul>
            <p className="mt-2"><strong>Canonical string</strong> (lines joined with \n):</p>
            <pre className="rounded-lg bg-secondary p-3 font-mono text-xs overflow-x-auto">{`METHOD\nPATH\nTIMESTAMP\nNONCE\nBODY_SHA256

METHOD      = POST
PATH        = /v1/partners/events
TIMESTAMP   = same as X-PS-Timestamp
NONCE       = same as X-PS-Nonce
BODY_SHA256 = SHA-256 hex of the raw request body`}</pre>
            <p><strong>Signature</strong> = <code className="rounded bg-secondary px-1 font-mono text-xs">HMAC-SHA256(partner_secret, canonical_string).toLowerCase()</code></p>
          </div>
        </DocumentationSection>

        <DocumentationSection title="Request Timestamps & Nonces">
          <div className="space-y-2">
            <p><strong>Timestamps:</strong> Unix epoch seconds. Requests with timestamps more than ±300 seconds from server time are rejected (<code className="font-mono text-xs">stale_timestamp</code>).</p>
            <p><strong>Nonces:</strong> Each request must include a unique nonce. Nonces are persisted server-side — a reused nonce is rejected as <code className="font-mono text-xs">replay_detected</code>. Nonces must be 16-128 characters, matching [A-Za-z0-9_-].</p>
            <p><strong>Replay protection:</strong> Nonces are stored for 600 seconds after first use. Any request reusing a nonce within that window is rejected. This prevents replay attacks even if a request is intercepted.</p>
          </div>
        </DocumentationSection>

        <DocumentationSection title="Event Identifiers & Idempotency">
          <div className="space-y-2">
            <p>Every event must include a unique <code className="rounded bg-secondary px-1 font-mono text-xs">partner_event_id</code>. The Linux API rejects a reused ID with HTTP 409 duplicate_partner_event. A submitted claim does not authorise rewards.</p>
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
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">The complete 13-event contract is prepared for the next Linux release. Existing deployments may accept fewer types. All evidence belongs in the evidence object. Signed claims and self-reported watch time do not prove eligibility.</p>
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
            <p>On a 5xx error or network timeout, retry the same payload with the same <code className="font-mono text-xs">partner_event_id</code> and a fresh timestamp, nonce and signature. A duplicate event returns HTTP 409; do not change its event ID to retry.</p>
            <p>On a 4xx error (authentication, validation), do NOT retry with the same nonce — generate a new nonce for each retry attempt. The original nonce may already be stored.</p>
            <p><strong>Recommended:</strong> exponential backoff (1s, 2s, 4s, 8s, max 60s), up to 5 retries.</p>
          </div>
        </DocumentationSection>

        <DocumentationSection title="Credential Rotation">
          <div className="space-y-2">
            <p>An administrator can rotate credentials from Admin → Partners. Rotation prepares a pending key ID and secret while preserving the active credential. The new secret is shown once.</p>
            <p>The pending credential must pass proof-of-possession and test-event verification before activation. Revoke the old credential only after the replacement works.</p>
            <p>Keep the existing active credential until the replacement has been verified.</p>
          </div>
        </DocumentationSection>

        <DocumentationSection title="Account Linking">
          <div className="space-y-2">
            <p>Users link their partner account to their Perk Sphere profile using a signed, single-use challenge:</p>
            <ol className="ml-4 list-decimal space-y-1">
              <li>The user requests a link from Perk Sphere → a challenge token is generated (valid 10 minutes)</li>
              <li>The user provides the challenge token to the partner site</li>
              <li>The partner confirms the challenge through the signed <code className="font-mono text-xs">/v1/partner-links/confirm</code> endpoint with challenge and partner_account_reference</li>
              <li>Linux verifies the single-use challenge and records the account link. An account_linked event alone cannot create a link.</li>
            </ol>
            <p className="text-xs text-amber-600 dark:text-amber-400">Challenges are single-use, expiring, user-specific, and partner-specific. This prevents linking someone else's account, challenge replay, and cross-partner confusion.</p>
          </div>
        </DocumentationSection>

        <DocumentationSection title="Sandbox Testing">
          <div className="space-y-2">
            <p>Send signed validation requests to <code className="rounded bg-secondary px-1 font-mono text-xs">/partners/test-event</code>. Sign that exact path. Validation requests never issue rewards; do not add is_test to production payloads.</p>
            <p>Test events are used during the onboarding verification step — an administrator confirms a test event was received and processed before activating the integration.</p>
            <p><strong>Test event payload:</strong></p>
            <pre className="rounded-lg bg-secondary p-3 font-mono text-xs overflow-x-auto">{`{
  "partner_event_id": "test-001",
  "event_type": "registration_completed",
  "partner_account_reference": "test-account-123",
  "occurred_at": "REPLACE_WITH_CURRENT_UTC_TIMESTAMP",
  "evidence": { "registration_reference": "registration-test-001" }
}`}</pre>
          </div>
        </DocumentationSection>

        <DocumentationSection title="Refund & Chargeback Handling">
          <div className="space-y-2">
            <p>Send purchase_refunded or chargeback_issued with the original transaction_reference and the provider refund or chargeback reference. Only independently verified, original-purchase-bound reversals may alter the ledger.</p>
            <p>An administrator reviews the fraud flag and decides whether to reverse the reward through the existing ledger adjustment workflow. This preserves the immutable ledger audit trail.</p>
          </div>
        </DocumentationSection>
      </div>
    </div>
  );
}
