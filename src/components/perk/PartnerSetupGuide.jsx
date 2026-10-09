import React, { useState } from "react";
import { Download, Copy, Check, ExternalLink, AlertTriangle, Shield, Globe, KeyRound, FileCheck, TestTube, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Code2 } from "lucide-react";

const LINUX_API_BASE = "https://api.perksphere.org";

// 8-step onboarding setup guide. Steps 1-2 are auto-completed on creation.
// Steps 3-8 require domain verification, admin review, Linux API config,
// partner implementation, proof of possession, test event verification,
// and admin activation.

export const SETUP_STEPS = [
  { key: "base44_registered", label: "Partner registered in Perk Sphere", external: false, auto: true },
  { key: "credentials_generated", label: "Secure credentials generated", external: false, auto: true },
  { key: "domain_verified", label: "Domain ownership verified", external: true },
  { key: "admin_reviewed", label: "Administrator review approved", external: false },
  { key: "linux_api_configured", label: "Credentials configured on Linux API", external: true },
  { key: "partner_implemented", label: "Partner-side implementation complete", external: true },
  { key: "proof_of_possession", label: "Proof of possession verified", external: true },
  { key: "test_event_verified", label: "Test event verification passed", external: true },
  { key: "activated", label: "Integration activated by admin", external: false }
];

const STEP_ICONS = {
  base44_registered: Shield,
  credentials_generated: KeyRound,
  domain_verified: Globe,
  admin_reviewed: FileCheck,
  linux_api_configured: Rocket,
  partner_implemented: Code2,
  proof_of_possession: KeyRound,
  test_event_verified: TestTube,
  activated: Check
};

