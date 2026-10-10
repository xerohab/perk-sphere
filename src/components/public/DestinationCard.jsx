import React from "react";
import { Link } from "react-router-dom";
import { Globe, Youtube, Twitter, ExternalLink, Coins, TrendingUp } from "lucide-react";
import EligibilityBadge from "@/components/perk/EligibilityBadge";

const PLATFORM_ICON = {
  Website: Globe,
  YouTube: Youtube,
  X: Twitter
};

export default function DestinationCard({ destination, to = "" }) {
  const d = destination;
  const Icon = PLATFORM_ICON[d.platform] || Globe;
  const linkTo = to || `/destinations/${d.id}`;

  return (
    <Link
      to={linkTo}
      className="group flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-secondary">
          {d.logo ? (
            <img src={d.logo} alt="" className="h-full w-full object-cover" />
          ) : (
            <Icon className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{d.name}</p>
          <p className="truncate text-xs text-muted-foreground">{d.handle ? `@${d.handle}` : d.domain || d.platform}</p>
        </div>
        <EligibilityBadge eligibility={d.eligibility} />
      </div>

      {d.description && (
        <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{d.description}</p>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
            <Icon className="h-3 w-3" /> {d.platform}
          </span>
          {(d.points_eligible || d.xp_eligible) && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              {d.points_eligible && <Coins className="h-3 w-3" />}
              {d.xp_eligible && <TrendingUp className="h-3 w-3" />}
            </span>
          )}
        </div>
        {d.url && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors group-hover:text-foreground">
            Visit <ExternalLink className="h-3 w-3" />
          </span>
        )}
      </div>
    </Link>
  );
}