import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Coins, TrendingUp, Plus, Minus, ShieldBan, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import PageHeader from "@/components/perk/PageHeader";
import RankBadge from "@/components/perk/RankBadge";
import StatusBadge from "@/components/perk/StatusBadge";
import EmptyState from "@/components/perk/EmptyState";
import ConfirmDialog from "@/components/perk/ConfirmDialog";
import ResponsiveTable from "@/components/perk/ResponsiveTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose
} from "@/components/ui/dialog";

export default function AdminUserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [pointsTxns, setPointsTxns] = useState([]);
  const [xpTxns, setXpTxns] = useState([]);
  const [activities, setActivities] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [restrictions, setRestrictions] = useState([]);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adjustOpen, setAdjustOpen] = useState(null);
  const [form, setForm] = useState({ amount: "", reason: "", adminNote: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [u, pt, xt, a, r, rs, al] = await Promise.all([
        base44.entities.User.get(id),
        base44.entities.PointsTransaction.filter({ user_id: id }),
        base44.entities.XpTransaction.filter({ user_id: id }),
        base44.entities.Activity.filter({ user_id: id }),
        base44.entities.Redemption.filter({ user_id: id }),
        base44.entities.Restriction.filter({ user_id: id }),
        base44.entities.AuditLog.filter({ entity_id: id })
      ]);
      setUser(u);
      const byDate = (x, y) => new Date(y.created_date) - new Date(x.created_date);
      setPointsTxns((pt || []).sort(byDate));
      setXpTxns((xt || []).sort(byDate));
      setActivities((a || []).sort(byDate));
      setRedemptions((r || []).sort(byDate));
      setRestrictions((rs || []).sort(byDate));
      setAudit((al || []).sort(byDate));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const submitAdjust = async () => {
    const { currency, direction } = adjustOpen;
    const amount = Math.abs(Number(form.amount));
    if (!amount) { toast({ title: "Enter an amount", variant: "destructive" }); return; }
    const signed = direction === "deduct" ? -amount : amount;
    setSaving(true);
    try {
      await base44.functions.invoke("adjustBalance", { userId: id, currency, amount: signed, reason: form.reason, adminNote: form.adminNote });
      toast({ title: `${currency === "points" ? "Points" : "XP"} ${direction === "deduct" ? "deducted" : "added"}` });
      setAdjustOpen(null);
      setForm({ amount: "", reason: "", adminNote: "" });
      await load();
    } catch (e) {
      toast({ title: "Adjustment failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status) => {
    try {
      await base44.functions.invoke("setUserStatus", { userId: id, status });
      toast({ title: `Account ${status}` });
      load();
    } catch (e) {
      toast({ title: "Failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }
  if (!user) {
    return <EmptyState title="User not found" />;
  }

  const ActionButton = ({ currency, direction, label }) => (
    <Button variant="outline" size="sm" onClick={() => setAdjustOpen({ currency, direction })} className={direction === "deduct" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}>
      {direction === "deduct" ? <Minus className="mr-1 h-3.5 w-3.5" /> : <Plus className="mr-1 h-3.5 w-3.5" />}{label}
    </Button>
  );

  const pointsCols = [
    { key: "created_date", label: "Date", render: (t) => new Date(t.created_date).toLocaleString() },
    { key: "transaction_type", label: "Type", render: (t) => <span className="capitalize">{t.transaction_type?.replace(/_/g, " ")}</span> },
    { key: "reason", label: "Reason", render: (t) => t.reason || "—" },
    { key: "amount", label: "Amount", align: "right", render: (t) => <span className={t.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>{t.amount >= 0 ? "+" : ""}{t.amount}</span> },
    { key: "balance_after", label: "Balance", align: "right", render: (t) => t.balance_after }
  ];
  const xpCols = [
    { key: "created_date", label: "Date", render: (t) => new Date(t.created_date).toLocaleString() },
    { key: "reason", label: "Reason", render: (t) => t.reason || "—" },
    { key: "xp_amount", label: "XP", align: "right", render: (t) => <span className={t.xp_amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>{t.xp_amount >= 0 ? "+" : ""}{t.xp_amount}</span> },
    { key: "xp_after", label: "After", align: "right", render: (t) => t.xp_after }
  ];
  const activityCols = [
    { key: "platform", label: "Platform", render: (a) => <span className="capitalize">{a.platform}</span> },
    { key: "activity_type", label: "Type", render: (a) => <span className="capitalize">{a.activity_type?.replace(/_/g, " ")}</span> },
    { key: "target", label: "Target", render: (a) => a.target_account || a.target || "—" },
    { key: "created_date", label: "Date", render: (a) => new Date(a.created_date).toLocaleString() },
    { key: "verification_status", label: "Source", render: (a) => <StatusBadge status={a.verification_status} /> }
  ];
  const redemptionCols = [
    { key: "reward_name", label: "Reward", render: (r) => r.reward_name },
    { key: "points_spent", label: "Points", align: "right", render: (r) => r.points_spent },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "created_date", label: "Date", render: (r) => new Date(r.created_date).toLocaleDateString() }
  ];

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin/users")} className="mb-4"><ArrowLeft className="mr-1 h-4 w-4" /> Back to users</Button>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-lg font-bold text-white dark:from-slate-600 dark:to-slate-800">
              {(user.display_name || user.email || "P").charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-semibold">{user.display_name || user.username || user.email}</h1>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge status={user.account_status || "active"} />
                <RankBadge rank={user.loyalty_rank || "Bronze"} />
                {user.role === "admin" && <StatusBadge status="admin" />}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton currency="points" direction="add" label="Add Points" />
            <ActionButton currency="points" direction="deduct" label="Deduct Points" />
            <ActionButton currency="xp" direction="add" label="Add XP" />
            <ActionButton currency="xp" direction="deduct" label="Deduct XP" />
            {user.account_status !== "suspended" && (
              <ConfirmDialog trigger={<Button variant="outline" size="sm" className="text-orange-600 dark:text-orange-400"><ShieldBan className="mr-1 h-3.5 w-3.5" /> Suspend</Button>} title="Suspend this account?" description="The user will be unable to log in or earn rewards." confirmLabel="Suspend" destructive onConfirm={() => setStatus("suspended")} />
            )}
            {user.account_status !== "banned" && (
              <ConfirmDialog trigger={<Button variant="outline" size="sm" className="text-red-600 dark:text-red-400"><ShieldBan className="mr-1 h-3.5 w-3.5" /> Ban</Button>} title="Ban this account?" description="This is a severe action. The user will be permanently blocked." confirmLabel="Ban" destructive onConfirm={() => setStatus("banned")} />
            )}
            {user.account_status !== "active" && (
              <ConfirmDialog trigger={<Button variant="outline" size="sm" className="text-emerald-600 dark:text-emerald-400"><ShieldCheck className="mr-1 h-3.5 w-3.5" /> Restore</Button>} title="Restore this account?" description="The account will return to active status." confirmLabel="Restore" onConfirm={() => setStatus("active")} />
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm sm:grid-cols-4">
          <div><p className="text-xs text-muted-foreground">Account ID</p><p className="font-mono text-xs">{user.id}</p></div>
          <div><p className="text-xs text-muted-foreground">Joined</p><p>{user.created_date ? new Date(user.created_date).toLocaleDateString() : "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Streak</p><p>{user.streak_current || 0} days</p></div>
          <div><p className="text-xs text-muted-foreground">Redemptions</p><p>{redemptions.length}</p></div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-indigo-700 dark:text-indigo-400"><Coins className="h-4 w-4" /> Points</div>
          <p className="mt-2 text-3xl font-bold text-indigo-900 dark:text-indigo-300">{(user.points_balance || 0).toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-amber-700 dark:text-amber-400"><TrendingUp className="h-4 w-4" /> Loyalty XP</div>
          <p className="mt-2 text-3xl font-bold text-amber-900 dark:text-amber-300">{(user.loyalty_xp || 0).toLocaleString()}</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList className="flex w-full flex-wrap justify-start gap-1 overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="points">Points History</TabsTrigger>
          <TabsTrigger value="xp">XP History</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="redemptions">Redemptions</TabsTrigger>
          <TabsTrigger value="restrictions">Restrictions</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Total Points Txns</p><p className="mt-1 text-xl font-semibold">{pointsTxns.length}</p></div>
            <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Total XP Txns</p><p className="mt-1 text-xl font-semibold">{xpTxns.length}</p></div>
            <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Activities</p><p className="mt-1 text-xl font-semibold">{activities.length}</p></div>
          </div>
        </TabsContent>
        <TabsContent value="points" className="mt-4"><ResponsiveTable columns={pointsCols} rows={pointsTxns} emptyTitle="No points transactions" /></TabsContent>
        <TabsContent value="xp" className="mt-4"><ResponsiveTable columns={xpCols} rows={xpTxns} emptyTitle="No XP transactions" /></TabsContent>
        <TabsContent value="activity" className="mt-4"><ResponsiveTable columns={activityCols} rows={activities} emptyTitle="No activity" /></TabsContent>
        <TabsContent value="redemptions" className="mt-4"><ResponsiveTable columns={redemptionCols} rows={redemptions} emptyTitle="No redemptions" /></TabsContent>
        <TabsContent value="restrictions" className="mt-4">
          {restrictions.length === 0 ? <EmptyState title="No restrictions" /> : (
            <div className="space-y-2">
              {restrictions.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                  <div><p className="text-sm font-medium">{r.type}</p><p className="text-xs text-muted-foreground">{r.reason}</p></div>
                  <StatusBadge status={r.active ? "active" : "inactive"} />
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          {audit.length === 0 ? <EmptyState title="No audit entries" /> : (
            <div className="space-y-2">
              {audit.map((a) => (
                <div key={a.id} className="rounded-xl border border-border bg-card p-3 text-sm">
                  <div className="flex justify-between"><span className="font-medium capitalize">{a.action?.replace(/_/g, " ")}</span><span className="text-xs text-muted-foreground">{new Date(a.created_date).toLocaleString()}</span></div>
                  <p className="mt-1 text-xs text-muted-foreground">{a.entity_type} · {a.entity_id?.slice(0, 8)}</p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!adjustOpen} onOpenChange={(o) => !o && setAdjustOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{adjustOpen?.direction === "deduct" ? "Deduct" : "Add"} {adjustOpen?.currency === "points" ? "Points" : "XP"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1.5" /></div>
            <div><Label>Reason (visible to user)</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="mt-1.5" /></div>
            <div><Label>Internal admin note</Label><Textarea value={form.adminNote} onChange={(e) => setForm({ ...form, adminNote: e.target.value })} className="mt-1.5" /></div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={submitAdjust} disabled={saving}>{saving ? "Processing..." : "Confirm"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}