function buildGuide(partner) {
  const eventTypes = (partner.supported_event_types || []).join(", ") || "(none configured)";
  const domains = (partner.verified_domains || []).join(", ") || "(none configured)";
  const taskTypes = (partner.allowed_task_types || []).join(", ") || "(none configured)";
  const checklist = partner.setup_checklist || {};
  const completed = SETUP_STEPS.filter((s) => checklist[s.key]).map((s) => s.label);
  const pending = SETUP_STEPS.filter((s) => !checklist[s.key]).map((s) => s.label);

  return `PERK SPHERE — PARTNER INTEGRATION GUIDE
========================================

Partner: ${partner.name}
Type: ${partner.partner_type}
Integration Kit: ${partner.integration_kit_type || "universal_api"}
Website: ${partner.website_url || "(not set)"}
Verified Domains: ${domains}
Status: ${partner.integration_status}
Verification: ${partner.verification_status || "unverified"}

Generated: ${new Date().toISOString()}

----------------------------------------
1. ARCHITECTURE
----------------------------------------

Partner Website  -->  Linux API (${LINUX_API_BASE})  -->  Perk Sphere (reward authority)

- Partner websites send HMAC-signed events to the Linux API.
- The Linux API validates credentials, prevents replay, validates payloads,
  and delivers trusted events to Perk Sphere.
- Perk Sphere is the SOLE reward authority. No partner or Linux API event can
  issue Points or XP directly. Events feed task progress; rewards are issued
  exclusively through Perk Sphere's server-side completion path.

----------------------------------------
2. ONBOARDING (8 STEPS)
----------------------------------------

1. Partner registered in Perk Sphere (auto-completed)
2. Secure credentials generated (auto-completed)
3. Domain ownership verified
   - Add a DNS TXT record:
     Host: _perksphere.${(partner.verified_domains || [])[0] || "your-domain.com"}
     Value: ${partner.domain_verification_token || "(not generated)"}
   - An administrator verifies it in Admin > Partners > Setup
   - Verification is confirmed by the Linux API
4. Administrator review approved
5. Credentials configured on Linux API
   - Partner Key ID: ${partner.partner_key_id || "(not generated)"}
   - Partner Secret: (shown once at creation — store securely)
6. Partner-side implementation complete
   - Implement HMAC signing and event submission from your backend
7. Proof of possession verified
   - An admin generates a challenge; you sign it with your secret
   - Canonical: POST\\n/proof-of-possession\\nTIMESTAMP\\nNONCE\\nSHA256(challenge)
8. Test event verification passed
   - Send a test event with "is_test": true
   - An admin confirms it was received and processed
9. Integration activated by admin

----------------------------------------
3. EVENT SUBMISSION
----------------------------------------

Endpoint: POST ${LINUX_API_BASE}/events
Content-Type: application/json

Required headers:
  X-PS-Partner-Key   — your Partner Key ID
  X-PS-Timestamp     — Unix epoch seconds (±300s clock skew allowed)
  X-PS-Nonce         — unique random string (8–128 chars, [A-Za-z0-9._-])
  X-PS-Signature     — HMAC-SHA256 hex of the canonical string (see below)

Canonical string for signature (lines joined with \\n):
  METHOD\\nPATH\\nTIMESTAMP\\nNONCE\\nBODY_SHA256

  METHOD       = POST
  PATH         = /events
  TIMESTAMP    = same value as X-PS-Timestamp header
  NONCE        = same value as X-PS-Nonce header
  BODY_SHA256  = SHA-256 hex of the raw request body

Signature = HMAC-SHA256(partner_secret, canonical_string).toLowerCase()

----------------------------------------
4. EVENT PAYLOAD
----------------------------------------

{
  "external_event_id": "<unique-idempotent-id>",
  "event_type": "<one of the supported types below>",
  "user_reference": "<partner's account identifier for the user>",
  "content_id": "<optional content identifier>",
  "content_url": "<optional content URL>",
  "eligible_seconds": 0,
  "original_event_id": "<required for refund/chargeback events>",
  "is_test": false,
  "source_timestamp": "<ISO-8601 when the event occurred>",
  "event_data": {}
}

external_event_id MUST be unique per event. Duplicates are rejected (replay prevention).
Watch events require content_id or content_url — self-reported duration is not sufficient.
Refund events require original_event_id referencing the original purchase.

Supported event types for this partner:
  ${eventTypes}

Allowed task types:
  ${taskTypes}

----------------------------------------
5. SETUP CHECKLIST STATUS
----------------------------------------

Completed:
${completed.length ? completed.map((s) => "  [x] " + s).join("\\n") : "  (none yet)"}

Pending:
${pending.length ? pending.map((s) => "  [ ] " + s).join("\\n") : "  (all complete)"}

The integration remains in "Setup Required" status until all onboarding steps
are completed and an administrator activates it.

----------------------------------------
6. SECURITY NOTES
----------------------------------------

- Never expose the partner secret in client-side JavaScript or public repos.
- Use server-to-server calls from the partner backend to the Linux API.
- Rotate credentials immediately if a secret is compromised.
- Perk Sphere enforces that no event can directly issue rewards.
- A pending credential can never authenticate ordinary partner events.
- Nonces are single-use — replayed requests are rejected.
`;
}

