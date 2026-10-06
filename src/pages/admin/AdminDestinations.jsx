import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Pencil, Power, Activity, Globe, Youtube, Twitter, HelpCircle, Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import PageHeader from "@/components/perk/PageHeader";
import EmptyState from "@/components/perk/EmptyState";
import EligibilityBadge from "@/components/perk/EligibilityBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose
} from "@/components/ui/dialog";

const ELIG_OPTS = [
  { value: "allowed", label: "Allowed" },
  { value: "neutral", label: "Neutral" },
  { value: "disallowed", label: "Disallowed" }
];
const PLATFORM_FILTERS = [
  { value: "all", label: "All Platforms", Icon: Globe },
  { value: "website", label: "Website", Icon: Globe },
  { value: "youtube", label: "YouTube", Icon: Youtube },
  { value: "x", label: "X", Icon: Twitter },
  { value: "other", label: "Other", Icon: HelpCircle }
];
const ACCOUNT_TYPES = [
  { value: "channel", label: "Channel (YouTube)" },
  { value: "account", label: "Account (X / other)" },
  { value: "video", label: "Video (YouTube)" },
  { value: "post", label: "Post (X / other)" },
  { value: "other", label: "Other" }
];
const NEW_KINDS = [
  { value: "website", label: "Website" },
  { value: "account", label: "Social Account / Content" }
];

function normPlatform(raw, kind) {
  if (kind === "website") return "Website";
  const p = (raw || "").toLowerCase();
  if (p.includes("youtube")) return "YouTube";
  if (p === "x" || p === "twitter") return "X";
  return raw || "Other";
}
function platformKey(d) {
  const p = d.platform.toLowerCase();
  if (p === "youtube") return "youtube";
  if (p === "x") return "x";
  if (p === "website") return "website";
  return "other";
}
function toRow(w, kind) {
  if (kind === "website") {
    return { id: w.id, kind, raw: w, name: w.site_name || w.domain || "Website", platform: normPlatform(w.platform, "website"), domainOrHandle: w.domain || "—", url: w.domain ? (w.domain.startsWith("http") ? w.domain : `https://${w.domain}`) : null, eligibility: w.eligibility || "neutral", active: w.status !== "inactive", publicly_visible: w.publicly_visible !== false, tracking_enabled: w.tracking_enabled !== false, points_eligible: w.points_eligible !== false, xp_eligible: w.xp_eligible !== false, updated: w.updated_date || w.created_date };
  }
  return { id: w.id, kind, raw: w, name: w.account_name || w.username || "Account", platform: normPlatform(w.platform, "account"), type: w.destination_type || (normPlatform(w.platform, "account") === "YouTube" ? "channel" : "account"), domainOrHandle: w.username ? `@${w.username}` : "—", url: w.profile_url || null, eligibility: w.eligibility || "neutral", active: w.active !== false, publicly_visible: w.publicly_visible !== false, tracking_enabled: w.tracking_enabled !== false, points_eligible: w.points_eligible !== false, xp_eligible: w.xp_eligible !== false, updated: w.updated_date || w.created_date };
}

