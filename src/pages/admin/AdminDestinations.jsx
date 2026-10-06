import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Pencil, Power, Activity, Globe, Youtube, Twitter, HelpCircle } from "lucide-react";
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
    return {
      id: w.id, kind, raw: w,
      name: w.site_name || w.domain || "Website",
      platform: normPlatform(w.platform, "website"),
      domainOrHandle: w.domain || "—",
      url: w.domain ? (w.domain.startsWith("http") ? w.domain : `https://${w.domain}`) : null,
      eligibility: w.eligibility || "neutral",
      active: w.status !== "inactive",
      publicly_visible: w.publicly_visible !== false,
      tracking_enabled: w.tracking_enabled !== false,
      points_eligible: w.points_eligible !== false,
      xp_eligible: w.xp_eligible !== false,
      updated: w.updated_date || w.created_date
    };
  }
  return {
    id: w.id, kind, raw: w,
    name: w.account_name || w.username || "Account",
    platform: normPlatform(w.platform, "account"),
    domainOrHandle: w.username ? `@${w.username}` : "—",
    url: w.profile_url || null,
    eligibility: w.eligibility || "neutral",
    active: w.active !== false,
    publicly_visible: w.publicly_visible !== false,
    tracking_enabled: w.tracking_enabled !== false,
    points_eligible: w.points_eligible !== false,
    xp_eligible: w.xp_eligible !== false,
    updated: w.updated_date || w.created_date
  };
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

  const load = async () => {
    setLoading(true);
    try {
      const [sites, accounts] = await Promise.all([
        base44.entities.Website.list('-updated_date', 500),
        base44.entities.TrackedAccount.list('-updated_date', 500)
      ]);
      setRows([
        ...(sites || []).map((s) => toRow(s, "website")),
        ...(accounts || []).map((a) => toRow(a, "account"))
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (eligFilter !== "all" && r.eligibility !== eligFilter) return false;
      if (platFilter !== "all" && platformKey(r) !== platFilter) return false;
      if (q) {
        const term = q.toLowerCase();
        const hay = `${r.name} ${r.domainOrHandle} ${r.platform}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, q, eligFilter, platFilter]);

  const quickEligibility = async (row, eligibility) => {
    // Optimistic update: update local row state immediately
    const prevEligibility = row.eligibility;
    setRows((prev) => prev.map((r) => r.id === row.id && r.kind === row.kind ? { ...r, eligibility } : r));
    try {
      if (row.kind === "website") {
        await base44.entities.Website.update(row.id, { eligibility });
      } else {
        await base44.entities.TrackedAccount.update(row.id, { eligibility });
      }
      toast({ title: `Marked as ${eligibility}` });
    } catch (e) {
      // Revert on error
      setRows((prev) => prev.map((r) => r.id === row.id && r.kind === row.kind ? { ...r, eligibility: prevEligibility } : r));
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    }
  };

  const toggleActive = async (row) => {
    // Optimistic update: update local row state immediately
    const newVal = !row.active;
    setRows((prev) => prev.map((r) => r.id === row.id && r.kind === row.kind ? { ...r, active: newVal } : r));
    try {
      if (row.kind === "website") {
        await base44.entities.Website.update(row.id, { status: newVal ? "active" : "inactive" });
      } else {
        await base44.entities.TrackedAccount.update(row.id, { active: newVal });
      }
      toast({ title: newVal ? "Enabled" : "Disabled" });
    } catch (e) {
      // Revert on error
      setRows((prev) => prev.map((r) => r.id === row.id && r.kind === row.kind ? { ...r, active: !newVal } : r));
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    }
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({ ...row.raw });
  };

  const save = async () => {
    setSaving(true);
    try {
      const entity = editing.kind === "website" ? "Website" : "TrackedAccount";
      const payload = {
        eligibility: form.eligibility || "neutral",
        publicly_visible: !!form.publicly_visible,
        tracking_enabled: !!form.tracking_enabled,
        points_eligible: !!form.points_eligible,
        xp_eligible: !!form.xp_eligible,
        description: form.description || ""
      };
      if (editing.kind === "website") {
        payload.site_name = form.site_name;
        payload.domain = form.domain;
        payload.platform = form.platform || "Website";
        payload.status = form.status || "active";
      } else {
        payload.account_name = form.account_name;
        payload.platform = form.platform;
        payload.username = form.username;
        payload.profile_url = form.profile_url;
        payload.active = form.active !== false;
      }
      await base44.entities[entity].update(editing.id, payload);
      toast({ title: "Destination updated" });
      setEditing(null);
      load();
    } catch (e) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  return (
    <div>
      <PageHeader title="Destinations" description="Manage all allowed, neutral and disallowed destinations across websites and social platforms." />

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {["all", "allowed", "neutral", "disallowed"].map((v) => (
            <button
              key={v}
              onClick={() => setEligFilter(v)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                eligFilter === v ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {v === "all" ? "All" : v}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search destinations..." className="pl-9" />
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {PLATFORM_FILTERS.map((f) => {
          const Icon = f.Icon;
          const active = platFilter === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setPlatFilter(f.value)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                active ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {f.label}
            </button>
          );
        })}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState title="No destinations found" description="Add destinations via Sites & Domains or Tracked Accounts, or adjust your filters." />
      ) : (
        <>
          {/* Desktop table */}
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
                    <td className="px-4 py-3"><span className="capitalize">{r.platform}</span></td>
                    <td className="px-4 py-3 text-muted-foreground">{r.domainOrHandle}</td>
                    <td className="px-4 py-3">
                      <Select value={r.eligibility} onValueChange={(v) => quickEligibility(r, v)}>
                        <SelectTrigger className="h-8 w-32 border-0 bg-transparent px-1 shadow-none focus:ring-0"><EligibilityBadge eligibility={r.eligibility} /></SelectTrigger>
                        <SelectContent>
                          {ELIG_OPTS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${r.tracking_enabled ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>{r.tracking_enabled ? "On" : "Off"}</span>
                      {!r.active && <span className="ml-2 text-xs text-red-600 dark:text-red-400">inactive</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {r.points_eligible ? "Pts ✓" : "Pts ✕"} {r.xp_eligible ? "XP ✓" : "XP ✕"}
                    </td>
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

          {/* Mobile card list */}
          <div className="space-y-3 sm:hidden">
            {filtered.map((r) => (
              <div key={`${r.kind}-${r.id}`} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.name}</p>
                    <p className="text-xs capitalize text-muted-foreground">{r.platform}</p>
                    <p className="text-xs text-muted-foreground">{r.domainOrHandle}</p>
                  </div>
                  <Select value={r.eligibility} onValueChange={(v) => quickEligibility(r, v)}>
                    <SelectTrigger className="h-8 w-28 border-0 bg-transparent px-1 shadow-none focus:ring-0"><EligibilityBadge eligibility={r.eligibility} /></SelectTrigger>
                    <SelectContent>
                      {ELIG_OPTS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
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
                  <div>
                    <Label>Status</Label>
                    <Select value={form.status || "active"} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <div><Label>Account Name</Label><Input value={form.account_name || ""} onChange={(e) => setForm({ ...form, account_name: e.target.value })} className="mt-1.5" /></div>
                  <div><Label>Platform</Label><Input value={form.platform || ""} onChange={(e) => setForm({ ...form, platform: e.target.value })} className="mt-1.5" placeholder="YouTube, X, ..." /></div>
                  <div><Label>Username / Handle</Label><Input value={form.username || ""} onChange={(e) => setForm({ ...form, username: e.target.value })} className="mt-1.5" /></div>
                  <div><Label>Profile URL</Label><Input value={form.profile_url || ""} onChange={(e) => setForm({ ...form, profile_url: e.target.value })} className="mt-1.5" /></div>
                </>
              )}
              <div>
                <Label>Eligibility</Label>
                <Select value={form.eligibility || "neutral"} onValueChange={(v) => setForm({ ...form, eligibility: v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ELIG_OPTS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
    </div>
  );
}