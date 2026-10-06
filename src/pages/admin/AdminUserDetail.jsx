import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Coins, TrendingUp, Plus, Minus, ShieldBan, ShieldCheck, Flag } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import PageHeader from "@/components/perk/PageHeader";
import RankBadge from "@/components/perk/RankBadge";
import StatusBadge from "@/components/perk/StatusBadge";
import EmptyState from "@/components/perk/EmptyState";
import ConfirmDialog from "@/components/perk/ConfirmDialog";
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
  const [adjustOpen, setAdjustOpen] = useState(null); // {currency, direction}
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
      setPointsTxns((pt || []).sort((x, y) => new Date(y.created_date) - new Date(x.created_date)));
      setXpTxns((xt || []).sort((x, y) => new Date(y.created_date) - new Date(x.created_date)));
      setActivities((a || []).sort((x, y) => new Date(y.created_date) - new Date(x.created_date)));
      setRedemptions((r || []).sort((x, y) => new Date(y.created_date) - new Date(x.created_date)));
      setRestrictions((rs || []).sort((x, y) => new Date(y.created_date) - new Date(x.created_date)));
      setAudit((al || []).sort((x, y) => new Date(y.created_date) - new Date(x.created_date)));
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
      await base44.functions.invoke("adjustBalance", {
        userId: id, currency, amount: signed, reason: form.reason, adminNote: form.adminNote
      });
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
      await base44.entities.User.update(id, { account_status: status });
      await base44.entities.AuditLog.create({
        admin_id: user?.id, action: "user_status_change", entity_type: "User", entity_id: id,
        previous_values: { status: user?.account_status }, new_values: { status }
      });
      toast({ title: `Account ${status}` });
      load();
    } catch (e) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }
  if (!user) {
    return <EmptyState title="User not found" />;
  }

  const ActionButton = ({ currency, direction, label }) => (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setAdjustOpen({ currency, direction })}
      className={direction === "deduct" ? "text-red-600" : "text-emerald-600"}
    >
      {direction === "deduct" ? <Minus className="mr-1 h-3.5 w-3.5" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
      {label}
    </Button>
  );

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin/users")} className="mb-4">
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to users
      </Button>

      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-lg font-bold text-white">
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
              <ConfirmDialog trigger={<Button variant="outline" size="sm" className="text-orange-600"><ShieldBan className="mr-1 h-3.5 w-3.5" /> Suspend</Button>}
                title="Suspend this account?" description="The user will be unable to log in or earn rewards." confirmLabel="Suspend" destructive onConfirm={() => setStatus("suspended")} />
            )}
            {user.account_status !== "banned" && (
              <ConfirmDialog trigger={<Button variant="outline" size="sm" className="text-red-600"><ShieldBan className="mr-1 h-3.5 w-3.5" /> Ban</Button>}
                title="Ban this account?" description="This is a severe action. The user will be permanently blocked." confirmLabel="Ban" destructive onConfirm={() => setStatus("banned")} />
            )}
            {user.account_status !== "active" && (
              <ConfirmDialog trigger={<Button variant="outline" size="sm" className="text-emerald-600"><ShieldCheck className="mr-1 h-3.5 w-3.5" /> Restore</Button>}
                title="Restore this account?" description="The account will return to active status." confirmLabel="Restore" onConfirm={() => setStatus("active")} />
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

      {/* Balance cards */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-indigo-700"><Coins className="h-4 w-4" /> Points</div>
          <p className="mt-2 text-3xl font-bold text-indigo-900">{(user.points_balance || 0).toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-amber-700"><TrendingUp className="h-4 w-4" /> Loyalty XP</div>
          <p className="mt-2 text-3xl font-bold text-amber-900">{(user.loyalty_xp || 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="mt-6">
        <TabsList className="flex w-full flex-wrap justify-start gap-1 overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="points">Points History</TabsTrigger>
          <TabsTrigger value="xp">XP History</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="social">Social</TabsTrigger>
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

        <TabsContent value="points" className="mt-4">
          {pointsTxns.length === 0 ? <EmptyState title="No points transactions" /> : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-2">Date</th><th className="px-4 py-2">Type</th><th className="px-4 py-2">Reason</th><th className="px-4 py-2 text-right">Amount</th><th className="px-4 py-2 text-right">Balance</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {pointsTxns.map((t) => (
                    <tr key={t.id}><td className="px-4 py-2 text-muted-foreground">{new Date(t.created_date).toLocaleString()}</td><td className="px-4 py-2 capitalize">{t.transaction_type?.replace(/_/g, " ")}</td><td className="px-4 py-2 text-muted-foreground">{t.reason || "—"}</td><td className={`px-4 py-2 text-right font-semibold ${t.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>{t.amount >= 0 ? "+" : ""}{t.amount}</td><td className="px-4 py-2 text-right text-muted-foreground">{t.balance_after}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="xp" className="mt-4">
          {xpTxns.length === 0 ? <EmptyState title="No XP transactions" /> : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-2">Date</th><th className="px-4 py-2">Reason</th><th className="px-4 py-2 text-right">XP</th><th className="px-4 py-2 text-right">After</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {xpTxns.map((t) => (
                    <tr key={t.id}><td className="px-4 py-2 text-muted-foreground">{new Date(t.created_date).toLocaleString()}</td><td className="px-4 py-2 text-muted-foreground">{t.reason || "—"}</td><td className={`px-4 py-2 text-right font-semibold ${t.xp_amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>{t.xp_amount >= 0 ? "+" : ""}{t.xp_amount}</td><td className="px-4 py-2 text-right text-muted-foreground">{t.xp_after}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          {activities.length === 0 ? <EmptyState title="No activity" /> : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-2">Platform</th><th className="px-4 py-2">Type</th><th className="px-4 py-2">Target</th><th className="px-4 py-2">Date</th><th className="px-4 py-2">Source</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {activities.map((a) => (
                    <tr key={a.id}><td className="px-4 py-2 capitalize">{a.platform}</td><td className="px-4 py-2 capitalize">{a.activity_type?.replace(/_/g, " ")}</td><td className="px-4 py-2 text-muted-foreground">{a.target_account || a.target || "—"}</td><td className="px-4 py-2 text-muted-foreground">{new Date(a.created_date).toLocaleString()}</td><td className="px-4 py-2"><StatusBadge status={a.verification_status} /></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="social" className="mt-4">
          <SocialAggregation activities={activities} />
        </TabsContent>

        <TabsContent value="redemptions" className="mt-4">
          {redemptions.length === 0 ? <EmptyState title="No redemptions" /> : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-2">Reward</th><th className="px-4 py-2 text-right">Points</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Date</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {redemptions.map((r) => (
                    <tr key={r.id}><td className="px-4 py-2 font-medium">{r.reward_name}</td><td className="px-4 py-2 text-right">{r.points_spent}</td><td className="px-4 py-2"><StatusBadge status={r.status} /></td><td className="px-4 py-2 text-muted-foreground">{new Date(r.created_date).toLocaleDateString()}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

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
                  <p className="mt-1 text-xs text-muted-foreground">{a.entity_type} · {a.entity_id}</p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Adjust dialog */}
      <Dialog open={!!adjustOpen} onOpenChange={(o) => !o && setAdjustOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{adjustOpen?.direction === "deduct" ? "Deduct" : "Add"} {adjustOpen?.currency === "points" ? "Points" : "XP"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1.5" />
            </div>
            <div>
              <Label>Reason (visible to user)</Label>
              <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="mt-1.5" />
            </div>
            <div>
              <Label>Internal admin note</Label>
              <Textarea value={form.adminNote} onChange={(e) => setForm({ ...form, adminNote: e.target.value })} className="mt-1.5" />
            </div>
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

function SocialAggregation({ activities }) {
  const social = activities.filter((a) => a.platform === "x" || a.platform === "youtube" || a.platform === "twitter");
  if (social.length === 0) return <EmptyState title="No social activity" />;
  const byAccount = {};
  social.forEach((a) => {
    const key = a.target_account || a.target || "Unknown";
    if (!byAccount[key]) byAccount[key] = {};
    const t = a.activity_type || "other";
    byAccount[key][t] = (byAccount[key][t] || 0) + 1;
  });
  return (
    <div className="space-y-3">
      {Object.entries(byAccount).map(([account, counts]) => (
        <div key={account} className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">{account}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {Object.entries(counts).map(([type, n]) => (
              <span key={type} className="rounded-full bg-secondary px-2.5 py-1 capitalize">{type.replace(/_/g, " ")}: {n}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}