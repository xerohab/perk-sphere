import React, { useState } from "react";
import { Download, Copy, Check, ExternalLink, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

const LINUX_API_BASE = "https://api.perksphere.org";

// Setup checklist steps. The first two are completed automatically on partner
// creation. The remaining steps require external work (Linux API config,
// partner-side implementation, verification) and keep the integration in
// "Setup Required" until an admin marks them complete.
export const SETUP_STEPS = [
  { key: "base44_registered", label: "Partner registered in Perk Sphere", external: false },
  { key: "credentials_generated", label: "Credentials generated", external: false },
  { key: "linux_api_configured", label: "Credentials configured on Linux API", external: true },
  { key: "partner_implemented", label: "Partner-side implementation complete", external: true },
  { key: "verification_passed", label: "Verification test passed", external: true },
  { key: "activated", label: "Integration activated", external: false }
];

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
2. CREDENTIALS
----------------------------------------

Partner Key ID: ${partner.partner_key_id || "(not generated yet)"}
Partner Secret: (shown once at creation or rotation — store securely)

The partner secret is NEVER stored in plaintext and cannot be retrieved again.
If lost, rotate credentials from the Admin > Partners page.

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
  "source_timestamp": "<ISO-8601 when the event occurred>",
  "event_data": {}
}

external_event_id MUST be unique per event. The Linux API rejects duplicates
(replay prevention).

Supported event types for this partner:
  ${eventTypes}

Allowed task types:
  ${taskTypes}

----------------------------------------
5. SETUP CHECKLIST
----------------------------------------

Completed:
${completed.length ? completed.map((s) => "  [x] " + s).join("\\n") : "  (none yet)"}

Pending:
${pending.length ? pending.map((s) => "  [ ] " + s).join("\\n") : "  (all complete)"}

The integration remains in "Setup Required" status until all external steps
are completed and an administrator activates it.

----------------------------------------
6. SECURITY NOTES
----------------------------------------

- Never expose the partner secret in client-side JavaScript or public repos.
- Use server-to-server calls from the partner backend to the Linux API.
- Rotate credentials immediately if a secret is compromised.
- Perk Sphere enforces that no event can directly issue rewards.
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
          <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Setup Required until external work is verified</p>
          <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">
            Perk Sphere has registered this partner and generated credentials. The Linux API configuration, partner-side implementation, and verification test require external work. The integration cannot be activated until all steps are complete.
          </p>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Setup Checklist</h3>
          <span className="text-xs text-muted-foreground">{completedCount}/{SETUP_STEPS.length} complete</span>
        </div>
        <div className="space-y-2">
          {SETUP_STEPS.map((step) => {
            const done = !!checklist[step.key];
            return (
              <button
                key={step.key}
                type="button"
                onClick={() => toggleStep(step.key)}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-accent"
              >
                <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${done ? "border-emerald-600 bg-emerald-600 text-white" : "border-border"}`}>
                  {done && <Check className="h-3.5 w-3.5" />}
                </div>
                <span className={`text-sm ${done ? "text-muted-foreground line-through" : ""}`}>{step.label}</span>
                {step.external && <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-500/15 dark:text-blue-400">External</span>}
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