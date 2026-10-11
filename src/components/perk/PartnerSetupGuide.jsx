import React, { useState } from "react";
import { Download, Copy, Check, ExternalLink, AlertTriangle, Shield, Globe, KeyRound, FileCheck, TestTube, Rocket, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Code2 } from "lucide-react";

const LINUX_API_BASE = "https://api.perksphere.org";

export const SETUP_STEPS = [
  { key: "base44_registered", label: "Partner registered in Perk Sphere", external: false, auto: true },
  { key: "credentials_generated", label: "Secure credentials generated", external: false, auto: true },
  { key: "domain_verified", label: "Domain ownership verified", external: true, linux: true },
  { key: "admin_reviewed", label: "Administrator review approved", external: false, manual: true },
  { key: "linux_api_configured", label: "Credentials configured on Linux API", external: true, auto: true },
  { key: "partner_implemented", label: "Partner-side implementation complete", external: true, manual: true },
  { key: "proof_of_possession", label: "Proof of possession verified", external: true, linux: true },
  { key: "test_event_verified", label: "Test event verification passed", external: true, linux: true },
  { key: "activated", label: "Integration activated by admin", external: false, approval: true }
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
   - An administrator verifies it via the Verify Domain button
   - Verification is confirmed by the Linux API
4. Administrator review approved
5. Credentials configured on Linux API
   - Partner Key ID: ${partner.partner_key_id || "(not generated)"}
   - Partner Secret: (shown once at creation — store securely)
6. Partner-side implementation complete
7. Proof of possession verified
   - An admin generates a challenge via the Linux API
   - The partner signs: PS-POSSESSION\\n<key_id>\\n<challenge_id>\\n<challenge>
   - The admin submits the signature to the Linux API for confirmation
8. Test event verification passed
   - Send a test event with "is_test": true to the Linux API
   - An admin confirms it was received and processed
9. Integration activated by admin (via independent approval workflow)

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
  "is_test": false,
  "source_timestamp": "<ISO-8601 when the event occurred>",
  "metadata": {}
}

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

