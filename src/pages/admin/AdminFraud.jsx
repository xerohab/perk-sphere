import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Info } from "lucide-react";
import PageHeader from "@/components/perk/PageHeader";
import StatusBadge from "@/components/perk/StatusBadge";
import EmptyState from "@/components/perk/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue
} from "@/components/ui/select";

const REVIEW_STATUSES = ["pending", "reviewing", "cleared", "escalated"];

export default function AdminFraud() {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const f = await base44.entities.FraudFlag.list('-created_date', 200);
      setItems(f || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (flag, status) => {
    await base44.entities.FraudFlag.update(flag.id, { review_status: status });
    toast({ title: "Review status updated" });
    load();
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  return (
    <div>
      <PageHeader title="Fraud Review" description={`${items.filter((i) => i.review_status === "pending").length} pending review`} />
      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p>Risk flags are signals, not proof. A single flag does not automatically result in a ban. Review each case and set its status manually.</p>
      </div>
      {items.length === 0 ? (
        <EmptyState title="No risk flags" description="Anti-abuse flags raised by the system will appear here." />
      ) : (
        <div className="space-y-3">
          {items.map((f) => (
            <div key={f.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium capitalize">{f.flag_type?.replace(/_/g, " ")}</p>
                  <p className="text-xs text-muted-foreground">User {f.user_id?.slice(0, 8)} · Risk score {f.risk_score || 0}</p>
                  {f.details && <p className="mt-1 text-xs text-muted-foreground">{f.details}</p>}
                  {f.risk_flags?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {f.risk_flags.map((rf) => <span key={rf} className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">{rf}</span>)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={f.review_status} />
                  <Select value={f.review_status} onValueChange={(v) => updateStatus(f, v)}>
                    <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REVIEW_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}