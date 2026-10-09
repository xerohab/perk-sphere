import React, { useEffect, useState, useMemo } from "react";
import { Search, Globe, AtSign, Youtube, Plus, ArrowLeftRight, ExternalLink, Loader2 } from "lucide-react";
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
  return data.entries || data.items || data.directory || [];
}

export default function Directory() {
  const { toast } = useToast();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [requestDialog, setRequestDialog] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("perkSphereDirectory", { action: "list", filters: {} });
      const data = res?.data || res;
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
    return entries.filter((e) => {
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (classFilter !== "all" && (e.classification || e.eligibility) !== classFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = (e.name || e.account_name || e.site_name || "").toLowerCase();
        const url = (e.url || e.domain || e.profile_url || "").toLowerCase();
        if (!name.includes(q) && !url.includes(q)) return false;
      }
      return true;
    });
  }, [entries, typeFilter, classFilter, search]);

  const submitRequest = async () => {
    if (!requestDialog) return;
    const { request_type, target_name, target_url, requested_classification, reason } = requestDialog;
    if (!target_name || !reason || reason.trim().length < 10) {
      toast({ title: "Validation error", description: "Name and a reason of at least 10 characters are required.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke("perkSphereRequests", {
        action: "create",
        request: { request_type, target_name, target_url, requested_classification, reason }
      });
      const data = res?.data || res;
      if (data?.ok === false) throw new Error(data.error);
      toast({ title: "Request submitted", description: "Your directory request has been submitted for review." });
      setRequestDialog(null);
    } catch (e) {
      const errData = e?.response?.data || {};
      toast({ title: "Request failed", description: errData.error || e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  return (
    <div>
      <PageHeader title="Directory" description="Browse websites, X accounts and YouTube channels classified across Perk Sphere" />

      {error && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Directory temporarily unavailable</p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={load}>Retry</Button>
        </div>
      )}

      {!error && (
        <>
          {/* Search and filters */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by name or URL..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="website">Websites</SelectItem>
                <SelectItem value="x_account">X Accounts</SelectItem>
                <SelectItem value="youtube_channel">YouTube Channels</SelectItem>
              </SelectContent>
            </Select>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Classification" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classifications</SelectItem>
                <SelectItem value="allowed">Allowed</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="disallowed">Disallowed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Request buttons */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setRequestDialog({ request_type: "add_allowed", target_name: "", target_url: "", requested_classification: "allowed", reason: "" })}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Request Addition
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRequestDialog({ request_type: "reclassify", target_name: "", target_url: "", requested_classification: "neutral", reason: "" })}>
              <ArrowLeftRight className="mr-1.5 h-3.5 w-3.5" /> Request Reclassification
            </Button>
          </div>

          {/* Entries */}
          <div className="mt-6">
            {filtered.length === 0 ? (
              <EmptyState title="No entries found" description="Try adjusting your search or filters." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((entry) => {
                  const Icon = TYPE_ICONS[entry.type] || Globe;
                  const name = entry.name || entry.account_name || entry.site_name || "Unknown";
                  const url = entry.url || entry.domain || entry.profile_url || "";
                  const classification = entry.classification || entry.eligibility || "neutral";
                  return (
                    <div key={entry.id} className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                            <Icon className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{name}</p>
                            <p className="text-xs text-muted-foreground">{TYPE_LABELS[entry.type] || entry.type}</p>
                          </div>
                        </div>
                        <ClassificationBadge classification={classification} />
                      </div>
                      {entry.description && <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{entry.description}</p>}
                      {url && (
                        <a href={url.startsWith("http") ? url : `https://${url}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400">
                          <ExternalLink className="h-3 w-3" /> {url}
                        </a>
                      )}
                      <Button variant="ghost" size="sm" className="mt-3 self-start text-xs" onClick={() => setRequestDialog({ request_type: "reclassify", target_name: name, target_url: url, requested_classification: classification === "disallowed" ? "neutral" : "disallowed", reason: "" })}>
                        <ArrowLeftRight className="mr-1.5 h-3 w-3" /> Request Reclassification
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Request dialog */}
      <Dialog open={!!requestDialog} onOpenChange={(open) => !open && setRequestDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Directory Request</DialogTitle>
          </DialogHeader>
          {requestDialog && (
            <div className="space-y-4">
              <div>
                <Label>Request type</Label>
                <Select value={requestDialog.request_type} onValueChange={(v) => setRequestDialog({ ...requestDialog, request_type: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add_allowed">Add as Allowed</SelectItem>
                    <SelectItem value="add_disallowed">Add as Disallowed</SelectItem>
                    <SelectItem value="remove_disallowed">Remove Disallowed Classification</SelectItem>
                    <SelectItem value="reclassify">Reclassify Existing Entry</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Target name</Label>
                <Input className="mt-1" value={requestDialog.target_name} onChange={(e) => setRequestDialog({ ...requestDialog, target_name: e.target.value })} placeholder="e.g. example.com or @account" />
              </div>
              <div>
                <Label>Target URL (optional)</Label>
                <Input className="mt-1" value={requestDialog.target_url} onChange={(e) => setRequestDialog({ ...requestDialog, target_url: e.target.value })} placeholder="https://..." />
              </div>
              {(requestDialog.request_type === "add_allowed" || requestDialog.request_type === "reclassify") && (
                <div>
                  <Label>Requested classification</Label>
                  <Select value={requestDialog.requested_classification} onValueChange={(v) => setRequestDialog({ ...requestDialog, requested_classification: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="allowed">Allowed</SelectItem>
                      <SelectItem value="neutral">Neutral</SelectItem>
                      <SelectItem value="disallowed">Disallowed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Reason (minimum 10 characters)</Label>
                <Textarea className="mt-1" rows={3} value={requestDialog.reason} onChange={(e) => setRequestDialog({ ...requestDialog, reason: e.target.value })} placeholder="Explain why this entry should be added, removed or reclassified..." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDialog(null)}>Cancel</Button>
            <Button onClick={submitRequest} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}