import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Pencil, Trash2, KeyRound, Ban, AlertTriangle, ExternalLink, Activity, Package, Settings2, Eye, FileCheck, XCircle, RefreshCw, Rocket, Loader2, Link2, ShieldCheck, LifeBuoy, Globe, CheckCircle2 } from "lucide-react";
import PageHeader from "@/components/perk/PageHeader";
import EmptyState from "@/components/perk/EmptyState";
import ConfirmDialog from "@/components/perk/ConfirmDialog";
import PartnerIntegrationKits from "@/components/perk/PartnerIntegrationKits";
import PartnerSetupGuide from "@/components/perk/PartnerSetupGuide";
import PartnerDetail from "@/components/perk/PartnerDetail";
import PartnerCredentialHandoff from "@/components/perk/PartnerCredentialHandoff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const KIT_TYPES = [
  { value: "universal_api", label: "Universal API Kit" },
  { value: "wordpress_woocommerce", label: "WordPress / WooCommerce" },
  { value: "streaming_sdk", label: "Streaming SDK" },
  { value: "custom", label: "Custom" }
];

const PARTNER_TYPES = [
  { value: "custom_website", label: "Custom Website" },
  { value: "streaming_platform", label: "Streaming Platform" },
  { value: "membership_subscription", label: "Membership / Subscription Platform" },
  { value: "wordpress_woocommerce", label: "WordPress / WooCommerce" },
  { value: "other", label: "Other" }
];

const ALL_EVENT_TYPES = [
  "ACCOUNT_REGISTERED", "ACCOUNT_LINKED", "ACCOUNT_DISABLED",
  "VIDEO_WATCH_PROGRESS", "STREAM_STARTED", "STREAM_VIEW_PROGRESS", "STREAM_ENDED",
  "PURCHASE_COMPLETED", "PURCHASE_REFUNDED", "CHARGEBACK_ISSUED",
  "SUBSCRIPTION_ACTIVATED", "SUBSCRIPTION_RENEWED", "SUBSCRIPTION_CANCELLED"
];

const VERIFICATION_STYLES = {
  unverified: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  domain_verified: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  credential_verified: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400",
  fully_verified: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
};

const STATUS_STYLES = {
  pending: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
  linux_integration_pending: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  setup_required: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  suspended: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  disabled: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  archived: "bg-zinc-100 text-zinc-500 dark:bg-zinc-500/15 dark:text-zinc-400"
};

const HEALTH_STYLES = {
  healthy: "text-emerald-600 dark:text-emerald-400",
  degraded: "text-amber-600 dark:text-amber-400",
  down: "text-red-600 dark:text-red-400",
  unconfigured: "text-muted-foreground"
};

const empty = {
  name: "", partner_type: "custom_website", integration_kit_type: "universal_api", website_url: "", description: "", logo: "",
  verified_domains: "", supported_event_types: [], allowed_task_types: [],
  setup_instructions: ""
};

