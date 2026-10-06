import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  UserPlus, ArrowRight, Coins, TrendingUp, Gift, Award,
  Globe, ShieldCheck, Sparkles
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { usePublicDestinations } from "@/hooks/usePublicDestinations";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import DestinationCard from "@/components/public/DestinationCard";
import TaskCard from "@/components/perk/TaskCard";
import EmptyState from "@/components/perk/EmptyState";

const STEPS = [
  { icon: UserPlus, title: "Create your account", body: "Sign up for free and set up your Perk Sphere profile in seconds." },
  { icon: Globe, title: "Participate in eligible activities", body: "Connect a Perk Sphere client and take part in activities on participating destinations." },
  { icon: Coins, title: "Earn Points & build Loyalty XP", body: "Eligible activities add Points to your redeemable balance and Loyalty XP to your rank progress." },
  { icon: Gift, title: "Redeem available rewards", body: "Spend your Points on available rewards from the Perk Sphere store." }
];

export default function Home() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [rewards, setRewards] = useState([]);
  const [levels, setLevels] = useState([]);
  const [featuredTasks, setFeaturedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const { destinations } = usePublicDestinations();

  useEffect(() => {
    (async () => {
      try {
        const [r, l, ft] = await Promise.all([
          base44.entities.Reward.list('-created_date', 8),
          base44.entities.LoyaltyLevel.list('display_order', 50),
          base44.entities.Task.list('-created_date', 8)
        ]);
        setRewards((r || []).filter((x) => x.active !== false));
        setLevels((l || []).filter((x) => x.active !== false).sort((a, b) => (a.minimum_xp || 0) - (b.minimum_xp || 0)));
        setFeaturedTasks((ft || []).filter((x) => x.active !== false && !x.archived && x.publicly_visible !== false && x.featured));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const allowed = destinations.filter((d) => d.eligibility === "allowed").slice(0, 6);
  const disallowed = destinations.filter((d) => d.eligibility === "disallowed").slice(0, 6);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-indigo-50 via-background to-background dark:from-indigo-950/30 dark:via-background dark:to-background">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
              Rewards, loyalty & destinations — in one place
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Your activity. Your loyalty. Your rewards.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Perk Sphere brings rewards, loyalty and participating online destinations together in one place. Earn points from eligible activities, build Loyalty XP, unlock ranks and achievements, and redeem your points for available rewards.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" onClick={() => navigate(isAuthenticated ? "/dashboard" : "/register")} className="w-full sm:w-auto">
                {isAuthenticated ? "Go to Dashboard" : "Join Perk Sphere"}
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/login")} className="w-full sm:w-auto">
                Sign In
              </Button>
            </div>
            <div className="mt-4">
              <Link to="/destinations" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                Explore Participating Sites <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight">How It Works</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Four simple steps. Eligibility and rewards depend on the configured activity — not every activity earns points.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="relative rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="absolute right-5 top-5 text-3xl font-bold text-secondary-foreground/40">{i + 1}</div>
                <h3 className="mt-4 text-base font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Points & XP */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:px-6 sm:py-20 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-gradient-to-br from-indigo-50 to-background p-8 dark:from-indigo-950/20 dark:to-background">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400">
              <Coins className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-2xl font-bold">Points</h3>
            <p className="mt-2 text-muted-foreground">
              Perk Sphere Points are your redeemable balance. Earn them from eligible activities and spend them on available rewards in the Perk Sphere store. Points are separate from Loyalty XP.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-gradient-to-br from-amber-50 to-background p-8 dark:from-amber-950/20 dark:to-background">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
              <TrendingUp className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-2xl font-bold">Loyalty XP</h3>
            <p className="mt-2 text-muted-foreground">
              Loyalty XP is separate from Points. It determines your loyalty progress, ranks and achievements — and is not itself redeemable currency. The more XP you build, the higher you climb.
            </p>
          </div>
        </div>
      </section>

      {/* Rewards preview */}
      <section id="rewards" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Rewards</h2>
            <p className="mt-2 text-muted-foreground">A preview of currently available rewards.</p>
          </div>
          {isAuthenticated && (
            <Link to="/rewards" className="hidden text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400 sm:inline">Browse store</Link>
          )}
        </div>
        <div className="mt-8">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl border border-border bg-secondary/40" />)}
            </div>
          ) : rewards.length === 0 ? (
            <EmptyState title="No rewards available yet" description="Check back soon for new rewards added to the Perk Sphere store." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {rewards.map((r) => (
                <div key={r.id} className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="mb-3 flex h-24 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                    <Gift className="h-8 w-8" />
                  </div>
                  <p className="text-sm font-semibold">{r.name}</p>
                  {r.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.description}</p>}
                  <p className="mt-3 text-sm font-semibold text-indigo-600 dark:text-indigo-400">{r.points_cost} pts</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Featured Tasks */}
      {featuredTasks.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Featured Tasks</h2>
              <p className="mt-2 text-muted-foreground">Complete tasks to earn Points, Loyalty XP and achievements.</p>
            </div>
            <Link to="/tasks" className="hidden text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400 sm:inline">View Tasks</Link>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredTasks.map((t) => (
              <TaskCard key={t.id} task={t} isAuthed={isAuthenticated} onSignIn={() => navigate("/login")} />
            ))}
          </div>
          <div className="mt-6 text-center sm:hidden">
            <Link to="/tasks"><Button variant="outline" size="sm">View Tasks</Button></Link>
          </div>
        </section>
      )}

      {/* Loyalty Levels */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">Loyalty Levels</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Climb through loyalty ranks as you build Loyalty XP. Levels are managed by administrators and may change.
            </p>
          </div>
          <div className="mt-10">
            {loading ? (
              <div className="flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>
            ) : levels.length === 0 ? (
              <EmptyState title="No loyalty levels configured" description="Levels will appear here once an administrator adds them." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {levels.map((l, i) => (
                  <div key={l.id} className="rounded-2xl border border-border bg-background p-6 text-center shadow-sm">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white">
                      <Award className="h-7 w-7" />
                    </div>
                    <p className="mt-3 text-base font-semibold">{l.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{(l.minimum_xp || 0).toLocaleString()} XP</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Destinations preview */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Participating Destinations</h2>
            <p className="mt-2 text-muted-foreground">A preview of destinations classified across Perk Sphere.</p>
          </div>
          <Link to="/destinations" className="hidden text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400 sm:inline">View All</Link>
        </div>
        <div className="mt-8">
          {destinations.length === 0 ? (
            <EmptyState title="No destinations yet" description="Destinations will appear here once administrators add them." />
          ) : (
            <Tabs defaultValue="allowed">
              <TabsList>
                <TabsTrigger value="allowed">Allowed</TabsTrigger>
                <TabsTrigger value="disallowed">Disallowed</TabsTrigger>
              </TabsList>
              <TabsContent value="allowed" className="mt-6">
                {allowed.length === 0 ? (
                  <EmptyState title="No allowed destinations" description="Allowed destinations will appear here once added." />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {allowed.map((d) => <DestinationCard key={d.id} destination={d} />)}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="disallowed" className="mt-6">
                {disallowed.length === 0 ? (
                  <EmptyState title="No disallowed destinations" description="There are no disallowed destinations configured." />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {disallowed.map((d) => <DestinationCard key={d.id} destination={d} />)}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
        <div className="mt-6 text-center sm:hidden">
          <Link to="/destinations"><Button variant="outline" size="sm">View All Destinations</Button></Link>
        </div>
      </section>

      {/* Privacy note */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-start gap-3 px-4 py-10 sm:px-6">
          <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm text-muted-foreground">
            Activity tracking requires a Perk Sphere client (such as the browser extension or mobile app) and your explicit consent. Perk Sphere does not silently monitor your browsing. Tracking integrations are added only when you connect them.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready to enter the Sphere?</h2>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">Create your free account and start building your loyalty today.</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" onClick={() => navigate(isAuthenticated ? "/dashboard" : "/register")} className="w-full sm:w-auto">
            {isAuthenticated ? "Go to Dashboard" : "Create Account"}
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate("/login")} className="w-full sm:w-auto">
            Sign In
          </Button>
        </div>
      </section>
    </div>
  );
}