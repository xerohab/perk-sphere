import React from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Globe, Youtube, Twitter, ExternalLink, Coins, TrendingUp, CheckCircle2, XCircle } from "lucide-react";
import { usePublicDestinations } from "@/hooks/usePublicDestinations";
import EligibilityBadge from "@/components/perk/EligibilityBadge";
import EmptyState from "@/components/perk/EmptyState";
import { Button } from "@/components/ui/button";

const PLATFORM_ICON = {
  Website: Globe,
  YouTube: Youtube,
  X: Twitter
};

export default function DestinationDetail() {
  const { id } = useParams();
  const { destinations, loading } = usePublicDestinations();
  const d = destinations.find((x) => x.id === id);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }
  if (!d) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <EmptyState title="Destination not found" description="This destination may not exist or is not publicly visible." />
        <div className="mt-4 text-center">
          <Link to="/destinations"><Button variant="outline">Back to Destinations</Button></Link>
        </div>
      </div>
    );
  }

  const Icon = PLATFORM_ICON[d.platform] || Globe;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link to="/destinations" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Destinations
      </Link>

      <div className="mt-6 rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-secondary">
            {d.logo ? <img src={d.logo} alt="" className="h-full w-full object-cover" /> : <Icon className="h-7 w-7 text-muted-foreground" />}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{d.name}</h1>
              <EligibilityBadge eligibility={d.eligibility} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Icon className="h-3.5 w-3.5" /> {d.platform}</span>
              {d.handle && <span className="ml-2">· @{d.handle}</span>}
              {d.domain && <span className="ml-2">· {d.domain}</span>}
            </p>
            {d.description && <p className="mt-4 text-sm text-muted-foreground">{d.description}</p>}
            {d.url && (
              <a href={d.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex">
                <Button variant="outline" size="sm">Visit destination <ExternalLink className="ml-1 h-3.5 w-3.5" /></Button>
              </a>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-3 border-t border-border pt-6 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Perk Sphere Activities</p>
            <div className="mt-2 flex items-center gap-2">
              {d.eligibility === "allowed" ? (
                <><CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /><span className="text-sm">Available for eligible activities</span></>
              ) : d.eligibility === "disallowed" ? (
                <><XCircle className="h-4 w-4 text-red-600 dark:text-red-400" /><span className="text-sm">Not eligible for activities</span></>
              ) : (
                <><span className="text-sm">Neutral — no specific eligibility set</span></>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reward Eligibility</p>
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Coins className="h-4 w-4" /> Points {d.points_eligible ? "eligible" : "not eligible"}</span>
              <span className="inline-flex items-center gap-1"><TrendingUp className="h-4 w-4" /> XP {d.xp_eligible ? "eligible" : "not eligible"}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Whether points or XP are awarded depends on the active rules configured by administrators.</p>
          </div>
        </div>
      </div>
    </div>
  );
}