export default function PartnerSetupGuide({ partner, onUpdateChecklist, onRefresh }) {
  const { toast } = useToast();
  const [checklist, setChecklist] = useState(partner.setup_checklist || {});
  const [saving, setSaving] = useState(false);
  const [verifyingDomain, setVerifyingDomain] = useState(false);
  const [proofChallenge, setProofChallenge] = useState(null);
  const [proofLoading, setProofLoading] = useState(false);
  const [syncingProof, setSyncingProof] = useState(false);
  const [proofSignature, setProofSignature] = useState("");
  const [verifyingTest, setVerifyingTest] = useState(false);

  const syncChecklist = (next) => {
    setChecklist(next);
  };

  const toggleManualStep = (key) => {
    const next = { ...checklist, [key]: !checklist[key] };
    syncChecklist(next);
  };

  const saveManualSteps = async () => {
    setSaving(true);
    try {
      await onUpdateChecklist(checklist);
      toast({ title: "Setup progress saved" });
    } catch (e) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const verifyDomain = async () => {
    setVerifyingDomain(true);
    try {
      const res = await base44.functions.invoke("managePartner", { action: "verifyDomain", partnerId: partner.id });
      const body = res?.data || res;
      if (body?.ok) {
        toast({ title: "Domain verified by Linux", description: "Domain ownership confirmed." });
        if (onRefresh) onRefresh();
      } else {
        toast({ title: "Domain verification failed", description: body?.error || "Linux could not verify the DNS record.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Domain verification failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setVerifyingDomain(false);
    }
  };

  const syncProofStatus = async () => {
    setSyncingProof(true);
    try {
      const res = await base44.functions.invoke('managePartner', { action: 'syncProofStatus', partnerId: partner.id });
      const body = res?.data || res;
      if (!body?.ok || !body?.possession_verified) throw new Error(body?.error || body?.message || 'Linux has not verified this credential.');
      toast({ title: 'Linux proof synchronised' });
      if (onRefresh) await onRefresh();
    } catch (e) {
      toast({ title: 'Proof sync failed', description: e?.response?.data?.error || e.message, variant: 'destructive' });
    } finally { setSyncingProof(false); }
  };

  const generateProofChallenge = async () => {
    setProofLoading(true);
    try {
      const res = await base44.functions.invoke("managePartner", { action: "createProofChallenge", partnerId: partner.id });
      const body = res?.data || res;
      if (body?.challenge_id) {
        setProofChallenge({ challenge_id: body.challenge_id, challenge: body.challenge, expires_in: body.expires_in });
        toast({ title: "Challenge generated", description: "Deliver the challenge to the partner for signing." });
      } else {
        toast({ title: "Failed", description: body?.error || "Could not generate challenge.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setProofLoading(false);
    }
  };

  const submitProofSignature = async () => {
    if (!proofSignature.trim()) {
      toast({ title: "Signature required", variant: "destructive" });
      return;
    }
    setProofLoading(true);
    try {
      const res = await base44.functions.invoke("managePartner", {
        action: "verifyProofOfPossession",
        partnerId: partner.id,
        data: { challenge_id: proofChallenge.challenge_id, challenge: proofChallenge.challenge, signature: proofSignature.trim() }
      });
      const body = res?.data || res;
      if (body?.ok) {
        toast({ title: "Proof of possession verified", description: "Credential ownership confirmed by Linux." });
        setProofChallenge(null);
        setProofSignature("");
        if (onRefresh) onRefresh();
      } else {
        toast({ title: "Proof verification failed", description: body?.error || "Linux rejected the signature.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Proof verification failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setProofLoading(false);
    }
  };

  const verifyTestEvent = async () => {
    setVerifyingTest(true);
    try {
      const res = await base44.functions.invoke("managePartner", {
        action: "verifyTestEvent",
        partnerId: partner.id
      });
      const body = res?.data || res;
      if (body?.ok && body?.test_event_verified === true) {
        toast({ title: "Test event verified", description: "The partner may now proceed to activation approval." });
        if (onRefresh) onRefresh();
      } else if (body?.ok && body?.test_event_verified === false) {
        toast({ title: "No verified test event yet", description: body.message || "Linux has not received a signed test event for this credential." });
      } else {
        toast({ title: "Linux test status unavailable", description: body?.error || body?.message || `Unexpected verification response${body?.code ? ` (${body.code})` : ""}.`, variant: "destructive" });
      }
    } catch (e) {
      const payload = e?.response?.data;
      const detail = typeof payload?.error === "string" ? payload.error : payload?.error?.message;
      toast({ title: "Linux test status request failed", description: detail || payload?.message || e.message, variant: "destructive" });
    } finally {
      setVerifyingTest(false);
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

  const completedCount = SETUP_STEPS.filter((s) => checklist[s.key]).length;
  const allOnboardingDone = SETUP_STEPS.filter((s) => s.key !== "activated").every((s) => checklist[s.key]);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg border border-blue-300 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-950/30">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
        <div>
          <p className="text-sm font-medium text-blue-800 dark:text-blue-300">8-step onboarding — Setup Required until all steps are verified</p>
          <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">
            Domain verification, proof of possession, and test event verification are confirmed by the Linux API — they cannot be manually toggled. Administrator review and partner implementation are admin-confirmed. Activation requires independent administrator approval.
          </p>
        </div>
      </div>

      {/* Domain verification token */}
      {partner.domain_verification_token && !checklist.domain_verified && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/30">
          <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300"><Globe className="h-3.5 w-3.5" /> Domain verification token</p>
          <p className="mt-1 break-all font-mono text-xs text-amber-700 dark:text-amber-400">{partner.domain_verification_token}</p>
          <div className="mt-2 space-y-1 text-xs text-amber-700 dark:text-amber-400">
            <p className="font-medium">Add a DNS TXT record:</p>
            <p>Host: <code className="font-mono">_perksphere.{(partner.verified_domains || [])[0] || "your-domain.com"}</code></p>
            <p>Value: <code className="font-mono break-all">{partner.domain_verification_token}</code></p>
            <p className="mt-1">Once the DNS record is published, click Verify Domain to confirm with the Linux API.</p>
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
            const isManual = step.manual;
            const isLinux = step.linux;
            const isApproval = step.approval;
            const isAuto = step.auto;

            return (
              <div key={step.key}>
                <div className={`flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left ${!isManual ? "cursor-default" : "cursor-pointer hover:bg-accent"}`}
                  onClick={isManual ? () => toggleManualStep(step.key) : undefined}>
                  <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${done ? "border-emerald-600 bg-emerald-600 text-white" : "border-border"}`}>
                    {done && <Check className="h-3.5 w-3.5" />}
                  </div>
                  <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <span className={`text-sm ${done ? "text-muted-foreground line-through" : ""}`}>{step.label}</span>
                  {isAuto && <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">Auto</span>}
                  {isLinux && !done && <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-500/15 dark:text-blue-400">Linux</span>}
                  {isManual && <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-500/15 dark:text-slate-400">Admin</span>}
                  {isApproval && <span className="ml-auto rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-500/15 dark:text-purple-400">Approval</span>}
                </div>

                {/* Domain verification action */}
                {isLinux && step.key === "domain_verified" && !done && (
                  <div className="ml-8 mt-1.5">
                    <Button size="sm" variant="outline" onClick={verifyDomain} disabled={verifyingDomain}>
                      {verifyingDomain ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Globe className="mr-1.5 h-3.5 w-3.5" />}
                      Verify Domain (Linux)
                    </Button>
                  </div>
                )}

                {/* Proof of possession flow */}
                {isLinux && step.key === "proof_of_possession" && !done && (
                  <div className="ml-8 mt-1.5 space-y-2">
                    {!proofChallenge ? (
                      <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={syncProofStatus} disabled={syncingProof}>
                        Sync verified proof from Linux
                      </Button>
                      <Button size="sm" variant="outline" onClick={generateProofChallenge} disabled={proofLoading}>
                        {proofLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <KeyRound className="mr-1.5 h-3.5 w-3.5" />}
                        Generate Challenge
                      </Button>
                      </div>
                    ) : (
                      <div className="space-y-2 rounded-lg border border-border bg-secondary/50 p-3">
                        <div>
                          <Label className="text-xs">Challenge ID</Label>
                          <Input readOnly value={proofChallenge.challenge_id} className="mt-1 font-mono text-xs" />
                        </div>
                        <div>
                          <Label className="text-xs">Challenge</Label>
                          <Textarea readOnly value={proofChallenge.challenge} className="mt-1 font-mono text-xs" />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          The partner must sign: <code className="font-mono">PS-POSSESSION\n&lt;key_id&gt;\n&lt;challenge_id&gt;\n&lt;challenge&gt;</code> using HMAC-SHA256 with their secret.
                        </div>
                        <div>
                          <Label className="text-xs">Partner Signature (hex)</Label>
                          <Input value={proofSignature} onChange={(e) => setProofSignature(e.target.value)} className="mt-1 font-mono text-xs" placeholder="64-char hex HMAC-SHA256 signature" />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={submitProofSignature} disabled={proofLoading}>
                            {proofLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
                            Submit to Linux
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setProofChallenge(null); setProofSignature(""); }}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Test event verification — awaiting backend test verification */}
                {isLinux && step.key === "test_event_verified" && !done && (
                  <div className="ml-8 mt-1.5">
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                      <p className="flex items-center gap-1.5 font-medium"><TestTube className="h-3.5 w-3.5" /> Signed test-event verification</p>
                      <p className="mt-1">Send a signed pre-activation test from the partner backend to POST /partners/test-event, then synchronise the verified Linux receipt. No production event or reward is created.</p>
                    </div>
                    <Button size="sm" variant="outline" className="mt-2" onClick={verifyTestEvent} disabled={verifyingTest}>
                      {verifyingTest ? "Checking Linux..." : "Sync verified test from Linux"}
                    </Button>
                  </div>
                )}

                {/* Activation approval note */}
                {isApproval && !done && (
                  <div className="ml-8 mt-1.5">
                    <div className="rounded-lg border border-purple-300 bg-purple-50 p-2 text-xs text-purple-700 dark:border-purple-700 dark:bg-purple-950/30 dark:text-purple-400">
                      {allOnboardingDone
                        ? "All onboarding steps complete. Use the Approve & Activate button on the partner card to submit the activation approval to Linux."
                        : "Complete all onboarding steps first, then use the Approve & Activate button on the partner card."}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={saveManualSteps} disabled={saving}>{saving ? "Saving..." : "Save admin steps"}</Button>
        <Button variant="outline" size="sm" onClick={downloadGuide}><Download className="mr-1.5 h-3.5 w-3.5" /> Download guide</Button>
        <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(buildGuide(partner)).then(() => toast({ title: "Guide copied" }))}><Copy className="mr-1.5 h-3.5 w-3.5" /> Copy guide</Button>
      </div>

      <div className="rounded-lg bg-secondary p-3">
        <p className="text-xs font-medium">Production event endpoint (Linux API)</p>
        <p className="mt-1 font-mono text-xs">{LINUX_API_BASE}/events</p>
        <a href={LINUX_API_BASE} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400">
          <ExternalLink className="h-3 w-3" /> Open Linux API
        </a>
      </div>
    </div>
  );
}
