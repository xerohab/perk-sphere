import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Coins, TrendingUp, Flame, Gift, Award, ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { usePublicDestinations } from "@/hooks/usePublicDestinations";
import PageHeader from "@/components/perk/PageHeader";
import StatCard from "@/components/perk/StatCard";
import ProgressBar from "@/components/perk/ProgressBar";
import RankBadge from "@/components/perk/RankBadge";
import StatusBadge from "@/components/perk/StatusBadge";
import EmptyState from "@/components/perk/EmptyState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import DestinationCard from "@/components/public/DestinationCard";
import PullToRefresh from "@/components/perk/PullToRefresh";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [levels, setLevels] = useState([]);
  const [txns, setTxns] = useState([]);
  const [activities, setActivities] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const { destinations } = usePublicDestinations();

  const allowedDestinations = destinations.filter((d) => d.eligibility === "allowed").slice(0, 6);
  const disallowedDestinations = destinations.filter((d) => d.eligibility === "disallowed").slice(0, 6);

  const loadData = async () => {
    setLoading(true);
    try {
      const [lv, t, a, r, ua] = await Promise.all([
        base44.entities.LoyaltyLevel.list('-minimum_xp', 50),
        base44.entities.PointsTransaction.list('-created_date', 6),
        base44.entities.Activity.list('-created_date', 6),
        base44.entities.Reward.list('-created_date', 4),
        base44.entities.UserAchievement.list('-created_date', 4)
      ]);
      setLevels(lv || []);
      setTxns(t || []);
      setActivities(a || []);
      setRewards((r || []).filter((x) => x.active !== false));
      setAchievements(ua || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const xp = user?.loyalty_xp || 0;
  const points = user?.points_balance || 0;
  const activeLevels = levels.filter((l) => l.active !== false).sort((a, b) => (a.minimum_xp || 0) - (b.minimum_xp || 0));
  const currentLevel = [...activeLevels].reverse().find((l) => xp >= (l.minimum_xp || 0));
  const nextLevel = activeLevels.find((l) => (l.minimum_xp || 0) > xp);
  const rank = user?.loyalty_rank || currentLevel?.name || "Bronze";
  const progressMax = nextLevel ? nextLevel.minimum_xp : (currentLevel?.minimum_xp || 0);
  const progressBase = currentLevel?.minimum_xp || 0;
  const xpToNext = nextLevel ? nextLevel.minimum_xp - xp : 0;

  const today = startOfDay().toISOString();
  const todayPoints = txns.filter((t) => new Date(t.created_date) >= new Date(today) && t.amount > 0).reduce((s, t) => s + t.amount, 0);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  return (
    <PullToRefresh onRefresh={loadData}>
      <div>
        <PageHeader title={`Welcome back, ${user?.display_name || user?.username || user?.email?.split("@")[0] || "Member"}`} description="Your Perk Sphere rewards overview" />

        {/* Hero balances */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-background p-6 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-indigo-700 dark:text-indigo-400">
              <Coins className="h-4 w-4" /> Points Balance
            </div>
            <p className="mt-3 text-4xl font-bold tracking-tight text-indigo-900 dark:text-indigo-300">{points.toLocaleString()}</p>
            <p className="mt-1 text-xs text-indigo-600/70">Redeemable for rewards</p>
          </div>
          <div className="rounded-2xl border border-border bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-background p-6 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
              <TrendingUp className="h-4 w-4" /> Loyalty XP
            </div>
            <p className="mt-3 text-4xl font-bold tracking-tight text-amber-900 dark:text-amber-300">{xp.toLocaleString()} XP</p>
            <p className="mt-1 text-xs text-amber-600/70">Not redeemable — builds your rank</p>
          </div>
          <div className="rounded-2xl border border-border bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/20 dark:to-background p-6 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-violet-700 dark:text-violet-400">
              <Award className="h-4 w-4" /> Current Rank
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-2xl font-bold tracking-tight text-violet-900 dark:text-violet-300">{rank}</span>
              <RankBadge rank={rank} />
            </div>
            <p className="mt-1 text-xs text-violet-600/70">
              {nextLevel ? `${xpToNext.toLocaleString()} XP until ${nextLevel.name}` : "Highest rank achieved"}
            </p>
          </div>
        </div>

        {/* Rank progress */}
        <div className="mt-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{rank}</span>
            <span className="text-muted-foreground">{nextLevel ? `${xp.toLocaleString()} / ${progressMax.toLocaleString()} XP` : "Max rank"}</span>
          </div>
          <ProgressBar value={nextLevel ? xp - progressBase : 1} max={nextLevel ? progressMax - progressBase : 1} className="mt-3" />
          {nextLevel && <p className="mt-2 text-xs text-muted-foreground">{xpToNext.toLocaleString()} XP until {nextLevel.name}</p>}
        </div>

        {/* Quick stats */}
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <StatCard label="Today's Points" value={`+${todayPoints}`} icon={Coins} />
          <StatCard label="Current Streak" value={`${user?.streak_current || 0} days`} icon={Flame} accent="text-orange-600" />
          <StatCard label="Longest Streak" value={`${user?.streak_longest || 0} days`} icon={Flame} />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {/* Recent points transactions */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Recent Points Transactions</h3>
              <Link to="/points-history" className="text-xs text-indigo-600 hover:underline">View all</Link>
            </div>
            {txns.length === 0 ? (
              <EmptyState title="No transactions yet" description="Points you earn or spend will appear here." />
            ) : (
              <ul className="space-y-3">
                {txns.map((t) => (
                  <li key={t.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium capitalize">{(t.reason || t.transaction_type || "").replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground">{new Date(t.created_date).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-sm font-semibold ${t.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {t.amount >= 0 ? "+" : ""}{t.amount}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Recent activity */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Recent Activity</h3>
              <Link to="/activity" className="text-xs text-indigo-600 hover:underline">View all</Link>
            </div>
            {activities.length === 0 ? (
              <EmptyState title="No activity yet" description="Activity from connected services will appear here." />
            ) : (
              <ul className="space-y-3">
                {activities.map((a) => (
                  <li key={a.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium capitalize">{a.platform} · {a.activity_type?.replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground">{a.target_account || a.target || new Date(a.created_date).toLocaleDateString()}</p>
                    </div>
                    <StatusBadge status={a.verification_status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Available rewards */}
        <div className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Available Rewards</h3>
            <Link to="/rewards" className="flex items-center gap-1 text-xs text-indigo-600 hover:underline">
              Browse store <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {rewards.length === 0 ? (
            <EmptyState title="No rewards available" description="Check back soon for new rewards." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {rewards.map((r) => (
                <Link key={r.id} to="/rewards" className="group rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
                  <div className="mb-3 flex h-24 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                    <Gift className="h-8 w-8" />
                  </div>
                  <p className="text-sm font-medium">{r.name}</p>
                  <p className="mt-1 text-sm font-semibold text-indigo-600">{r.points_cost} pts</p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Destinations */}
        <div className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Destinations</h3>
            <Link to="/destinations" className="flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400">
              View All Destinations <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <Tabs defaultValue="allowed">
            <TabsList>
              <TabsTrigger value="allowed">Allowed</TabsTrigger>
              <TabsTrigger value="disallowed">Disallowed</TabsTrigger>
            </TabsList>
            <TabsContent value="allowed" className="mt-4">
              {allowedDestinations.length === 0 ? (
                <EmptyState title="No allowed destinations" description="Allowed destinations will appear here once added." />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {allowedDestinations.map((d) => <DestinationCard key={d.id} destination={d} />)}
                </div>
              )}
            </TabsContent>
            <TabsContent value="disallowed" className="mt-4">
              {disallowedDestinations.length === 0 ? (
                <EmptyState title="No disallowed destinations" description="There are no disallowed destinations configured." />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {disallowedDestinations.map((d) => <DestinationCard key={d.id} destination={d} />)}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Achievements */}
        {achievements.length > 0 && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold">Recently Unlocked Achievements</h3>
            <div className="flex flex-wrap gap-3">
              {achievements.map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5">
                  <Award className="h-4 w-4 text-amber-600" />
                  <span className="text-xs font-medium">{a.achievement_name || "Achievement"}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}