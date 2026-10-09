import React, { useState } from "react";
import { Shield, KeyRound, Activity, AlertTriangle, CheckCircle2, XCircle, Clock, TrendingUp, FileCheck, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import ConfirmDialog from "@/components/perk/ConfirmDialog";

const VERIFICATION_STYLES = {
  unverified: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  domain_verified: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  credential_verified: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400",
  fully_verified: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
};

export default function PartnerDetail({ partner, events, onClose, onRefresh }) {
  const { toast } = useToast();
  const [rewardPolicy, setRewardPolicy] = useState({
    daily_points_limit: partner.daily_points_limit || 0,
    daily_xp_limit: partner.daily_xp_limit || 0,
    points_per_event: partner.points_per_event || 0,
    xp_per_event: partner.xp_per_event || 0
  });
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [proofChallenge, setProofChallenge] = useState(null);
  const [proofChallengeId, setProofChallengeId] = useState(null);
  const [proofForm, setProofForm] = useState({ timestamp: "", nonce: "", signature: "" });
  const [verifyingProof, setVerifyingProof] = useState(false);
  const [creatingProof, setCreatingProof] = useState(false);

  const partnerEvents = (events || []).filter((e) => e.partner_integration_id === partner.id);
  const processed = partnerEvents.filter((e) => e.processing_status === "processed");
  const rejected = partnerEvents.filter((e) => e.processing_status === "rejected" || e.processing_status === "error");
  const refunds = partnerEvents.filter((e) => e.is_refund);
  const testEvents = partnerEvents.filter((e) => e.is_test_event);

  const checklist = partner.setup_checklist || {};
  const verificationSteps = [
    { key: "domain_verified", label: "Domain ownership", done: !!partner.domain_verified_at },
    { key: "proof_of_possession", label: "Proof of possession", done: !!partner.proof_of_possession_verified },
    { key: "test_event_verified", label: "Test event", done: !!partner.test_event_verified }
  ];

  const createProofChallenge = async () => {
    setCreatingProof(true);
    try {
      const res = await base44.functions.invoke("managePartner", {
        action: "createProofChallenge",
        partnerId: partner.id
      });
      const data = res?.data || res;
      if (data?.challenge) {
        setProofChallenge(data.challenge);
        setProofChallengeId(data.challenge_id);
        setProofForm({ timestamp: "", nonce: "", signature: "" });
      } else {
        toast({ title: "Failed", description: data?.error || "No challenge returned", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setCreatingProof(false);
    }
  };

  const verifyProof = async () => {
    setVerifyingProof(true);
    try {
      await base44.functions.invoke("managePartner", {
        action: "verifyProofOfPossession",
        partnerId: partner.id,
        data: { challenge_id: proofChallengeId, ...proofForm }
      });
      toast({ title: "Proof of possession verified" });
      setProofChallenge(null);
      setProofChallengeId(null);
      onRefresh();
    } catch (e) {
      toast({ title: "Verification failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setVerifyingProof(false);
    }
  };

  const saveRewardPolicy = async () => {
    setSavingPolicy(true);
    try {
      await base44.functions.invoke("managePartner", {
        action: "updateRewardPolicy",
        partnerId: partner.id,
        data: rewardPolicy
      });
      toast({ title: "Reward policy saved" });
      onRefresh();
    } catch (e) {
      toast({ title: "Failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setSavingPolicy(false);
    }
  };

  const verifyDomain = async () => {
    try {
      await base44.functions.invoke("managePartner", { action: "verifyDomain", partnerId: partner.id });
      toast({ title: "Domain verified" });
      onRefresh();
    } catch (e) {
      toast({ title: "Failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    }
  };

  const verifyTestEvent = async () => {
    try {
      await base44.functions.invoke("managePartner", { action: "verifyTestEvent", partnerId: partner.id, data: {} });
      toast({ title: "Test event verified" });
      onRefresh();
    } catch (e) {
      toast({ title: "Failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-5">
      {/* Status Overview */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Integration Status</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${partner.integration_status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" : "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300"}`}>{partner.integration_status}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Verification Status</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${VERIFICATION_STYLES[partner.verification_status] || VERIFICATION_STYLES.unverified}`}>{(partner.verification_status || "unverified").replace(/_/g, " ")}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Connection Health</span>
            <span className={`text-xs font-medium ${partner.connection_health === "healthy" ? "text-emerald-600 dark:text-emerald-400" : partner.connection_health === "degraded" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>● {partner.connection_health || "unconfigured"}</span>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="grid grid-cols-2 gap-2">
            <div><p className="text-xs text-muted-foreground">Events received</p><p className="text-lg font-semibold">{partner.total_events_received || 0}</p></div>
            <div><p className="text-xs text-muted-foreground">Delivery failures</p><p className="text-lg font-semibold text-red-600 dark:text-red-400">{partner.total_delivery_failures || 0}</p></div>
            <div><p className="text-xs text-muted-foreground">Processed</p><p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{processed.length}</p></div>
            <div><p className="text-xs text-muted-foreground">Rejected</p><p className="text-sm font-semibold text-red-600 dark:text-red-400">{rejected.length}</p></div>
          </div>
        </div>
      </div>

      {/* Verification Steps */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Shield className="h-4 w-4" /> Verification</h3>
        <div className="mt-3 space-y-2">
          {verificationSteps.map((step) => (
            <div key={step.key} className="flex items-center justify-between rounded-lg border border-border p-2.5">
              <div className="flex items-center gap-2">
                {step.done ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
                <span className="text-sm">{step.label}</span>
              </div>
              {!step.done && step.key === "domain_verified" && (
                <Button size="sm" variant="outline" onClick={verifyDomain}>Verify domain</Button>
              )}
              {!step.done && step.key === "proof_of_possession" && (
                <Button size="sm" variant="outline" onClick={createProofChallenge} disabled={creatingProof}>{creatingProof ? "Creating..." : "Start proof"}</Button>
              )}
              {!step.done && step.key === "test_event_verified" && (
                <Button size="sm" variant="outline" onClick={verifyTestEvent}>Mark verified</Button>
              )}
            </div>
          ))}
        </div>
        {partner.domain_verification_token && !partner.domain_verified_at && (
          <div className="mt-3 rounded-lg bg-secondary p-3">
            <p className="text-xs font-medium">Domain verification — DNS TXT record</p>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <p>Host: <code className="font-mono">_perksphere.{partner.verified_domains?.[0] || "your-domain.com"}</code></p>
              <p>Value: <code className="font-mono break-all">{partner.domain_verification_token}</code></p>
              <p className="mt-1">Once published, click "Verify domain" — verification is confirmed by the Linux API.</p>
            </div>
          </div>
        )}
      </div>

      {/* Proof of Possession Dialog */}
      {proofChallenge && (
        <div className="rounded-xl border border-indigo-300 bg-indigo-50 p-4 dark:border-indigo-700 dark:bg-indigo-950/30">
          <h3 className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">Proof of Possession</h3>
          <p className="mt-1 text-xs text-indigo-700 dark:text-indigo-400">The partner must sign this challenge with their HMAC secret to prove they hold it.</p>
          <div className="mt-2 rounded-lg bg-white p-2 dark:bg-indigo-950/50">
            <p className="break-all font-mono text-xs">{proofChallenge}</p>
          </div>
          <div className="mt-3 space-y-2">
            <div><Label className="text-xs">Timestamp (Unix seconds)</Label><Input value={proofForm.timestamp} onChange={(e) => setProofForm({ ...proofForm, timestamp: e.target.value })} className="mt-1 font-mono text-xs" placeholder="1696789200" /></div>
            <div><Label className="text-xs">Nonce</Label><Input value={proofForm.nonce} onChange={(e) => setProofForm({ ...proofForm, nonce: e.target.value })} className="mt-1 font-mono text-xs" placeholder="unique-nonce-string" /></div>
            <div><Label className="text-xs">Signature (HMAC-SHA256 hex)</Label><Input value={proofForm.signature} onChange={(e) => setProofForm({ ...proofForm, signature: e.target.value })} className="mt-1 font-mono text-xs" placeholder="abcdef..." /></div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Challenge ID: <code className="font-mono">{proofChallengeId}</code></p>
          <p className="mt-1 text-xs text-muted-foreground">The partner signs the challenge with their HMAC secret and submits the signature. Verification is confirmed by the Linux API.</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={verifyProof} disabled={verifyingProof || !proofForm.timestamp || !proofForm.nonce || !proofForm.signature}>{verifyingProof ? "Verifying..." : "Verify"}</Button>
            <Button size="sm" variant="outline" onClick={() => { setProofChallenge(null); setProofChallengeId(null); }}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Credential Metadata */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4" /> Credential Metadata</h3>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Partner Key ID</span><span className="font-mono text-xs">{partner.partner_key_id?.slice(0, 24) || "—"}…</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Secret hash</span><span className="font-mono text-xs">{partner.partner_secret_hash?.slice(0, 16) || "—"}…</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Linux API Partner ID</span><span className="text-xs">{partner.linux_api_partner_id || "—"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Last credential rotation</span><span className="text-xs">{partner.proof_of_possession_at ? new Date(partner.proof_of_possession_at).toLocaleDateString("en-GB") : "—"}</span></div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Secrets are encrypted at rest and never exposed. Rotate to generate new credentials (requires re-verification).</p>
      </div>

      {/* Reward Policy */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><DollarSign className="h-4 w-4" /> Reward Policy</h3>
        <p className="mt-1 text-xs text-muted-foreground">Per-partner reward limits. Events still flow through the trusted completion path — these are caps, not direct issuance.</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Daily Points limit</Label><Input type="number" value={rewardPolicy.daily_points_limit} onChange={(e) => setRewardPolicy({ ...rewardPolicy, daily_points_limit: Number(e.target.value) })} className="mt-1" /></div>
          <div><Label className="text-xs">Daily XP limit</Label><Input type="number" value={rewardPolicy.daily_xp_limit} onChange={(e) => setRewardPolicy({ ...rewardPolicy, daily_xp_limit: Number(e.target.value) })} className="mt-1" /></div>
          <div><Label className="text-xs">Points per event</Label><Input type="number" value={rewardPolicy.points_per_event} onChange={(e) => setRewardPolicy({ ...rewardPolicy, points_per_event: Number(e.target.value) })} className="mt-1" /></div>
          <div><Label className="text-xs">XP per event</Label><Input type="number" value={rewardPolicy.xp_per_event} onChange={(e) => setRewardPolicy({ ...rewardPolicy, xp_per_event: Number(e.target.value) })} className="mt-1" /></div>
        </div>
        <Button size="sm" className="mt-3" onClick={saveRewardPolicy} disabled={savingPolicy}>{savingPolicy ? "Saving..." : "Save policy"}</Button>
      </div>

      {/* Recent Events */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Activity className="h-4 w-4" /> Recent Events ({partnerEvents.length})</h3>
        {partnerEvents.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">No events received yet.</p>
        ) : (
          <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
            {partnerEvents.slice(0, 20).map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-lg border border-border p-2 text-xs">
                <div className="min-w-0">
                  <span className="font-medium">{e.event_type?.replace(/_/g, " ")}</span>
                  {e.is_test_event && <span className="ml-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700 dark:bg-blue-500/15 dark:text-blue-400">test</span>}
                  {e.is_refund && <span className="ml-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700 dark:bg-red-500/15 dark:text-red-400">refund</span>}
                </div>
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${e.processing_status === "processed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" : e.processing_status === "rejected" || e.processing_status === "error" ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400" : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"}`}>{e.processing_status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security Alerts */}
      {(rejected.length > 0 || refunds.length > 0 || (partner.total_delivery_failures || 0) > 0) && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300"><AlertTriangle className="h-4 w-4" /> Security Alerts</h3>
          <div className="mt-2 space-y-1.5 text-xs text-amber-700 dark:text-amber-400">
            {rejected.length > 0 && <p>• {rejected.length} rejected/error event(s) — review event payloads and authentication</p>}
            {refunds.length > 0 && <p>• {refunds.length} refund/chargeback event(s) — completions flagged for review</p>}
            {(partner.total_delivery_failures || 0) > 0 && <p>• {partner.total_delivery_failures} total delivery failure(s) — check partner endpoint health</p>}
          </div>
        </div>
      )}
    </div>
  );
}