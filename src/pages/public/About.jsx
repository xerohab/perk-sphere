import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Coins, TrendingUp, Gift, Globe, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

const VALUES = [
  { icon: Coins, title: "Transparent rewards", body: "Points and Loyalty XP are tracked through a clear ledger. You always know what you earned and why." },
  { icon: TrendingUp, title: "Meaningful loyalty", body: "Loyalty XP builds your rank and unlocks achievements — separate from your Points balance." },
  { icon: ShieldCheck, title: "Privacy by design", body: "Browser activity tracking requires a supported client and your explicit consent. Games and supported partner verification do not require an extension." },
  { icon: Globe, title: "Participating destinations", body: "A growing directory of websites and social destinations, each clearly classified as allowed, neutral or disallowed." }
];

export default function About() {
  return (
    <div>
      <section className="border-b border-border bg-gradient-to-b from-indigo-50 to-background dark:from-indigo-950/30 dark:to-background">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">About Perk Sphere</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Perk Sphere brings rewards, loyalty and participating online destinations together in one place. We believe loyalty should be transparent, consensual and rewarding.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-2">
          {VALUES.map((v) => {
            const Icon = v.icon;
            return (
              <div key={v.title} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold">{v.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{v.body}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">How we handle your data</h2>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Perk Sphere records eligible in-site activities and evidence from supported integrations. Partner tasks use your linked account and the partner’s verification. Browser tracking is separate, requires a supported client and your explicit consent, and does not make every page visit rewardable. External account connections are added only with your consent.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Some integrations are still being developed. Account connection alone does not verify views, likes, follows or comments. Store redemption, cash withdrawals, gift cards and XP conversion are currently unavailable.
          </p>
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-gradient-to-br from-indigo-50 to-background p-8 text-center dark:from-indigo-950/20 dark:to-background">
          <Gift className="mx-auto h-8 w-8 text-indigo-600 dark:text-indigo-400" />
          <h2 className="mt-3 text-xl font-semibold">Ready to start earning?</h2>
          <p className="mt-1 text-sm text-muted-foreground">Create your free Perk Sphere account today.</p>
          <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/register"><Button>Create Account</Button></Link>
            <Link to="/destinations"><Button variant="outline">Explore Destinations</Button></Link>
          </div>
        </div>
      </section>
    </div>
  );
}