import React, { useState, useMemo } from "react";
import { Search, Globe, Youtube, Twitter, HelpCircle } from "lucide-react";
import { usePublicDestinations } from "@/hooks/usePublicDestinations";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DestinationCard from "@/components/public/DestinationCard";
import EmptyState from "@/components/perk/EmptyState";

const PLATFORM_FILTERS = [
  { value: "all", label: "All Platforms", Icon: Globe },
  { value: "website", label: "Website", Icon: Globe },
  { value: "youtube", label: "YouTube", Icon: Youtube },
  { value: "x", label: "X", Icon: Twitter },
  { value: "other", label: "Other", Icon: HelpCircle }
];

function platformKey(d) {
  const p = (d.platform || "").toLowerCase();
  if (p === "youtube") return "youtube";
  if (p === "x") return "x";
  if (p === "website") return "website";
  return "other";
}

export default function Destinations() {
  const { destinations, loading } = usePublicDestinations();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");
  const [platform, setPlatform] = useState("all");

  const filtered = useMemo(() => {
    return destinations.filter((d) => {
      if (tab === "allowed" && d.eligibility !== "allowed") return false;
      if (tab === "disallowed" && d.eligibility !== "disallowed") return false;
      if (platform !== "all" && platformKey(d) !== platform) return false;
      if (q) {
        const term = q.toLowerCase();
        const hay = `${d.name} ${d.handle || ""} ${d.domain || ""} ${d.description || ""} ${d.platform}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [destinations, q, tab, platform]);

  return (
    <div>
      <section className="border-b border-border bg-gradient-to-b from-indigo-50 to-background dark:from-indigo-950/30 dark:to-background">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Destinations</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Browse the websites and social destinations classified across Perk Sphere. Allowed destinations may participate in eligible activities; disallowed destinations do not.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Controls */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="allowed">Allowed</TabsTrigger>
              <TabsTrigger value="disallowed">Disallowed</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search destinations..." className="pl-9" />
          </div>
        </div>

        {/* Platform filters */}
        <div className="mt-4 flex flex-wrap gap-2">
          {PLATFORM_FILTERS.map((f) => {
            const Icon = f.Icon;
            const active = platform === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setPlatform(f.value)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {f.label}
              </button>
            );
          })}
        </div>

        {/* Results */}
        <div className="mt-6">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl border border-border bg-secondary/40" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState title="No destinations found" description="Try a different search or filter. Destinations will appear here once administrators add them." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((d) => <DestinationCard key={d.id} destination={d} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}