import React, { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Globe, Loader2, AlertTriangle, CheckCircle2, KeyRound, ArrowRight, ArrowLeft, Copy, Check, ExternalLink } from "lucide-react";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue
} from "@/components/ui/select";
import DnsSetupCard from "@/components/perk/DnsSetupCard";

const PARTNER_TYPES = [
  { value: "custom_website", label: "Custom Website" },
  { value: "streaming_platform", label: "Streaming Platform" },
  { value: "membership_subscription", label: "Membership / Subscription Platform" },
  { value: "wordpress_woocommerce", label: "WordPress / WooCommerce" },
  { value: "other", label: "Other" }
];

const KIT_TYPES = [
  { value: "universal_api", label: "Universal API Kit" },
  { value: "wordpress_woocommerce", label: "WordPress / WooCommerce" },
  { value: "streaming_sdk", label: "Streaming SDK" },
  { value: "custom", label: "Custom" }
];

const ALL_EVENT_TYPES = [
  "ACCOUNT_REGISTERED", "ACCOUNT_LINKED", "ACCOUNT_DISABLED",
  "VIDEO_WATCH_PROGRESS", "STREAM_STARTED", "STREAM_VIEW_PROGRESS", "STREAM_ENDED",
  "PURCHASE_COMPLETED", "PURCHASE_REFUNDED", "CHARGEBACK_ISSUED",
  "SUBSCRIPTION_ACTIVATED", "SUBSCRIPTION_RENEWED", "SUBSCRIPTION_CANCELLED"
];

const empty = {
  name: "", website_url: "", partner_type: "custom_website", contact_email: "",
  description: "", integration_kit_type: "universal_api", supported_event_types: []
};

