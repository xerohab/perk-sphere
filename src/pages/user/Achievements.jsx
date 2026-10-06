import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Award } from "lucide-react";
import PageHeader from "@/components/perk/PageHeader";
import EmptyState from "@/components/perk/EmptyState";

export default function Achievements() {
  const [all, setAll] = useState([]);
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [a, m] = await Promise.all([
          base44.entities.Achievement.list('display_order', 100),
          base44.entities.UserAchievement.list('-created_date', 100)
        ]);
        setAll((a || []).filter((x) => x.active !== false));
        setMine(m || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  const mineIds = new Set(mine.map((m) => m.achievement_id));

  return (
    <div>
      <PageHeader title="Achievements" description={`${mine.length} of ${all.length} unlocked`} />
      {all.length === 0 ? (
        <EmptyState title="No achievements yet" description="Achievements will appear here once configured." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {all.map((a) => {
            const unlocked = mineIds.has(a.id);
            const hidden = a.hidden && !unlocked;
            return (
              <div key={a.id} className={`rounded-2xl border p-5 text-center shadow-sm ${unlocked ? "border-amber-200 bg-amber-50" : "border-border bg-card"}`}>
                <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${unlocked ? "bg-amber-200 text-amber-700" : "bg-secondary text-muted-foreground"}`}>
                  {hidden ? <span className="text-lg">?</span> : <Award className="h-7 w-7" />}
                </div>
                <p className="mt-3 text-sm font-semibold">{hidden ? "Hidden achievement" : a.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{hidden ? "Keep participating to unlock" : a.description}</p>
                {unlocked && <span className="mt-2 inline-block rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-semibold text-white">Unlocked</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}