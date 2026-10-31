import { useMemberWallet, formatWalletInteger, rankXp } from "@/hooks/useMemberWallet";
import React, { useEffect, useState } from "react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { memberTaskState } from "@/lib/member-task-state";
import { Link } from "react-router-dom";
import { Coins, TrendingUp, Flame, Gift, Award, ArrowRight, Shield, BookOpen, HelpCircle, BarChart3, ClipboardCheck } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { usePublicDestinations } from "@/hooks/usePublicDestinations";
import PageHeader from "@/components/perk/PageHeader";
import DailyCheckIn from '@/components/perk/DailyCheckIn';
import StatCard from "@/components/perk/StatCard";
import ProgressBar from "@/components/perk/ProgressBar";
import RankBadge from "@/components/perk/RankBadge";
import StatusBadge from "@/components/perk/StatusBadge";
import EmptyState from "@/components/perk/EmptyState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import DestinationCard from "@/components/public/DestinationCard";
import TaskCard from "@/components/perk/TaskCard";
import PullToRefresh from "@/components/perk/PullToRefresh";
import VerifiedStreakBonuses from "@/components/perk/VerifiedStreakBonuses";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export default function Dashboard() {
  const { user } = useAuth();
  const {levels,activities,rewards,achievements,tasks,taskProgress,loading,sectionErrors,loadData}=useDashboardData(user?.id);
  const { wallet, error: walletError, loading: walletLoading, refresh: refreshWallet } = useMemberWallet();
  const txns = wallet?.points?.slice(0, 6) || [];
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setClock(new Date()), 30000); return () => clearInterval(timer); }, []);
  const { destinations } = usePublicDestinations();

  const allowedDestinations = destinations.filter((d) => d.eligibility === "allowed").slice(0, 6);
  const disallowedDestinations = destinations.filter((d) => d.eligibility === "disallowed").slice(0, 6);

  const xp = rankXp(wallet?.loyalty_xp);
  const points = wallet?.points_balance;
  const activeLevels = levels.filter((l) => l.active !== false).sort((a, b) => (a.minimum_xp || 0) - (b.minimum_xp || 0));
  const currentLevel = [...activeLevels].reverse().find((l) => xp >= (l.minimum_xp || 0));
  const nextLevel = activeLevels.find((l) => (l.minimum_xp || 0) > xp);
  const rank = wallet ? (wallet.source === "legacy" ? user?.loyalty_rank || currentLevel?.name || "Bronze" : currentLevel?.name || "Bronze") : "Unavailable";
  const progressMax = nextLevel ? nextLevel.minimum_xp : (currentLevel?.minimum_xp || 0);
  const progressBase = currentLevel?.minimum_xp || 0;
  const xpToNext = nextLevel ? nextLevel.minimum_xp - xp : 0;

  const today = startOfDay(clock).toISOString();
  const todayPoints = txns.filter((t) => new Date(t.created_date) >= new Date(today) && t.amount > 0).reduce((sum, t) => sum + BigInt(t.amount), 0n).toString();

  if (loading || walletLoading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  return (
    <PullToRefresh onRefresh={() => Promise.all([loadData(), refreshWallet()])}>
      <div>
        <PageHeader title={`Welcome back, ${user?.display_name || user?.username || user?.email?.split("@")[0] || "Member"}`} description="Your Perk Sphere rewards overview" />

        {walletError && <div role="alert" className="mb-4 rounded-xl border p-4">{walletError} <button type="button" className="underline" onClick={refreshWallet}>Retry</button></div>}
        <DailyCheckIn key={`daily-check-in:${user?.id || "signed-out"}`} userId={user?.id} refreshWallet={refreshWallet} now={clock} />
        <VerifiedStreakBonuses key={`verified-streak:${user?.id || "signed-out"}`} userId={user?.id} tasks={tasks} refreshWallet={refreshWallet} />
        {sectionErrors.length > 0 && <p role="status" className="mb-4 rounded-xl border p-4">Some dashboard sections are temporarily unavailable. <button type="button" className="underline" onClick={loadData}>Retry</button></p>}
        {/* Admin access */}
        {user?.role === "admin" && (
          <Link to="/admin" className="mt-4 flex items-center justify-between rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 p-4 shadow-sm transition-shadow hover:shadow-md dark:border-indigo-900 dark:from-indigo-950/30 dark:to-violet-950/30">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-indigo-600 p-2 text-white">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">Admin Panel</p>
                <p className="text-xs text-indigo-600/80 dark:text-indigo-400/80">Manage users, rewards, destinations, tasks and more</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </Link>
        )}

        {/* Hero balances */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-background p-6 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-indigo-700 dark:text-indigo-400">
              <Coins className="h-4 w-4" /> Points Balance
            </div>
            <p className="mt-3 text-4xl font-bold tracking-tight text-indigo-900 dark:text-indigo-300">{formatWalletInteger(points)}</p>
            <p className="mt-1 text-xs text-indigo-600/70">Redeemable for rewards</p>
          </div>
          <div className="rounded-2xl border border-border bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-background p-6 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
              <TrendingUp className="h-4 w-4" /> Loyalty XP
            </div>
            <p className="mt-3 text-4xl font-bold tracking-tight text-amber-900 dark:text-amber-300">{formatWalletInteger(wallet?.loyalty_xp)} XP</p>
            <p className="mt-1 text-xs text-amber-600/70">Builds your rank; conversion is available only when enabled</p>
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
              {wallet ? (nextLevel ? `${xpToNext.toLocaleString()} XP until ${nextLevel.name}` : "Highest rank achieved") : "Balance unavailable"}
            </p>
          </div>
        </div>

        {/* Rank progress */}
        {wallet && <div className="mt-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{rank}</span>
            <span className="text-muted-foreground">{nextLevel ? `${xp.toLocaleString()} / ${progressMax.toLocaleString()} XP` : "Max rank"}</span>
          </div>
          <ProgressBar value={nextLevel ? xp - progressBase : 1} max={nextLevel ? progressMax - progressBase : 1} className="mt-3" />
          {nextLevel && <p className="mt-2 text-xs text-muted-foreground">{xpToNext.toLocaleString()} XP until {nextLevel.name}</p>}
        </div>

        }
        {/* Quick stats */}
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <StatCard label="Recent Points Today (UTC)" value={wallet ? `+${todayPoints}` : "Unavailable"} icon={Coins} />
          <StatCard label="Current Streak" value={`${user?.streak_current || 0} days`} icon={Flame} accent="text-orange-600" />
          <StatCard label="Longest Streak" value={`${user?.streak_longest || 0} days`} icon={Flame} />
        </div>

        {/* Quick links to new features */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link to="/directory" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Directory</p>
              <p className="text-xs text-muted-foreground">Websites, X & YouTube</p>
            </div>
          </Link>
          <Link to="/quizzes" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Video Quizzes</p>
              <p className="text-xs text-muted-foreground">Answer video quizzes</p>
            </div>
          </Link>
          <Link to="/weekly-reports" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Weekly Reports</p>
              <p className="text-xs text-muted-foreground">Activity summaries</p>
            </div>
          </Link>
          <Link to="/reward-review" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Reward Requests</p>
              <p className="text-xs text-muted-foreground">Track your status</p>
            </div>
          </Link>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {/* Recent points transactions */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Recent Points Transactions</h3>
              <Link to="/points-history" className="text-xs text-indigo-600 hover:underline">View all</Link>
            </div>
            {walletError ? <p role="status">History unavailable</p> : txns.length === 0 ? (
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

        {/* Your Tasks */}
        {tasks.length > 0 && (
          <div className="mt-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Your Tasks</h3>
              <Link to="/tasks" className="flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400">
                View All Tasks <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {(() => {
              const states = Object.fromEntries(tasks.map(t => [t.id, memberTaskState(t, taskProgress, clock)]));
              const pmap = Object.fromEntries(tasks.map(t => [t.id, states[t.id].progress]));
              const inProg = tasks.filter(t => states[t.id].status === "in_progress");
              const avail = tasks.filter(t => states[t.id].status === "available");
              const nearlyDone = inProg.filter((t) => (pmap[t.id]?.progress_percentage || 0) >= 75);
              const shown = [...nearlyDone, ...inProg.filter((t) => (pmap[t.id]?.progress_percentage || 0) < 75), ...avail].slice(0, 3);
              return shown.length === 0 ? <EmptyState title="No tasks available" /> : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {shown.map((t) => <TaskCard key={t.id} task={t} progress={pmap[t.id]} isAuthed />)}
                </div>
              );
            })()}
          </div>
        )}

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