export default function PartnerRegister() {
  const { toast } = useToast();
  const [form, setForm] = useState(empty);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [dnsError, setDnsError] = useState(null);

  const toggleEventType = (et) => {
    const current = form.supported_event_types || [];
    setForm({ ...form, supported_event_types: current.includes(et) ? current.filter((x) => x !== et) : [...current, et] });
  };

  const submit = async () => {
    if (!form.name || form.name.trim().length < 2) { toast({ title: "Name is required", variant: "destructive" }); return; }
    if (!form.website_url) { toast({ title: "Website URL is required", variant: "destructive" }); return; }
    if (!form.contact_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email)) { toast({ title: "Valid contact email is required", variant: "destructive" }); return; }
    if (!form.supported_event_types || form.supported_event_types.length === 0) { toast({ title: "Select at least one event type", variant: "destructive" }); return; }

    setSubmitting(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("partnerRegister", form);
      const body = res?.data || res;
      if (body?.ok) {
        setResult(body);
        if (!body.partner_secret) {
          toast({ title: "Registration pending", description: "Linux provisioning is pending. You will be contacted." });
        } else {
          toast({ title: "Partner registered", description: "Save your credentials now — the secret is shown only once." });
        }
      } else {
        setError(body?.error || "Registration failed");
        toast({ title: "Registration failed", description: body?.error, variant: "destructive" });
      }
    } catch (e) {
      const errData = e?.response?.data || {};
      setError(errData.error || e.message);
      toast({ title: "Registration failed", description: errData.error || e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const verifyDomain = async () => {
    if (!result?.partner_id) return;
    setVerifying(true);
    setDnsError(null);
    try {
      const res = await base44.functions.invoke("managePartner", { action: "verifyDomain", partnerId: result.partner_id });
      const body = res?.data || res;
      if (body?.ok) {
        toast({ title: "Domain verified", description: `Linux confirmed DNS ownership (HTTP ${body.linux_status || 200}).` });
        setResult({ ...result, dns_verified: true, record: body.record });
      } else {
        setDnsError(body?.message || body?.error || "Verification failed");
        toast({ title: "Domain verification failed", description: body?.message || body?.error, variant: "destructive" });
      }
    } catch (e) {
      const errData = e?.response?.data || {};
      setDnsError(errData.message || errData.error || e.message);
      toast({ title: "Domain verification failed", description: errData.message || errData.error || e.message, variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  };

  const copyField = (key, value) => {
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setDnsError(null);
    setForm(empty);
  };

  // ── Success view ──────────────────────────────────────────────────────
  if (result) {
    const dns = result.dns_setup;
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <div className="mb-6 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-6 w-6" />
          <h1 className="text-xl font-bold">Partner Registered</h1>
        </div>

        {result.linux_integration_pending ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-700 dark:bg-amber-950/30">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <p className="mt-2 text-sm font-medium text-amber-800 dark:text-amber-300">Linux provisioning is pending</p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{result.message}</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Credentials (one-time) */}
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-700 dark:bg-amber-950/30">
              <div className="flex items-start gap-3">
                <KeyRound className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Save your credentials now</p>
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">The partner secret is shown only once. Store it securely — it cannot be retrieved again without administrator assistance.</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <div>
                  <Label className="text-xs">Partner Key ID</Label>
                  <div className="mt-1 flex gap-2">
                    <Input readOnly value={result.partner_key_id || ""} className="font-mono text-xs" />
                    <Button variant="outline" size="icon" onClick={() => copyField("key", result.partner_key_id)}>
                      {copied === "key" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Partner Secret</Label>
                  <div className="mt-1 flex gap-2">
                    <Input readOnly value={result.partner_secret || ""} className="font-mono text-xs" />
                    <Button variant="outline" size="icon" onClick={() => copyField("secret", result.partner_secret)}>
                      {copied === "secret" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Linux Partner UUID</Label>
                  <div className="mt-1 flex gap-2">
                    <Input readOnly value={result.linux_api_partner_id || ""} className="font-mono text-xs" />
                    <Button variant="outline" size="icon" onClick={() => copyField("uuid", result.linux_api_partner_id)}>
                      {copied === "uuid" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* DNS Setup Card */}
            {dns && (
              <DnsSetupCard
                domain={dns.domain}
                token={dns.txt_value}
                verified={!!result.dns_verified}
                verifying={verifying}
                error={dnsError}
                onVerify={verifyDomain}
              />
            )}

            {/* Next steps */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold">Next steps</h3>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                <li>Configure the credentials above in your backend as <code className="font-mono text-xs">PERKSPHERE_PARTNER_KEY_ID</code> and <code className="font-mono text-xs">PERKSPHERE_PARTNER_HMAC_SECRET</code>.</li>
                <li>Publish the DNS TXT record shown above and click Verify Domain.</li>
                <li>Complete proof-of-possession: an administrator will generate a challenge for you to sign with your HMAC secret.</li>
                <li>Submit for administrator review and activation approval.</li>
                <li>Read the <a href="/partners/guide" className="text-indigo-600 hover:underline dark:text-indigo-400">Partner Integration Guide</a> for full implementation details.</li>
              </ol>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={reset}><ArrowLeft className="mr-2 h-4 w-4" /> Register another</Button>
              <a href="/partners/guide"><Button variant="outline"><ExternalLink className="mr-2 h-4 w-4" /> Integration Guide</Button></a>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Registration form ─────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-xl font-bold"><Globe className="h-6 w-6 text-indigo-600 dark:text-indigo-400" /> Partner Registration</h1>
        <p className="mt-1 text-sm text-muted-foreground">Register your website or platform as a Perk Sphere partner integration. You will receive DNS verification instructions and HMAC credentials.</p>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-700 dark:bg-red-950/30">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
          <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div>
          <Label>Business or Website Name *</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5" placeholder="XeroStreams" maxLength={100} />
        </div>

        <div>
          <Label>Website URL *</Label>
          <Input value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} className="mt-1.5" placeholder="https://example.com" />
          <p className="mt-1 text-xs text-muted-foreground">The canonical domain is extracted from this URL for DNS verification.</p>
        </div>

        <div>
          <Label>Partner Type *</Label>
          <Select value={form.partner_type} onValueChange={(v) => setForm({ ...form, partner_type: v })}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>{PARTNER_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div>
          <Label>Contact Email *</Label>
          <Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} className="mt-1.5" placeholder="admin@example.com" />
          <p className="mt-1 text-xs text-muted-foreground">Used for onboarding communication. This is not shared publicly.</p>
        </div>

        <div>
          <Label>Integration Kit</Label>
          <Select value={form.integration_kit_type} onValueChange={(v) => setForm({ ...form, integration_kit_type: v })}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>{KIT_TYPES.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">Universal API is available now. WordPress and Streaming kits require external packages.</p>
        </div>

        <div>
          <Label>Description (optional)</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1.5" placeholder="Brief description of your platform..." />
        </div>

        <div>
          <Label>Requested Event Types *</Label>
          <p className="mt-1 text-xs text-muted-foreground">Select the events your platform will send. Subject to administrator approval.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {ALL_EVENT_TYPES.map((et) => {
              const selected = (form.supported_event_types || []).includes(et);
              return (
                <button key={et} type="button" onClick={() => toggleEventType(et)} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${selected ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80"}`}>
                  {et.replace(/_/g, " ").toLowerCase()}
                </button>
              );
            })}
          </div>
        </div>

        <Button onClick={submit} disabled={submitting} className="w-full">
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
          Register Partner
        </Button>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        New partners start inactive. No rewards are issued during onboarding. Read the{" "}
        <a href="/partners/guide" className="text-indigo-600 hover:underline dark:text-indigo-400">Integration Guide</a>.
      </p>
    </div>
  );
}