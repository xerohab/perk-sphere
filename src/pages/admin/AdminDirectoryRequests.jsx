import React, { useEffect, useState } from "react";
import { Clock, CheckCircle2, XCircle, Loader2, ListChecks } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/perk/PageHeader";
import EmptyState from "@/components/perk/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

const TYPE_LABELS = {
  add_allowed: "Add as Allowed",
  add_disallowed: "Add as Disallowed",
  remove_disallowed: "Remove Disallowed",
  reclassify: "Reclassify"
};

function extractList(data) {
  if (!data) return [];
  if (data.ok === true && data.data !== undefined) return extractList(data.data);
  if (Array.isArray(data)) return data;
  return data.requests || data.items || [];
}

export default function AdminDirectoryRequests() {
  const { toast } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviewDialog, setReviewDialog] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("perkSphereRequests", { action: "listAll", filters: {} });
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

  const doReview = async () => {
    if (!reviewDialog) return;
    const { requestId, decision, reason } = reviewDialog;
    if (!reason || reason.trim().length < 3) {
      toast({ title: "Validation error", description: "A reason is required.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke("perkSphereRequests", { action: "review", requestId, decision, reason });
      const data = res?.data || res;
      if (data?.ok === false) throw new Error(data.error);
      toast({ title: `Request ${decision}`, description: "The directory request has been reviewed." });
      setReviewDialog(null);
      load();
    } catch (e) {
      const errData = e?.response?.data || {};
      toast({ title: "Review failed", description: errData.error || e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  return (
    <div>
      <PageHeader title="Directory Requests" description="Review member submissions for directory additions, removals and reclassifications" />

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
            <EmptyState title="No requests" description="Member directory requests will appear here." />
          ) : (
            <div className="space-y-3">
              {requests.map((r) => (
                <Card key={r.id} className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <ListChecks className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-semibold">{r.target_name || r.entry_name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{TYPE_LABELS[r.request_type] || r.request_type}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                      r.status === "pending" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400" :
                      r.status === "approved" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" :
                      "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
                    }`}>
                      {r.status === "pending" ? <Clock className="h-3.5 w-3.5" /> : r.status === "approved" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                      {r.status}
                    </span>
                  </div>
                  {r.reason && <p className="mt-3 text-xs text-muted-foreground">{r.reason}</p>}
                  {r.target_url && <p className="mt-2 text-xs text-indigo-600 dark:text-indigo-400">{r.target_url}</p>}
                  {r.review_reason && <div className="mt-3 rounded-lg bg-secondary/50 p-3"><p className="text-xs font-medium">Review: {r.review_reason}</p></div>}
                  {r.status === "pending" && (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" onClick={() => setReviewDialog({ requestId: r.id, decision: "approved", reason: "" })}>
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setReviewDialog({ requestId: r.id, decision: "denied", reason: "" })}>
                        <XCircle className="mr-1.5 h-3.5 w-3.5" /> Deny
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Review dialog */}
      <Dialog open={!!reviewDialog} onOpenChange={(open) => !open && setReviewDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reviewDialog?.decision === "approved" ? "Approve Request" : "Deny Request"}</DialogTitle>
          </DialogHeader>
          {reviewDialog && (
            <div className="space-y-4">
              <div>
                <Label>Reason (required)</Label>
                <Textarea className="mt-1" rows={3} value={reviewDialog.reason} onChange={(e) => setReviewDialog({ ...reviewDialog, reason: e.target.value })} placeholder="Explain the decision..." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialog(null)}>Cancel</Button>
            <Button onClick={doReview} disabled={submitting} variant={reviewDialog?.decision === "approved" ? "default" : "destructive"}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirm {reviewDialog?.decision === "approved" ? "Approval" : "Denial"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
