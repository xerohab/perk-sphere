import React, { useEffect, useState } from "react";
import { Clock, CheckCircle2, XCircle, Loader2, Award, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/perk/PageHeader";
import EmptyState from "@/components/perk/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const STATUS_CONFIG = {
  pending: { label: "Pending Review", icon: Clock, className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400" },
  approved: { label: "Approved (not yet paid)", icon: CheckCircle2, className: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400" },
  denied: { label: "Denied", icon: XCircle, className: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400" },
  ledger_confirmed: { label: "Ledger Confirmed", icon: CheckCircle2, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" }
};

function extractList(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.requests || data.items || [];
}

export default function RewardReview() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stage2Disabled, setStage2Disabled] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    setStage2Disabled(false);
    try {
      const res = await base44.functions.invoke("perkSphereRewardReview", { action: "mine", filters: {} });
      const data = res?.data || res;
      if (data?.ok === false) throw new Error(data.error);
      setRequests(extractList(data));
    } catch (e) {
      const errData = e?.response?.data || {};
      const errCode = errData.code || errData.error || e.message || "";
      if (errCode === "stage2_identity_not_enabled") {
        setStage2Disabled(true);
      } else {
        setError(errData.error || e.message || "Failed to load reward requests");
      }
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
      <PageHeader title="Reward Requests" description="Track the status of your reward requests. Approval does not mean a payout has been confirmed." />

      {/* Important notice */}
      <div className="mt-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
        <p className="text-xs text-blue-800 dark:text-blue-300">
          Approved requests are acknowledged by Linux but are <strong>not confirmed payouts</strong>. A request is only ledger-confirmed when a Base44 Points or XP transaction exists. Disallowed activity does not automatically deduct Points or XP.
        </p>
      </div>

      {stage2Disabled && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Reward requests are awaiting final activation.</p>
              <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">
                Reward request tracking requires an additional identity-verification step on the Linux API that is not yet enabled. Your weekly report preview remains available independently.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && !stage2Disabled && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Reward requests temporarily unavailable</p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={load}>Retry</Button>
        </div>
      )}

      {!error && !stage2Disabled && (
        <div className="mt-6">
          {requests.length === 0 ? (
            <EmptyState title="No reward requests" description="Your reward request history will appear here." />
          ) : (
            <div className="space-y-3">
              {requests.map((r) => {
                const status = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
                const StatusIcon = status.icon;
                return (
                  <Card key={r.id} className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-semibold">{r.reason || r.description || r.source || "Reward Request"}</p>
                          <p className="text-xs text-muted-foreground">{new Date(r.created_at || r.created_date || Date.now()).toLocaleDateString("en-GB")}</p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        {status.label}
                      </span>
                    </div>
                    {(r.points_value || r.xp_value) && (
                      <div className="mt-3 flex gap-4 text-sm">
                        {r.points_value && <span><strong>{r.points_value}</strong> Points</span>}
                        {r.xp_value && <span><strong>{r.xp_value}</strong> XP</span>}
                      </div>
                    )}
                    {r.review_reason && (
                      <div className="mt-3 rounded-lg bg-secondary/50 p-3">
                        <p className="text-xs font-medium">Review: {r.review_reason}</p>
                      </div>
                    )}
                    {r.status === "approved" && (
                      <p className="mt-3 text-xs text-blue-600 dark:text-blue-400">
                        This request has been approved but has not yet been confirmed in the ledger.
                      </p>
                    )}
                    {r.status === "ledger_confirmed" && (
                      <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400">
                        This reward has been confirmed in the Base44 ledger.
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}