export default function AdminPartners() {
  const { toast } = useToast();
  const [partners, setPartners] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [credentialResult, setCredentialResult] = useState(null);
  const [setupGuidePartner, setSetupGuidePartner] = useState(null);
  const [detailPartner, setDetailPartner] = useState(null);
  const [activeTab, setActiveTab] = useState("partners");
  const [approving, setApproving] = useState(null);
  const [reissuing, setReissuing] = useState(null);
  const [verifying, setVerifying] = useState(null);
  const [syncingProof, setSyncingProof] = useState(null);
  const [uuidPartner, setUuidPartner] = useState(null);
  const [uuidForm, setUuidForm] = useState({ linux_api_partner_id: "", partner_key_id: "" });
  const [savingUuid, setSavingUuid] = useState(false);
  const [handoffPartner, setHandoffPartner] = useState(null);

  const load = async (silent) => {
    if (!silent) setLoading(true);
    try {
      const [p, e] = await Promise.all([
        base44.entities.PartnerIntegration.list('-created_date', 200),
        base44.entities.PartnerEvent.list('-created_date', 50)
      ]);
      setPartners(p || []);
      setSetupGuidePartner(current => current ? ((p || []).find(item => item.id === current.id) || current) : null);
      setEvents(e || []);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing({}); setForm({ ...empty }); };
  const openEdit = (p) => { setEditing(p); setForm({ ...empty, ...p, verified_domains: (p.verified_domains || []).join("\n"), supported_event_types: p.supported_event_types || [], allowed_task_types: p.allowed_task_types || [] }); };

  const save = async () => {
    if (!form.name) { toast({ title: "Name is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        partner_type: form.partner_type,
        integration_kit_type: form.integration_kit_type,
        website_url: form.website_url,
        description: form.description,
        logo: form.logo,
        verified_domains: (form.verified_domains || "").split("\n").map((d) => d.trim()).filter(Boolean),
        supported_event_types: form.supported_event_types,
        allowed_task_types: form.allowed_task_types,
        setup_instructions: form.setup_instructions
      };
      const res = await base44.functions.invoke("managePartner", { action: editing?.id ? "update" : "create", partnerId: editing?.id, data: payload });
      const body = res?.data || res;
      if (body?.partner_secret) {
        setCredentialResult({ partner_key_id: body.partner_key_id, partner_secret: body.partner_secret, domain_verification_token: body.domain_verification_token, name: payload.name, isNew: true });
      } else {
        toast({ title: editing?.id ? "Partner updated" : "Partner created" });
      }
      setEditing(null);
      load(true);
    } catch (e) {
      toast({ title: "Save failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (partner, status) => {
    try {
      await base44.functions.invoke("managePartner", { action: "setStatus", partnerId: partner.id, status });
      toast({ title: `Partner ${status}` });
      load(true);
    } catch (e) {
      toast({ title: "Failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    }
  };

  const reviewPartner = async (partner, approved) => {
    try {
      await base44.functions.invoke("managePartner", { action: "reviewPartner", partnerId: partner.id, data: { approved } });
      toast({ title: approved ? "Partner approved" : "Partner rejected" });
      load(true);
    } catch (e) {
      toast({ title: "Failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    }
  };

  const verifyDomain = async (partner) => {
    if (verifying) return;
    setVerifying(partner.id);
    try {
      const res = await base44.functions.invoke("managePartner", { action: "verifyDomain", partnerId: partner.id });
      const body = res?.data || res;
      toast({ title: "Domain verified", description: `Linux confirmed DNS ownership (HTTP ${body.linux_status || 200}).` });
      load(true);
    } catch (e) {
      const errData = e?.response?.data || {};
      toast({
        title: errData.retryable ? "Domain verification failed" : "Linux error",
        description: errData.message || errData.error || e.message,
        variant: "destructive"
      });
    } finally {
      setVerifying(null);
    }
  };

  const syncProofStatus = async (partner) => {
    if (syncingProof) return;
    setSyncingProof(partner.id);
    try {
      const res = await base44.functions.invoke("managePartner", { action: "syncProofStatus", partnerId: partner.id });
      const body = res?.data || res;
      if (body?.possession_verified) {
        toast({ title: "Proof status synced", description: `Linux confirmed credential possession (HTTP ${body.linux_status || 200}).` });
        load(true);
      } else {
        toast({ title: "Proof not yet verified", description: body?.message || "Linux has not confirmed proof of possession.", variant: "default" });
      }
    } catch (e) {
      const errData = e?.response?.data || {};
      toast({ title: "Sync failed", description: errData.error || e.message, variant: "destructive" });
    } finally {
      setSyncingProof(null);
    }
  };

  const rotateCredential = async (partner) => {
    try {
      const res = await base44.functions.invoke("managePartner", { action: "rotateCredential", partnerId: partner.id });
      const body = res?.data || res;
      if (body?.partner_secret) {
        setCredentialResult({ partner_key_id: body.partner_key_id, partner_secret: body.partner_secret, name: partner.name, isNew: false });
      }
      load(true);
    } catch (e) {
      toast({ title: "Rotation failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    }
  };

  const reissueInitialCredential = async (partner) => {
    if (reissuing) return;
    setReissuing(partner.id);
    try {
      const res = await base44.functions.invoke("managePartner", { action: "reissueInitialCredential", partnerId: partner.id });
      const body = res?.data || res;
      if (body?.partner_secret) {
        setCredentialResult({ partner_key_id: body.partner_key_id, partner_secret: body.partner_secret, name: partner.name, isNew: false });
      } else {
        toast({ title: "Credential reissued" });
      }
      load(true);
    } catch (e) {
      toast({ title: "Reissue failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setReissuing(null);
    }
  };

  const recoverPartner = async (partner) => {
    try {
      const res = await base44.functions.invoke("managePartner", { action: "recoverPartner", partnerId: partner.id });
      const body = res?.data || res;
      if (body?.partner_secret) {
        setCredentialResult({ partner_key_id: body.partner_key_id, partner_secret: body.partner_secret, name: partner.name, isNew: false });
      }
      load(true);
    } catch (e) {
      toast({ title: "Recovery failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    }
  };

  const revokeCredential = async (partner) => {
    try {
      await base44.functions.invoke("managePartner", { action: "revokeCredential", partnerId: partner.id });
      toast({ title: "Credentials revoked" });
      load(true);
    } catch (e) {
      toast({ title: "Failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    }
  };

  const retryProvisioning = async (partner) => {
    try {
      const res = await base44.functions.invoke("managePartner", { action: "retryProvisioning", partnerId: partner.id });
      const body = res?.data || res;
      if (body?.partner_secret) {
        setCredentialResult({ partner_key_id: body.partner_key_id, partner_secret: body.partner_secret, domain_verification_token: body.domain_verification_token, linux_api_partner_id: body.linux_api_partner_id, name: partner.name, isNew: true });
      } else {
        toast({ title: "Provisioning completed" });
      }
      load(true);
    } catch (e) {
      toast({ title: "Provisioning still pending", description: e?.response?.data?.error || e.message, variant: "destructive" });
    }
  };

  const remove = async (partner) => {
    try {
      await base44.functions.invoke("managePartner", { action: "delete", partnerId: partner.id });
      toast({ title: "Partner deleted" });
      load(true);
    } catch (e) {
      toast({ title: "Failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    }
  };

  const updateSetup = async (checklist) => {
    try {
      await base44.functions.invoke("managePartner", { action: "updateSetup", partnerId: setupGuidePartner.id, data: { setup_checklist: checklist, linux_api_partner_id: checklist.linux_api_partner_id } });
      load(true);
    } catch (e) {
      toast({ title: "Failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
      throw e;
    }
  };

  const approveActivation = async (partner, decision) => {
    setApproving(partner.id);
    try {
      const res = await base44.functions.invoke("approvePartnerActivation", { partnerId: partner.id, decision });
      const body = res?.data || res;
      if (body?.ok) {
        if (decision === "approve") {
          if (body.activated) {
            toast({ title: "Partner activated", description: "Linux confirmed activation. The partner is now live." });
          } else {
            toast({ title: "Approval recorded", description: "The approval was recorded but Linux did not confirm activation. The partner remains inactive.", variant: "default" });
          }
        } else {
          toast({ title: "Activation rejected", description: "The partner has been suspended." });
        }
        load(true);
      } else {
        toast({ title: decision === "approve" ? "Activation failed" : "Rejection failed", description: body?.error || "Unexpected response", variant: "destructive" });
      }
    } catch (e) {
      const errData = e?.response?.data || {};
      toast({ title: decision === "approve" ? "Activation failed" : "Rejection failed", description: errData.error || e.message, variant: "destructive" });
    } finally {
      setApproving(null);
    }
  };

  const openUuidDialog = (partner) => {
    setUuidPartner(partner);
    setUuidForm({ linux_api_partner_id: partner.linux_api_partner_id || "", partner_key_id: partner.partner_key_id || "" });
  };

  const saveLinuxUuid = async () => {
    if (!uuidPartner) return;
    const uuid = uuidForm.linux_api_partner_id.trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) { toast({ title: "Invalid UUID format", description: "Linux Partner UUID must be a valid UUID", variant: "destructive" }); return; }
    setSavingUuid(true);
    try {
      await base44.functions.invoke("managePartner", { action: "setLinuxPartnerId", partnerId: uuidPartner.id, data: { linux_api_partner_id: uuid } });
      toast({ title: "Linux UUID saved", description: "You can now rotate credentials and use the credential handoff." });
      setUuidPartner(null);
      load(true);
    } catch (e) {
      toast({ title: "Failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setSavingUuid(false);
    }
  };

  const toggleEventType = (et) => {
    const current = form.supported_event_types || [];
    setForm({ ...form, supported_event_types: current.includes(et) ? current.filter((x) => x !== et) : [...current, et] });
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  return (
    <div>
      <PageHeader title="Partner Integrations" description="Manage partner websites and event integrations. New integrations default to Pending." actions={<Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Add Partner</Button>} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="partners">Partners</TabsTrigger>
          <TabsTrigger value="kits"><Package className="mr-1 h-4 w-4" /> Integration Kits</TabsTrigger>
          <TabsTrigger value="events"><Activity className="mr-1 h-4 w-4" /> Event History</TabsTrigger>
        </TabsList>

        <TabsContent value="partners" className="mt-6">
          {partners.length === 0 ? (
            <EmptyState title="No partner integrations" description="Add a partner to configure event-based integrations." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {partners.map((p) => (
                <div key={p.id} className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold">{p.name}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">{PARTNER_TYPES.find((t) => t.value === p.partner_type)?.label || p.partner_type}</p>
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${(STATUS_STYLES[p.integration_status] || STATUS_STYLES.pending)}`}>{p.integration_status}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${VERIFICATION_STYLES[p.verification_status] || VERIFICATION_STYLES.unverified}`}>{(p.verification_status || "unverified").replace(/_/g, " ")}</span>
                    </div>
                  </div>
                  {p.website_url && <a href={p.website_url} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400"><ExternalLink className="h-3 w-3" /> {p.website_url}</a>}
                  {p.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {(p.supported_event_types || []).slice(0, 4).map((et) => <span key={et} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{et.replace(/_/g, " ").toLowerCase()}</span>)}
                    {(p.supported_event_types || []).length > 4 && <span className="text-xs text-muted-foreground">+{(p.supported_event_types || []).length - 4} more</span>}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className={HEALTH_STYLES[p.connection_health] || "text-muted-foreground"}>● {p.connection_health || "unconfigured"}</span>
                    <span className="text-muted-foreground">{p.total_events_received || 0} events</span>
                  </div>
                  {p.domain_verified_at ? (
                    <div className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> Domain verified {new Date(p.domain_verified_at).toLocaleDateString("en-GB")}
                    </div>
                  ) : p.linux_api_partner_id && (
                    <div className="mt-1.5 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <Globe className="h-3 w-3" /> Domain not verified
                    </div>
                  )}
                  {p.linux_api_partner_id && <p className="mt-2 font-mono text-xs text-muted-foreground">UUID: {p.linux_api_partner_id.slice(0, 18)}…</p>}
                  {p.partner_key_id && <p className="mt-2 font-mono text-xs text-muted-foreground">Key: {p.partner_key_id.slice(0, 20)}…</p>}
                  {p.linux_api_partner_id && p.partner_key_id?.startsWith("pk_") && (
                    <div className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" /> Stale pk_ key — {p.integration_status === "active" ? "rotate" : "reissue"} to issue psp_ credentials
                    </div>
                  )}
                  {p.linux_api_partner_id && !p.partner_key_id && (
                    <div className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" /> No active credential — {p.integration_status === "active" ? "rotate" : p.integration_status === "disabled" ? "recover" : "reissue"} to issue credentials
                    </div>
                  )}
                  {p.integration_kit_type && p.integration_kit_type !== "universal_api" && (
                    <p className="mt-1 text-xs text-muted-foreground">Kit: {KIT_TYPES.find((k) => k.value === p.integration_kit_type)?.label || p.integration_kit_type}</p>
                  )}
                  {p.integration_status === "setup_required" && (() => {
                    const cl = p.setup_checklist || {};
                    const steps = ["domain_verified", "admin_reviewed", "linux_api_configured", "partner_implemented", "proof_of_possession", "test_event_verified", "activated"];
                    const done = steps.filter((s) => cl[s]).length;
                    return (
                      <div className="mt-2">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                          <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">Onboarding {done}/{steps.length}</p>
                      </div>
                    );
                  })()}
                  <div className="mt-4 flex flex-wrap gap-1">
                    <Button variant="outline" size="sm" onClick={() => setDetailPartner(p)}><Eye className="mr-1 h-3.5 w-3.5" /> Details</Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(p)}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
                    {!p.linux_api_partner_id && <Button variant="outline" size="sm" className="text-indigo-600" onClick={() => openUuidDialog(p)} title="Set Linux Partner UUID"><Link2 className="mr-1 h-3.5 w-3.5" /> Set UUID</Button>}
                    {p.linux_api_partner_id && <Button variant="outline" size="sm" className="text-indigo-600" onClick={() => setHandoffPartner(p)} title="Secure credential handoff"><ShieldCheck className="mr-1 h-3.5 w-3.5" /> Handoff</Button>}
                    {p.integration_status === "linux_integration_pending" && <Button variant="outline" size="sm" className="text-orange-600" onClick={() => retryProvisioning(p)} title="Retry Linux provisioning"><RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry Provisioning</Button>}
                    {p.integration_status !== "linux_integration_pending" && <Button variant="outline" size="sm" onClick={() => setSetupGuidePartner(p)}><Settings2 className="mr-1 h-3.5 w-3.5" /> Setup</Button>}
                    {p.linux_api_partner_id && <Button variant="outline" size="sm" disabled={verifying === p.id} onClick={() => verifyDomain(p)} title="Verify DNS domain ownership via Linux">{verifying === p.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Globe className="mr-1 h-3.5 w-3.5" />} Verify Domain</Button>}
                    {p.linux_api_partner_id && !p.proof_of_possession_verified && <Button variant="outline" size="sm" disabled={syncingProof === p.id} onClick={() => syncProofStatus(p)} title="Sync proof-of-possession status from Linux">{syncingProof === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />} Sync Proof</Button>}
                    {p.integration_status === "setup_required" && !(p.setup_checklist?.admin_reviewed) && <Button variant="outline" size="sm" className="text-emerald-600" onClick={() => reviewPartner(p, true)} title="Approve partner application"><FileCheck className="mr-1 h-3.5 w-3.5" /> Approve</Button>}
                    {p.integration_status === "setup_required" && (() => {
                      const cl = p.setup_checklist || {};
                      const allOnboarding = ["domain_verified", "admin_reviewed", "linux_api_configured", "partner_implemented", "proof_of_possession", "test_event_verified"].every((s) => cl[s]);
                      return (
                        <>
                          <Button size="sm" className="bg-purple-600 hover:bg-purple-700" disabled={!allOnboarding || approving === p.id} onClick={() => approveActivation(p, "approve")} title={allOnboarding ? "Submit activation approval to Linux" : "Complete all onboarding steps first"}>
                            {approving === p.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Rocket className="mr-1 h-3.5 w-3.5" />}
                            Approve & Activate
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600" disabled={approving === p.id} onClick={() => approveActivation(p, "reject")} title="Reject activation and suspend"><XCircle className="h-3.5 w-3.5" /></Button>
                        </>
                      );
                    })()}
                    {p.integration_status === "active" && <Button variant="outline" size="sm" onClick={() => setStatus(p, "suspended")}>Suspend</Button>}
                    {p.integration_status === "suspended" && <Button size="sm" onClick={() => setStatus(p, "active")}>Resume</Button>}
                    {p.integration_status === "active" && p.linux_api_partner_id && (
                      <Button variant="ghost" size="sm" onClick={() => rotateCredential(p)} title="Rotate active credential"><KeyRound className="h-3.5 w-3.5" /></Button>
                    )}
                    {p.integration_status === "setup_required" && p.linux_api_partner_id && (
                      <Button variant="ghost" size="sm" disabled={reissuing === p.id} onClick={() => reissueInitialCredential(p)} title="Reissue onboarding credential">{reissuing === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}</Button>
                    )}
                    {(p.integration_status === "disabled" || p.integration_status === "suspended") && p.linux_api_partner_id && (
                      <Button variant="ghost" size="sm" className="text-amber-600" onClick={() => recoverPartner(p)} title="Recover partner with new credentials"><LifeBuoy className="h-3.5 w-3.5" /></Button>
                    )}
                    <ConfirmDialog trigger={<Button variant="ghost" size="sm" className="text-red-600" title="Revoke credentials"><Ban className="h-3.5 w-3.5" /></Button>} title="Revoke all credentials?" description="This disables the partner and revokes all API keys. The partner will need new credentials to reconnect." confirmLabel="Revoke" destructive onConfirm={() => revokeCredential(p)} />
                    <ConfirmDialog trigger={<Button variant="ghost" size="sm" className="text-red-600" title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>} title={`Delete "${p.name}"?`} description="This permanently removes the partner integration." confirmLabel="Delete" destructive onConfirm={() => remove(p)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="kits" className="mt-6">
          <PartnerIntegrationKits />
        </TabsContent>

        <TabsContent value="events" className="mt-6">
          {events.length === 0 ? (
            <EmptyState title="No partner events" description="Events from partner integrations will appear here." />
          ) : (
            <div className="space-y-3">
              {events.map((e) => (
                <div key={e.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">{e.event_type?.replace(/_/g, " ")}</span>
                      <span className="text-xs text-muted-foreground">{e.partner_name}</span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">ID: {e.external_event_id?.slice(0, 24)}…</p>
                    {e.user_reference && <p className="mt-0.5 text-xs text-muted-foreground">User: {e.user_reference.slice(0, 12)}…</p>}
                    {e.eligible_seconds > 0 && <p className="mt-0.5 text-xs text-muted-foreground">Eligible: {Math.round(e.eligible_seconds)}s</p>}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${e.processing_status === "processed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" : e.processing_status === "rejected" ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400" : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"}`}>{e.processing_status}</span>
                    <p className="mt-1 text-xs text-muted-foreground">{e.received_at ? new Date(e.received_at).toLocaleString("en-GB") : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit Partner" : "Add Partner Integration"}</DialogTitle></DialogHeader>
          {!editing?.id && (
            <div className="flex items-start gap-3 rounded-lg border border-blue-300 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-950/30">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Credentials are provisioned by the Linux API</p>
                <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">On creation, Base44 requests HMAC credentials from the Linux API. If the Linux API is unavailable, the partner enters a "Linux Integration Pending" state and you can retry provisioning later. No reward-bearing activity is permitted until an administrator activates the integration.</p>
              </div>
            </div>
          )}
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5" placeholder="XeroStreams" /></div>
            <div>
              <Label>Partner Type</Label>
              <Select value={form.partner_type} onValueChange={(v) => setForm({ ...form, partner_type: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{PARTNER_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Integration Kit</Label>
              <Select value={form.integration_kit_type} onValueChange={(v) => setForm({ ...form, integration_kit_type: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{KIT_TYPES.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">Universal API is available now. WordPress and Streaming kits require external packages (Coming Soon).</p>
            </div>
            <div><Label>Website URL</Label><Input value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} className="mt-1.5" placeholder="https://example.com" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1.5" /></div>
            <div><Label>Logo URL (optional)</Label><Input value={form.logo} onChange={(e) => setForm({ ...form, logo: e.target.value })} className="mt-1.5" placeholder="https://..." /></div>
            <div><Label>Verified Domains (one per line)</Label><Textarea value={form.verified_domains} onChange={(e) => setForm({ ...form, verified_domains: e.target.value })} className="mt-1.5" placeholder="example.com" /></div>
            <div>
              <Label>Supported Event Types</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {ALL_EVENT_TYPES.map((et) => {
                  const selected = (form.supported_event_types || []).includes(et);
                  return (
                    <button key={et} type="button" onClick={() => toggleEventType(et)} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${selected ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80"}`}>{et.replace(/_/g, " ")}</button>
                  );
                })}
              </div>
            </div>
            <div><Label>Setup Instructions (shown to administrators)</Label><Textarea value={form.setup_instructions} onChange={(e) => setForm({ ...form, setup_instructions: e.target.value })} className="mt-1.5" placeholder="Authentication steps, payload format, retry policy..." /></div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credential Result Dialog */}
      {credentialResult && (
        <Dialog open={!!credentialResult} onOpenChange={(o) => !o && setCredentialResult(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{credentialResult.isNew ? "Partner Created" : "Credentials Rotated"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Save these credentials now</p>
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">The partner secret is shown only once. Store it securely — it cannot be retrieved again.</p>
                </div>
              </div>
              <div><Label>Partner Key ID</Label><Input readOnly value={credentialResult.partner_key_id} className="mt-1.5 font-mono" /></div>
              <div><Label>Partner Secret</Label><Input readOnly value={credentialResult.partner_secret} className="mt-1.5 font-mono" /></div>
              {credentialResult.domain_verification_token && (
                <div className="rounded-lg border border-blue-300 bg-blue-50 p-3 dark:border-blue-700 dark:bg-blue-950/30">
                  <p className="text-xs font-medium text-blue-800 dark:text-blue-300">Domain Verification Token</p>
                  <p className="mt-1 break-all font-mono text-xs text-blue-700 dark:text-blue-400">{credentialResult.domain_verification_token}</p>
                  <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">The partner must publish this in a DNS TXT record or at /.well-known/perksphere-verify.txt before domain verification can proceed.</p>
                </div>
              )}
              <div className="rounded-lg bg-secondary p-3 text-xs text-muted-foreground">
                <p className="font-medium">Production event endpoint (Linux API):</p>
                <p className="mt-1 font-mono">POST https://api.perksphere.org/events</p>
                <p className="mt-2">Headers: X-PS-Partner-Key, X-PS-Timestamp, X-PS-Nonce, X-PS-Signature</p>
                <p className="mt-2 text-amber-700 dark:text-amber-400">These credentials were provisioned by the Linux API. Deliver them to the partner out-of-band. The Base44 migration endpoint must not be used for production events.</p>
              </div>
            </div>
            <DialogFooter><Button onClick={() => setCredentialResult(null)}>Done</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Setup Guide Dialog */}
      <Dialog open={!!setupGuidePartner} onOpenChange={(o) => !o && setSetupGuidePartner(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Setup Guide — {setupGuidePartner?.name}</DialogTitle></DialogHeader>
          {setupGuidePartner && (
            <PartnerSetupGuide partner={setupGuidePartner} onUpdateChecklist={updateSetup} onRefresh={() => load(true)} />
          )}
          <DialogFooter><DialogClose asChild><Button variant="outline">Close</Button></DialogClose></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Partner Detail / Dashboard Dialog */}
      <Dialog open={!!detailPartner} onOpenChange={(o) => !o && setDetailPartner(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>Partner Dashboard — {detailPartner?.name}</DialogTitle></DialogHeader>
          {detailPartner && (
            <PartnerDetail partner={detailPartner} events={events} onRefresh={() => load(true)} />
          )}
          <DialogFooter><DialogClose asChild><Button variant="outline">Close</Button></DialogClose></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Linux UUID Dialog */}
      <Dialog open={!!uuidPartner} onOpenChange={(o) => !o && setUuidPartner(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Link2 className="h-5 w-5" /> Set Linux Partner UUID — {uuidPartner?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-blue-300 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-950/30">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Manual Linux reconciliation</p>
                <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">Enter the Linux partner UUID recovered from the production Linux database. Verify the domain and partner reference match before saving. Once saved, you can rotate credentials and use the credential handoff.</p>
              </div>
            </div>
            <div className="rounded-lg bg-secondary p-3 text-xs text-muted-foreground">
              <p>Base44 Partner Reference: <span className="font-mono">{uuidPartner?.id}</span></p>
              <p className="mt-1">Domain: <span className="font-mono">{uuidPartner?.website_url}</span></p>
            </div>
            <div>
              <Label>Linux Partner UUID</Label>
              <Input value={uuidForm.linux_api_partner_id} onChange={(e) => setUuidForm({ ...uuidForm, linux_api_partner_id: e.target.value })} className="mt-1.5 font-mono text-xs" placeholder="e.g. 630feee8-2649-4c4f-b2a0-c26746a696fd" />
              <p className="mt-1 text-xs text-muted-foreground">Must be a valid UUID (8-4-4-4-12 hex format).</p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={saveLinuxUuid} disabled={savingUuid}>{savingUuid ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Save UUID</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credential Handoff Dialog */}
      {handoffPartner && (
        <PartnerCredentialHandoff partner={handoffPartner} onClose={() => setHandoffPartner(null)} onRefresh={() => load(true)} />
      )}
    </div>
  );
}
