import React, { useEffect, useState, useMemo } from "react";
import { Search, Plus, Pencil, Globe, AtSign, Youtube, Loader2, Power } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/perk/PageHeader";
import EmptyState from "@/components/perk/EmptyState";
import ClassificationBadge from "@/components/perk/ClassificationBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

const TYPE_ICONS = { website: Globe, x_account: AtSign, youtube_channel: Youtube };
const TYPE_LABELS = { website: "Website", x_account: "X Account", youtube_channel: "YouTube Channel" };

function extractList(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.entries || data.items || [];
}

const emptyEntry = { name: "", type: "website", url: "", classification: "neutral", description: "", active: true };

export default function AdminDirectory() {
  const { toast } = useToast();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [editDialog, setEditDialog] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("perkSphereDirectory", { action: "list", filters: {}, scope: "all" });
      const data = res?.data || res;
      if (data?.ok === false) throw new Error(data.error);
      setEntries(extractList(data));
    } catch (e) {
      const errData = e?.response?.data || {};
      setError(errData.error || e.message || "Failed to load directory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search) return entries;
    const q = search.toLowerCase();
    return entries.filter((e) => (e.name || "").toLowerCase().includes(q) || (e.url || "").toLowerCase().includes(q));
  }, [entries, search]);

  const save = async () => {
    if (!editDialog) return;
    const { entry, entryId } = editDialog;
    if (!entry.name || !entry.type) {
      toast({ title: "Validation error", description: "Name and type are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await base44.functions.invoke("perkSphereDirectory", { action: "upsert", entry, entryId });
      const data = res?.data || res;
      if (data?.ok === false) throw new Error(data.error);
      toast({ title: "Entry saved", description: "The directory entry has been saved." });
      setEditDialog(null);
      load();
    } catch (e) {
      const errData = e?.response?.data || {};
      toast({ title: "Save failed", description: errData.error || e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  return (
    <div>
      <PageHeader title="Directory Management" description="Add, edit, classify and manage directory entries" />

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search entries..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button onClick={() => setEditDialog({ entry: { ...emptyEntry }, entryId: null })}>
          <Plus className="mr-2 h-4 w-4" /> Add Entry
        </Button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Directory temporarily unavailable</p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={load}>Retry</Button>
        </div>
      )}

      {!error && (
        <div className="mt-6">
          {filtered.length === 0 ? (
            <EmptyState title="No entries" description="Add directory entries using the button above." />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Name</th>
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-left font-medium">Classification</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((e) => {
                    const Icon = TYPE_ICONS[e.type] || Globe;
                    return (
                      <tr key={e.id} className="hover:bg-secondary/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{e.name || e.account_name || e.site_name}</p>
                              {e.url && <p className="text-xs text-muted-foreground">{e.url}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{TYPE_LABELS[e.type] || e.type}</td>
                        <td className="px-4 py-3"><ClassificationBadge classification={e.classification || e.eligibility || "neutral"} /></td>
                        <td className="px-4 py-3">
                          {e.active !== false ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Power className="h-3 w-3" /> Published</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Archived</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm" onClick={() => setEditDialog({ entry: { ...e }, entryId: e.id })}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editDialog} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editDialog?.entryId ? "Edit Entry" : "Add Entry"}</DialogTitle>
          </DialogHeader>
          {editDialog && (
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input className="mt-1" value={editDialog.entry.name} onChange={(e) => setEditDialog({ ...editDialog, entry: { ...editDialog.entry, name: e.target.value } })} />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={editDialog.entry.type} onValueChange={(v) => setEditDialog({ ...editDialog, entry: { ...editDialog.entry, type: v } })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="x_account">X Account</SelectItem>
                    <SelectItem value="youtube_channel">YouTube Channel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>URL</Label>
                <Input className="mt-1" value={editDialog.entry.url || ""} onChange={(e) => setEditDialog({ ...editDialog, entry: { ...editDialog.entry, url: e.target.value } })} placeholder="https://..." />
              </div>
              <div>
                <Label>Classification</Label>
                <Select value={editDialog.entry.classification} onValueChange={(v) => setEditDialog({ ...editDialog, entry: { ...editDialog.entry, classification: v } })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allowed">Allowed</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="disallowed">Disallowed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea className="mt-1" rows={3} value={editDialog.entry.description || ""} onChange={(e) => setEditDialog({ ...editDialog, entry: { ...editDialog.entry, description: e.target.value } })} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="active" checked={editDialog.entry.active !== false} onChange={(e) => setEditDialog({ ...editDialog, entry: { ...editDialog.entry, active: e.target.checked } })} />
                <Label htmlFor="active" className="text-sm font-normal">Published (visible to members)</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}