export default function PartnerSetupGuide({ partner, onUpdateChecklist }) {
  const { toast } = useToast();
  const [checklist, setChecklist] = useState(partner.setup_checklist || {});
  const [linuxApiId, setLinuxApiId] = useState(partner.linux_api_partner_id || "");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggleStep = (key) => {
    const next = { ...checklist, [key]: !checklist[key] };
    setChecklist(next);
  };

  const saveChecklist = async () => {
    setSaving(true);
    try {
      await onUpdateChecklist({ ...checklist, linux_api_partner_id: linuxApiId });
      toast({ title: "Setup progress saved" });
    } catch (e) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const downloadGuide = () => {
    const guide = buildGuide(partner);
    const blob = new Blob([guide], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `perksphere-integration-${(partner.name || "partner").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyGuide = async () => {
    try {
      await navigator.clipboard.writeText(buildGuide(partner));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const completedCount = SETUP_STEPS.filter((s) => checklist[s.key]).length;
  const allDone = completedCount === SETUP_STEPS.length;
  const externalPending = SETUP_STEPS.filter((s) => s.external && !checklist[s.key]);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg border border-blue-300 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-950/30">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
        <div>
          <p className="text-sm font-medium text-blue-800 dark:text-blue-300">8-step onboarding — Setup Required until all steps are verified</p>
          <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">
            Perk Sphere has registered this partner and generated credentials. Domain verification, admin review, Linux API configuration, partner implementation, proof of possession, and test event verification are required before activation. A pending credential can never authenticate ordinary partner events.
          </p>
        </div>
      </div>

      {/* Domain verification token */}
      {partner.domain_verification_token && !partner.domain_verified_at && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/30">
          <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300"><Globe className="h-3.5 w-3.5" /> Domain verification token</p>
          <p className="mt-1 break-all font-mono text-xs text-amber-700 dark:text-amber-400">{partner.domain_verification_token}</p>
          <div className="mt-2 space-y-1 text-xs text-amber-700 dark:text-amber-400">
            <p className="font-medium">Add a DNS TXT record:</p>
            <p>Host: <code className="font-mono">_perksphere.{(partner.verified_domains || [])[0] || "your-domain.com"}</code></p>
            <p>Value: <code className="font-mono break-all">{partner.domain_verification_token}</code></p>
            <p className="mt-1">Once the DNS record is published, ask an administrator to verify domain ownership. Verification is confirmed by the Linux API.</p>
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Onboarding Checklist</h3>
          <span className="text-xs text-muted-foreground">{completedCount}/{SETUP_STEPS.length} complete</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${(completedCount / SETUP_STEPS.length) * 100}%` }} />
        </div>
        <div className="mt-3 space-y-2">
          {SETUP_STEPS.map((step) => {
            const done = !!checklist[step.key];
            const Icon = STEP_ICONS[step.key] || Check;
            return (
              <button
                key={step.key}
                type="button"
                onClick={() => toggleStep(step.key)}
                disabled={step.auto}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-accent disabled:opacity-60"
              >
                <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${done ? "border-emerald-600 bg-emerald-600 text-white" : "border-border"}`}>
                  {done && <Check className="h-3.5 w-3.5" />}
                </div>
                <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span className={`text-sm ${done ? "text-muted-foreground line-through" : ""}`}>{step.label}</span>
                {step.auto && <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">Auto</span>}
                {step.external && !step.auto && <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-500/15 dark:text-blue-400">External</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label>Linux API Partner ID (optional)</Label>
        <Input value={linuxApiId} onChange={(e) => setLinuxApiId(e.target.value)} className="mt-1.5" placeholder="Assigned by the Linux API once configured" />
        <p className="mt-1 text-xs text-muted-foreground">Reference to the partner record on the Linux API side, for cross-system traceability.</p>
      </div>

      {externalPending.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/30">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300">External steps pending:</p>
          <ul className="mt-1 space-y-0.5">
            {externalPending.map((s) => <li key={s.key} className="text-xs text-amber-700 dark:text-amber-400">• {s.label}</li>)}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={saveChecklist} disabled={saving}>{saving ? "Saving..." : "Save progress"}</Button>
        <Button variant="outline" size="sm" onClick={downloadGuide}><Download className="mr-1.5 h-3.5 w-3.5" /> Download integration guide</Button>
        <Button variant="outline" size="sm" onClick={copyGuide}>{copied ? <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />} Copy guide</Button>
      </div>

      <div className="rounded-lg bg-secondary p-3">
        <p className="text-xs font-medium">Integration endpoint</p>
        <p className="mt-1 font-mono text-xs">{LINUX_API_BASE}/events</p>
        <a href={LINUX_API_BASE} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400">
          <ExternalLink className="h-3 w-3" /> Open Linux API
        </a>
      </div>
    </div>
  );
}