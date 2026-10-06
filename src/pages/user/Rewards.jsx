import React, { useEffect, useState } from "react";
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
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [redeeming, setRedeeming] = useState(false);
  const [optimisticPoints, setOptimisticPoints] = useState(null);
  const [redeemingIds, setRedeemingIds] = useState(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const r = await base44.entities.Reward.list('-created_date', 100);
      setRewards((r || []).filter((x) => x.active !== false));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRedeem = async () => {
    if (!selected) return;
    const cost = selected.points_cost;
    // Optimistic: decrement displayed balance and mark reward as redeeming
    const currentBalance = user?.points_balance || 0;
    setOptimisticPoints(currentBalance - cost);
    setRedeemingIds((prev) => new Set(prev).add(selected.id));
    setRedeeming(true);
    try {
      await base44.functions.invoke("redeemReward", { rewardId: selected.id });
      toast({
        title: "Reward redeemed!",
        description: `${selected.name} has been redeemed for ${cost} points.`
      });
      setSelected(null);
      setRedeemingIds((prev) => { const n = new Set(prev); n.delete(selected.id); return n; });
      setOptimisticPoints(null);
      // refresh balance via auth and reload rewards
      await Promise.all([checkUserAuth?.(), load()]);
    } catch (e) {
      // Revert optimistic updates
      setOptimisticPoints(null);
      setRedeemingIds((prev) => { const n = new Set(prev); n.delete(selected.id); return n; });
      toast({ title: "Redemption failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setRedeeming(false);
    }
  };

  const displayPoints = optimisticPoints !== null ? optimisticPoints : (user?.points_balance || 0);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  return (
    <div>
      <PageHeader
        title="Rewards Store"
        description={`You have ${displayPoints.toLocaleString()} points to spend`}
      />
      {rewards.length === 0 ? (
        <EmptyState title="No rewards available" description="New rewards will appear here when published by administrators." />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rewards.map((r) => {
            const affordable = displayPoints >= r.points_cost;
            const rankOk = !r.required_rank || user?.loyalty_rank === r.required_rank;
            const inStock = r.unlimited_stock || (r.stock_available || 0) > 0;
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
                    <span className="text-lg font-bold text-indigo-600">{r.points_cost.toLocaleString()} pts</span>
                    {r.required_rank && <RankBadge rank={r.required_rank} className="!text-[10px]" />}
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    {!r.unlimited_stock && <span>{r.stock_available || 0} in stock</span>}
                    {r.manual_approval_required && <span>· Approval required</span>}
                  </div>
                  <div className="mt-4">
                    <Button
                      className="w-full"
                      disabled={!affordable || !rankOk || !inStock || isRedeeming}
                      onClick={() => setSelected(r)}
                    >
                      {isRedeeming ? "Processing..." : !affordable ? "Not enough points" : !rankOk ? <span className="flex items-center gap-1"><Lock className="h-3.5 w-3.5" /> Rank required</span> : !inStock ? "Out of stock" : "Redeem"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redeem {selected?.name}?</DialogTitle>
            <DialogDescription>
              This will deduct {selected?.points_cost?.toLocaleString()} points from your balance. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selected?.terms && (
            <p className="rounded-lg bg-secondary p-3 text-xs text-muted-foreground">{selected.terms}</p>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleRedeem} disabled={redeeming}>
              {redeeming ? "Processing..." : <><Check className="mr-1 h-4 w-4" /> Confirm Redemption</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}