export default function AdminDestinations() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [eligFilter, setEligFilter] = useState("all");
  const [platFilter, setPlatFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({ kind: "website", platform: "Website", destination_type: "channel", site_name: "", domain: "", account_name: "", username: "", profile_url: "", external_platform_id: "", eligibility: "neutral", description: "" });
  const [newSaving, setNewSaving] = useState(false);

  const load = async (silent) => {
    if (!silent) setLoading(true);
    try {
      const [sites, accounts] = await Promise.all([
        base44.entities.Website.list('-updated_date', 500),
        base44.entities.TrackedAccount.list('-updated_date', 500)
      ]);
      setRows([...(sites || []).map((s) => toRow(s, "website")), ...(accounts || []).map((a) => toRow(a, "account"))]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    if (eligFilter !== "all" && r.eligibility !== eligFilter) return false;
    if (platFilter !== "all" && platformKey(r) !== platFilter) return false;
    if (q) { const term = q.toLowerCase(); const hay = `${r.name} ${r.domainOrHandle} ${r.platform}`.toLowerCase(); if (!hay.includes(term)) return false; }
    return true;
  }), [rows, q, eligFilter, platFilter]);

  const writeDest = async (entity, op, id, data, silent) => {
    await base44.functions.invoke("adminWrite", { entity, op, id, data });
    if (!silent) toast({ title: "Destination updated" });
  };

  const quickEligibility = async (row, eligibility) => {
    const prev = row.eligibility;
    setRows((p) => p.map((r) => r.id === row.id && r.kind === row.kind ? { ...r, eligibility } : r));
    try {
      await writeDest(row.kind === "website" ? "Website" : "TrackedAccount", "update", row.id, { eligibility }, true);
      toast({ title: `Marked as ${eligibility}` });
    } catch (e) {
      setRows((p) => p.map((r) => r.id === row.id && r.kind === row.kind ? { ...r, eligibility: prev } : r));
      toast({ title: "Update failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    }
  };

  const toggleActive = async (row) => {
    const newVal = !row.active;
    setRows((p) => p.map((r) => r.id === row.id && r.kind === row.kind ? { ...r, active: newVal } : r));
    try {
      const data = row.kind === "website" ? { status: newVal ? "active" : "inactive" } : { active: newVal };
      await writeDest(row.kind === "website" ? "Website" : "TrackedAccount", "update", row.id, data, true);
      toast({ title: newVal ? "Enabled" : "Disabled" });
    } catch (e) {
      setRows((p) => p.map((r) => r.id === row.id && r.kind === row.kind ? { ...r, active: !newVal } : r));
      toast({ title: "Update failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    }
  };

  const openEdit = (row) => { setEditing(row); setForm({ ...row.raw }); };

  const save = async () => {
    setSaving(true);
    try {
      const entity = editing.kind === "website" ? "Website" : "TrackedAccount";
      const payload = { eligibility: form.eligibility || "neutral", publicly_visible: !!form.publicly_visible, tracking_enabled: !!form.tracking_enabled, points_eligible: !!form.points_eligible, xp_eligible: !!form.xp_eligible, description: form.description || "" };
      if (editing.kind === "website") {
        payload.site_name = form.site_name; payload.domain = form.domain; payload.platform = form.platform || "Website"; payload.status = form.status || "active";
      } else {
        payload.account_name = form.account_name; payload.platform = form.platform; payload.username = form.username; payload.profile_url = form.profile_url; payload.destination_type = form.destination_type || (normPlatform(form.platform, "account") === "YouTube" ? "channel" : "account"); payload.external_platform_id = form.external_platform_id || ""; payload.active = form.active !== false;
      }
      await writeDest(entity, "update", editing.id, payload);
      setEditing(null);
      load(true);
    } catch (e) {
      toast({ title: "Save failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const createNew = async () => {
    setNewSaving(true);
    try {
      if (newForm.kind === "website") {
        if (!newForm.site_name || !newForm.domain) { toast({ title: "Site name and domain are required", variant: "destructive" }); setNewSaving(false); return; }
        await base44.functions.invoke("adminWrite", { entity: "Website", op: "create", data: { site_name: newForm.site_name, domain: newForm.domain, platform: "Website", eligibility: newForm.eligibility, description: newForm.description || "", status: "active", publicly_visible: true, tracking_enabled: true, points_eligible: true, xp_eligible: true } });
      } else {
        if (!newForm.account_name || !newForm.platform) { toast({ title: "Platform and account name are required", variant: "destructive" }); setNewSaving(false); return; }
        await base44.functions.invoke("adminWrite", { entity: "TrackedAccount", op: "create", data: { platform: newForm.platform, destination_type: newForm.destination_type, account_name: newForm.account_name, username: newForm.username || "", profile_url: newForm.profile_url || "", external_platform_id: newForm.external_platform_id || "", description: newForm.description || "", eligibility: newForm.eligibility, active: true, publicly_visible: true, tracking_enabled: true, points_eligible: true, xp_eligible: true } });
      }
      toast({ title: "Destination created" });
      setNewOpen(false);
      setNewForm({ kind: "website", platform: "Website", destination_type: "channel", site_name: "", domain: "", account_name: "", username: "", profile_url: "", external_platform_id: "", eligibility: "neutral", description: "" });
      load(true);
    } catch (e) {
      toast({ title: "Create failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setNewSaving(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  return (
    <div>
      <PageHeader title="Destinations" description="Manage all allowed, neutral and disallowed destinations across websites and social platforms." actions={<Button size="sm" onClick={() => setNewOpen(true)}><Plus className="mr-1 h-4 w-4" /> New Destination</Button>} />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {["all", "allowed", "neutral", "disallowed"].map((v) => (
            <button key={v} onClick={() => setEligFilter(v)} className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${eligFilter === v ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"}`}>{v === "all" ? "All" : v}</button>
          ))}
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search destinations..." className="pl-9" />
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {PLATFORM_FILTERS.map((f) => {
          const Icon = f.Icon; const active = platFilter === f.value;
          return <button key={f.value} onClick={() => setPlatFilter(f.value)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${active ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"}`}><Icon className="h-3.5 w-3.5" /> {f.label}</button>;
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No destinations found" description="Create a new destination or adjust your filters." />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card shadow-sm sm:block">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Platform</th>
                  <th className="px-4 py-3 font-medium">Domain / Handle</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Tracking</th>
                  <th className="px-4 py-3 font-medium">Pts / XP</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => (
                  <tr key={`${r.kind}-${r.id}`} className="hover:bg-secondary/30">
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.name}</p>
                      {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">{r.url}</a>}
                    </td>
                    <td className="px-4 py-3"><span className="capitalize">{r.platform}</span>{r.kind === "account" && r.type && <span className="block text-xs text-muted-foreground capitalize">{r.type}</span>}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.domainOrHandle}</td>
                    <td className="px-4 py-3">
                      <Select value={r.eligibility} onValueChange={(v) => quickEligibility(r, v)}>
                        <SelectTrigger className="h-8 w-32 border-0 bg-transparent px-1 shadow-none focus:ring-0"><EligibilityBadge eligibility={r.eligibility} /></SelectTrigger>
                        <SelectContent>{ELIG_OPTS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3"><span className={`text-xs ${r.tracking_enabled ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>{r.tracking_enabled ? "On" : "Off"}</span>{!r.active && <span className="ml-2 text-xs text-red-600 dark:text-red-400">inactive</span>}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.points_eligible ? "Pts ✓" : "Pts ✕"} {r.xp_eligible ? "XP ✓" : "XP ✕"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.updated ? new Date(r.updated).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" title={r.active ? "Disable" : "Enable"} onClick={() => toggleActive(r)}><Power className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" title="View activity" onClick={() => navigate("/admin/activities")}><Activity className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 sm:hidden">
            {filtered.map((r) => (
              <div key={`${r.kind}-${r.id}`} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.name}</p>
                    <p className="text-xs capitalize text-muted-foreground">{r.platform}{r.kind === "account" && r.type ? ` · ${r.type}` : ""}</p>
                    <p className="text-xs text-muted-foreground">{r.domainOrHandle}</p>
                  </div>
                  <Select value={r.eligibility} onValueChange={(v) => quickEligibility(r, v)}>
                    <SelectTrigger className="h-8 w-28 border-0 bg-transparent px-1 shadow-none focus:ring-0"><EligibilityBadge eligibility={r.eligibility} /></SelectTrigger>
                    <SelectContent>{ELIG_OPTS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className={r.tracking_enabled ? "text-emerald-600 dark:text-emerald-400" : ""}>Tracking: {r.tracking_enabled ? "On" : "Off"}</span>
                  {!r.active && <span className="text-red-600 dark:text-red-400">inactive</span>}
                  <span>· {r.points_eligible ? "Pts ✓" : "Pts ✕"} {r.xp_eligible ? "XP ✓" : "XP ✕"}</span>
                  {r.updated && <span>· {new Date(r.updated).toLocaleDateString()}</span>}
                </div>
                <div className="mt-3 flex justify-end gap-1">
                  <Button variant="outline" size="sm" onClick={() => openEdit(r)}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
                  <Button variant="outline" size="sm" onClick={() => toggleActive(r)}><Power className="mr-1 h-3.5 w-3.5" /> {r.active ? "Disable" : "Enable"}</Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Destination</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              {editing.kind === "website" ? (
                <>
                  <div><Label>Site Name</Label><Input value={form.site_name || ""} onChange={(e) => setForm({ ...form, site_name: e.target.value })} className="mt-1.5" /></div>
                  <div><Label>Domain</Label><Input value={form.domain || ""} onChange={(e) => setForm({ ...form, domain: e.target.value })} className="mt-1.5" /></div>
                  <div><Label>Status</Label><Select value={form.status || "active"} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="pending">Pending</SelectItem></SelectContent></Select></div>
                </>
              ) : (
                <>
                  <div><Label>Account Name</Label><Input value={form.account_name || ""} onChange={(e) => setForm({ ...form, account_name: e.target.value })} className="mt-1.5" /></div>
                  <div><Label>Platform</Label><Input value={form.platform || ""} onChange={(e) => setForm({ ...form, platform: e.target.value })} className="mt-1.5" placeholder="YouTube, X, ..." /></div>
                  <div><Label>Destination Type</Label><Select value={form.destination_type || (normPlatform(form.platform, "account") === "YouTube" ? "channel" : "account")} onValueChange={(v) => setForm({ ...form, destination_type: v })}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent>{ACCOUNT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label>Username / Handle</Label><Input value={form.username || ""} onChange={(e) => setForm({ ...form, username: e.target.value })} className="mt-1.5" /></div>
                  <div><Label>Profile URL</Label><Input value={form.profile_url || ""} onChange={(e) => setForm({ ...form, profile_url: e.target.value })} className="mt-1.5" /></div>
                  <div><Label>External Platform ID</Label><Input value={form.external_platform_id || ""} onChange={(e) => setForm({ ...form, external_platform_id: e.target.value })} className="mt-1.5" /></div>
                </>
              )}
              <div><Label>Eligibility</Label><Select value={form.eligibility || "neutral"} onValueChange={(v) => setForm({ ...form, eligibility: v })}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent>{ELIG_OPTS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Description</Label><Textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1.5" /></div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3"><Label>Publicly visible</Label><Switch checked={!!form.publicly_visible} onCheckedChange={(c) => setForm({ ...form, publicly_visible: c })} /></div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3"><Label>Tracking enabled</Label><Switch checked={!!form.tracking_enabled} onCheckedChange={(c) => setForm({ ...form, tracking_enabled: c })} /></div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3"><Label>Points eligible</Label><Switch checked={!!form.points_eligible} onCheckedChange={(c) => setForm({ ...form, points_eligible: c })} /></div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3"><Label>XP eligible</Label><Switch checked={!!form.xp_eligible} onCheckedChange={(c) => setForm({ ...form, xp_eligible: c })} /></div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New destination dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Destination</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Kind</Label><Select value={newForm.kind} onValueChange={(v) => setNewForm({ ...newForm, kind: v, platform: v === "website" ? "Website" : "YouTube" })}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent>{NEW_KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent></Select></div>
            {newForm.kind === "website" ? (
              <>
                <div><Label>Site Name</Label><Input value={newForm.site_name} onChange={(e) => setNewForm({ ...newForm, site_name: e.target.value })} className="mt-1.5" /></div>
                <div><Label>Domain</Label><Input value={newForm.domain} onChange={(e) => setNewForm({ ...newForm, domain: e.target.value })} className="mt-1.5" placeholder="example.com" /></div>
              </>
            ) : (
              <>
                <div><Label>Platform</Label><Select value={newForm.platform} onValueChange={(v) => setNewForm({ ...newForm, platform: v, destination_type: v === "YouTube" ? "channel" : "account" })}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="YouTube">YouTube</SelectItem><SelectItem value="X">X</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select></div>
                <div><Label>Destination Type</Label><Select value={newForm.destination_type} onValueChange={(v) => setNewForm({ ...newForm, destination_type: v })}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent>{ACCOUNT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Account / Content Name</Label><Input value={newForm.account_name} onChange={(e) => setNewForm({ ...newForm, account_name: e.target.value })} className="mt-1.5" /></div>
                <div><Label>Username / Handle</Label><Input value={newForm.username} onChange={(e) => setNewForm({ ...newForm, username: e.target.value })} className="mt-1.5" /></div>
                <div><Label>Profile / Content URL</Label><Input value={newForm.profile_url} onChange={(e) => setNewForm({ ...newForm, profile_url: e.target.value })} className="mt-1.5" /></div>
                <div><Label>External Platform ID</Label><Input value={newForm.external_platform_id} onChange={(e) => setNewForm({ ...newForm, external_platform_id: e.target.value })} className="mt-1.5" placeholder="video id, channel id, post id..." /></div>
              </>
            )}
            <div><Label>Eligibility</Label><Select value={newForm.eligibility} onValueChange={(v) => setNewForm({ ...newForm, eligibility: v })}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent>{ELIG_OPTS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Description</Label><Textarea value={newForm.description} onChange={(e) => setNewForm({ ...newForm, description: e.target.value })} className="mt-1.5" /></div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={createNew} disabled={newSaving}>{newSaving ? "Creating..." : "Create Destination"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}