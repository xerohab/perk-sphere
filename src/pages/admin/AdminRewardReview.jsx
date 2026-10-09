import React, { useEffect, useState } from "react";
import { Clock, CheckCircle2, XCircle, Loader2, Award, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/perk/PageHeader";
import EmptyState from "@/components/perk/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

function extractList(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.requests || data.items || [];
}

export default function AdminRewardReview() {
  const { toast } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stage2Disabled, setStage2Disabled] = useState(false);
  const [reviewDialog, setReviewDialog] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    setStage2Disabled(false);
    try {
      const res = await base44.functions.invoke("perkSphereRewardReview", { action: "reviewQueue", filters: {} });
      const data = res?.data || res;
      if (data?.ok === false) throw new Error(data.error);
      setRequests(extractList(data));
    } catch (e) {
      const errData = e?.response?.data || {};
      const errCode = errData.code || errData.error || e.message || "";
      if (errCode === "stage2_identity_not_enabled") {
        setStage2Disabled(true);
      } else {
        setError(errData.error || e.message || "Failed to load reward queue");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const doDecision = async () => {
    if (!reviewDialog) return;
    const { requestId, decision, reason, pointsValue, xpValue } = reviewDialog;
    if (!reason || reason.trim().length < 3) {
      toast({ title: "Validation error", description: "A reason is required.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke("perkSphereRewardReview", {
        action: "decision", requestId, decision, reason,
        pointsValue: pointsValue !== "" ? Number(pointsValue) : undefined,
        xpValue: xpValue !== "" ? Number(xpValue) : undefined
      });
      const data = res?.data || res;
      if (data?.ok === false) throw new Error(data.error);
      toast({ title: `Request ${decision}`, description: "The reward request has been reviewed." });
      setReviewDialog(null);
      load();
    } catch (e) {
      const errData = e?.response?.data || {};
      toast({ title: "Decision failed", description: errData.error || e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  return (
    <div>
      <PageHeader title="Reward Review" description="Review pending reward requests and make authorised decisions" />

      <div className="mt-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="space-y-1">
          <p className="text-xs text-blue-800 dark:text-blue-300">
            <strong>Approval is not payout.</strong> An approved request is acknowledged by Linux but does NOT update the Base44 ledger. Payout controls are disabled until the verified ledger handoff is available.
          </p>
          <p className="text-xs text-blue-800 dark:text-blue-300">
            Disallowed activity does not automatically deduct Points or XP merely because a browser or extension reported it.
          </p>
        </div>
      </div>

      {stage2Disabled && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Reward review is awaiting final activation.</p>
              <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">
                The reward review queue requires an additional identity-verification step on the Linux API that is not yet enabled. Member reward request status remains available independently.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && !stage2Disabled && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Reward queue temporarily unavailable</p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={load}>Retry</Button>
        </div>
      )}

      {!error && !stage2Disabled && (
        <div className="mt-6">
          {requests.length === 0 ? (
            <EmptyState title="No pending requests" description="The reward review queue is empty." />
          ) : (
            <div className="space-y-3">
              {requests.map((r) => (
                <Card key={r.id} className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-semibold">{r.reason || r.description || r.source || "Reward Request"}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.user_reference || r.user_name || "Member"} · {new Date(r.created_at || r.created_date || Date.now()).toLocaleDateString("en-GB")}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                      <Clock className="h-3.5 w-3.5" /> {r.status || "pending"}
                    </span>
                  </div>
                  {(r.points_value || r.xp_value) && (
                    <div className="mt-3 flex gap-4 text-sm">
                      {r.points_value && <span><strong>{r.points_value}</strong> Points</span>}
                      {r.xp_value && <span><strong>{r.xp_value}</strong> XP</span>}
                    </div>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => setReviewDialog({ requestId: r.id, decision: "approved", reason: "", pointsValue: r.points_value || "", xpValue: r.xp_value || "" })}>
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setReviewDialog({ requestId: r.id, decision: "denied", reason: "", pointsValue: "", xpValue: "" })}>
                      <XCircle className="mr-1.5 h-3.5 w-3.5" /> Deny
                    </Button>
                  </div>
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
            <DialogTitle>{reviewDialog?.decision === "approved" ? "Approve Reward Request" : "Deny Reward Request"}</DialogTitle>
          </DialogHeader>
          {reviewDialog && (
            <div className="space-y-4">
              {reviewDialog.decision === "approved" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Points Value</Label>
                      <Input className="mt-1" type="number" value={reviewDialog.pointsValue} onChange={(e) => setReviewDialog({ ...reviewDialog, pointsValue: e.target.value })} placeholder="0" />
                    </div>
                    <div>
                      <Label>XP Value</Label>
                      <Input className="mt-1" type="number" value={reviewDialog.xpValue} onChange={(e) => setReviewDialog({ ...reviewDialog, xpValue: e.target.value })} placeholder="0" />
                    </div>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
                    <p className="text-xs text-amber-800 dark:text-amber-300">Approving this request does NOT issue Points or XP to the member's ledger. Payout controls are disabled until the verified ledger handoff is available.</p>
                  </div>
                </>
              )}
              <div>
                <Label>Reason (required)</Label>
                <Textarea className="mt-1" rows={3} value={reviewDialog.reason} onChange={(e) => setReviewDialog({ ...reviewDialog, reason: e.target.value })} placeholder="Explain the decision..." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialog(null)}>Cancel</Button>
            <Button onClick={doDecision} disabled={submitting} variant={reviewDialog?.decision === "approved" ? "default" : "destructive"}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirm {reviewDialog?.decision === "approved" ? "Approval" : "Denial"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}