import React, { useEffect, useRef, useState } from "react";
import { useMemberWallet, formatWalletInteger } from "@/hooks/useMemberWallet";
import { rewardEligibility } from "../../../base44/shared/rewardPolicy.ts";
import { Gift, Lock, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/perk/PageHeader";
import RankBadge from "@/components/perk/RankBadge";
import EmptyState from "@/components/perk/EmptyState";
import PullToRefresh from "@/components/perk/PullToRefresh";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose
} from "@/components/ui/dialog";

export default function Rewards() {
  const { user, checkUserAuth } = useAuth();
  const { toast } = useToast();
  const { wallet, error: walletError, loading: walletLoading, refresh: refreshWallet } = useMemberWallet();
  // The current redemption handler supports the legacy wallet only.
  const redemptionAvailable = wallet?.source === "legacy" && !walletError && !walletLoading;
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [redeeming, setRedeeming] = useState(false);
  const [optimisticPoints, setOptimisticPoints] = useState(null);
  const [redeemingIds, setRedeemingIds] = useState(new Set());
  const redeemLock = useRef(false);
  const [error, setError] = useState(null);

  const load = async (silent) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const r = await base44.entities.Reward.list('-created_date', 100);
      setRewards((r || []).filter((x) => x.active !== false));
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Unable to load rewards.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRedeem = async () => {
    if (!selected || redeemLock.current || !redemptionAvailable) return;
    const reward = selected;
    const eligibility = rewardEligibility({ ...user, points_balance: Number(wallet.points_balance) }, reward);
    if (!eligibility.ok) {
      toast({ title: 'Redemption unavailable', description: eligibility.reason, variant: 'destructive' });
      return;
    }
    redeemLock.current = true;
    const cost = reward.points_cost;
    const currentBalance = Number(wallet.points_balance);
    setOptimisticPoints(currentBalance - cost);
    setRedeemingIds((prev) => new Set(prev).add(reward.id));
    setRedeeming(true);
    try {
      const response = await base44.functions.invoke("redeemReward", { rewardId: reward.id });
      if (response?.data?.ok === false) throw new Error(response.data.error || 'Redemption failed.');
      // Refresh the authoritative balance before clearing the optimistic value
      // so the displayed number never flickers back to the stale balance.
      await Promise.all([checkUserAuth?.(), load(true), refreshWallet()]);
      toast({ title: "Reward redeemed!", description: `${reward.name} has been redeemed for ${cost} points.` });
      setSelected(null);
    } catch (e) {
      toast({ title: "Redemption failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setOptimisticPoints(null);
      setRedeemingIds((prev) => { const n = new Set(prev); n.delete(reward.id); return n; });
      setRedeeming(false);
      redeemLock.current = false;
    }
  };

  const displayPoints = optimisticPoints !== null ? optimisticPoints : wallet?.points_balance;

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  return (
    <PullToRefresh onRefresh={() => Promise.all([load(true), refreshWallet()])}>
      <div>
        <PageHeader title="Rewards Store" description={wallet ? `Your balance: ${formatWalletInteger(displayPoints)} points` : "Your balance is temporarily unavailable"} />
        {walletError && <div role="alert" className="mb-4 rounded-lg border p-4">{walletError} <Button variant="outline" onClick={refreshWallet}>Retry balance</Button></div>}
        {wallet?.source === "linux" && <p role="status" className="mb-4 rounded-lg border p-4">Your points are safe. Reward redemption is temporarily unavailable.</p>}
        {error && <div role="alert" className="mb-4 rounded-lg border border-destructive p-4"><p>{error}</p><Button variant="outline" onClick={() => load()}>Retry</Button></div>}
        {rewards.length === 0 ? (
          <EmptyState title="No rewards available" description="New rewards will appear here when published by administrators." />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rewards.map((r) => {
              const eligibility = redemptionAvailable ? rewardEligibility({ ...user, points_balance: Number(displayPoints) }, r) : { ok: false, reason: walletLoading ? "Loading balance" : "Redemption unavailable" };
              const isRedeeming = redeemingIds.has(r.id);
              return (
                <div key={r.id} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                  <div className="flex h-36 items-center justify-center bg-gradient-to-br from-secondary to-secondary/40">
                    <Gift className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="text-base font-semibold">{r.name}</h3>
                    {r.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{r.description}</p>}
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{Number.isSafeInteger(r.points_cost) ? r.points_cost.toLocaleString() : 'Unavailable'} pts</span>
                      {r.required_rank && <RankBadge rank={r.required_rank} className="!text-xs" />}
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      {!r.unlimited_stock && <span>{r.stock_available || 0} in stock</span>}
                      {r.manual_approval_required && <span>· Approval required</span>}
                    </div>
                    <div className="mt-4">
                      <Button className="w-full" disabled={!eligibility.ok || redeeming || isRedeeming} onClick={() => setSelected(r)}>
                        {isRedeeming ? "Processing..." : !eligibility.ok ? eligibility.reason === 'Rank required' ? <span className="flex items-center gap-1"><Lock className="h-3.5 w-3.5" /> Rank required</span> : eligibility.reason : "Redeem"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Dialog open={!!selected} onOpenChange={(o) => !o && !redeemLock.current && setSelected(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Redeem {selected?.name}?</DialogTitle>
              <DialogDescription>This will deduct {selected?.points_cost?.toLocaleString()} points from your balance. This action cannot be undone.</DialogDescription>
            </DialogHeader>
            {selected?.terms && <p className="rounded-lg bg-secondary p-3 text-xs text-muted-foreground">{selected.terms}</p>}
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" disabled={redeeming}>Cancel</Button></DialogClose>
              <Button onClick={handleRedeem} disabled={redeeming || !redemptionAvailable}>{redeeming ? "Processing..." : <><Check className="mr-1 h-4 w-4" /> Confirm Redemption</>}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PullToRefresh>
  );
}
