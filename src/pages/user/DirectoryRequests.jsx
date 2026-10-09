import React, { useEffect, useState } from "react";
import { Clock, CheckCircle2, XCircle, Loader2, ListChecks } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/perk/PageHeader";
import EmptyState from "@/components/perk/EmptyState";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const STATUS_CONFIG = {
  pending: { label: "Pending", icon: Clock, className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400" },
  approved: { label: "Approved", icon: CheckCircle2, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" },
  denied: { label: "Denied", icon: XCircle, className: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400" },
  reviewing: { label: "Under Review", icon: Loader2, className: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400" }
};

const TYPE_LABELS = {
  add_allowed: "Add as Allowed",
  add_disallowed: "Add as Disallowed",
  remove_disallowed: "Remove Disallowed",
  reclassify: "Reclassify"
};

function extractList(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.requests || data.items || [];
}

export default function DirectoryRequests() {
  const { toast } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("perkSphereRequests", { action: "list", filters: {} });
      const data = res?.data || res;
      if (data?.ok === false) throw new Error(data.error);
      setRequests(extractList(data));
    } catch (e) {
      const errData = e?.response?.data || {};
      setError(errData.error || e.message || "Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  return (
    <div>
      <PageHeader title="My Directory Requests" description="Track the status of your directory addition, removal and reclassification requests" />

      {error && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Requests temporarily unavailable</p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={load}>Retry</Button>
        </div>
      )}

      {!error && (
        <div className="mt-6">
          {requests.length === 0 ? (
            <EmptyState title="No requests yet" description="Submit directory requests from the Directory page." />
          ) : (
            <div className="space-y-3">
              {requests.map((r) => {
                const status = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
                const StatusIcon = status.icon;
                return (
                  <div key={r.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <ListChecks className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-semibold">{r.target_name || r.entry_name || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">{TYPE_LABELS[r.request_type] || r.request_type}</p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>
                        <StatusIcon className={`h-3.5 w-3.5 ${r.status === "reviewing" ? "animate-spin" : ""}`} />
                        {status.label}
                      </span>
                    </div>
                    {r.reason && <p className="mt-3 text-xs text-muted-foreground">{r.reason}</p>}
                    {r.review_reason && (
                      <div className="mt-3 rounded-lg bg-secondary/50 p-3">
                        <p className="text-xs font-medium">Review: {r.review_reason}</p>
                        {r.reviewed_by && <p className="mt-1 text-xs text-muted-foreground">Reviewed by administrator</p>}
                      </div>
                    )}
                    <p className="mt-3 text-xs text-muted-foreground">{new Date(r.created_at || r.created_date || Date.now()).toLocaleDateString("en-GB")}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}