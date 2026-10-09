import React, { useEffect, useState } from "react";
import { Calendar, FileText, TrendingUp, Activity, Award, Loader2, Eye } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/perk/PageHeader";
import EmptyState from "@/components/perk/EmptyState";
import StatCard from "@/components/perk/StatCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

function getData(data, key) {
  if (!data) return null;
  return data[key] || data.data || data;
}

function getArray(data, key) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  const v = data[key] || data.items || data.data;
  return Array.isArray(v) ? v : [];
}

export default function WeeklyReports() {
  const [preview, setPreview] = useState(null);
  const [archives, setArchives] = useState([]);
  const [activeArchive, setActiveArchive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingArchive, setLoadingArchive] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, aRes] = await Promise.all([
        base44.functions.invoke("perkSphereReports", { action: "preview" }),
        base44.functions.invoke("perkSphereReports", { action: "archives", filters: {} })
      ]);
      const pData = pRes?.data || pRes;
      const aData = aRes?.data || aRes;
      if (pData?.ok === false) throw new Error(pData.error);
      setPreview(getData(pData, "preview") || pData);
      setArchives(getArray(aData, "archives"));
    } catch (e) {
      const errData = e?.response?.data || {};
      setError(errData.error || e.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const viewArchive = async (archive) => {
    setActiveArchive(null);
    setLoadingArchive(true);
    try {
      const res = await base44.functions.invoke("perkSphereReports", { action: "detail", archiveId: archive.id });
      const data = res?.data || res;
      if (data?.ok === false) throw new Error(data.error);
      setActiveArchive(getData(data, "archive") || data);
    } catch (e) {
      const errData = e?.response?.data || {};
      setError(errData.error || e.message);
    } finally {
      setLoadingArchive(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  const pv = preview || {};
  const stats = pv.stats || pv.summary || {};
  const activitiesByType = stats.activities_by_type || pv.activities_by_type || [];
  const activitiesByClass = stats.activities_by_classification || pv.activities_by_classification || [];

  return (
    <div>
      <PageHeader title="Weekly Reports" description="Your activity summary using Monday-to-Sunday UTC weeks" />

      {error && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Reports temporarily unavailable</p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={load}>Retry</Button>
        </div>
      )}

      {!error && (
        <>
          {/* Current week preview */}
          <div className="mt-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Calendar className="h-4 w-4" /> Current Week
              {pv.week_start && <span className="text-xs font-normal text-muted-foreground">{new Date(pv.week_start).toLocaleDateString("en-GB")} - {pv.week_end ? new Date(pv.week_end).toLocaleDateString("en-GB") : ""}</span>}
            </h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total Activities" value={stats.total_activities ?? pv.total_activities ?? 0} icon={Activity} />
              <StatCard label="Verified" value={stats.verified ?? pv.verified ?? 0} icon={TrendingUp} accent="text-emerald-600" />
              <StatCard label="Pending" value={stats.pending ?? pv.pending ?? 0} icon={Calendar} accent="text-amber-600" />
              <StatCard label="Rejected" value={stats.rejected ?? pv.rejected ?? 0} icon={Activity} accent="text-red-600" />
            </div>
          </div>

          {/* Classification breakdown */}
          {activitiesByClass.length > 0 && (
            <Card className="mt-4 p-5">
              <h4 className="text-sm font-semibold">Activity by Classification</h4>
              <div className="mt-3 space-y-2">
                {activitiesByClass.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{c.classification || c.type || "Unknown"}</span>
                    <span className="font-medium">{c.count ?? c.value ?? 0}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Activity by type */}
          {activitiesByType.length > 0 && (
            <Card className="mt-4 p-5">
              <h4 className="text-sm font-semibold">Activity by Type</h4>
              <div className="mt-3 space-y-2">
                {activitiesByType.map((t, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{t.type || t.activity_type || "Unknown"}</span>
                    <span className="font-medium">{t.count ?? t.value ?? 0}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Reward requests */}
          <Card className="mt-4 p-5">
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              <Award className="h-4 w-4" /> Reward Requests
            </h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="mt-1 text-lg font-semibold">{stats.reward_requests_pending ?? 0}</p>
              </div>
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-xs text-muted-foreground">Approved (not yet paid)</p>
                <p className="mt-1 text-lg font-semibold">{stats.reward_requests_approved ?? 0}</p>
              </div>
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-xs text-muted-foreground">Ledger Confirmed</p>
                <p className="mt-1 text-lg font-semibold">{stats.reward_requests_confirmed ?? 0}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Approved requests are not confirmed payouts until the ledger has been reconciled.
            </p>
          </Card>

          {/* Historical archives */}
          <div className="mt-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4" /> Historical Reports
            </h3>
            {loadingArchive ? (
              <div className="mt-4 flex h-20 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : activeArchive ? (
              <Card className="mt-4 p-5">
                <Button variant="ghost" size="sm" className="mb-3" onClick={() => setActiveArchive(null)}>
                  ← Back to archives
                </Button>
                <h4 className="text-sm font-semibold">{activeArchive.week_start ? new Date(activeArchive.week_start).toLocaleDateString("en-GB") : "Archive"} {activeArchive.superseded && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">Superseded</span>}</h4>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-secondary/50 p-3 text-xs">{JSON.stringify(activeArchive, null, 2)}</pre>
              </Card>
            ) : archives.length === 0 ? (
              <EmptyState title="No archived reports" description="Historical weekly reports will appear here once archives are created." />
            ) : (
              <div className="mt-4 space-y-3">
                {archives.map((a) => (
                  <Card key={a.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium">
                        {a.week_start ? new Date(a.week_start).toLocaleDateString("en-GB") : "Report"}
                        {a.week_end && <span className="text-muted-foreground"> - {new Date(a.week_end).toLocaleDateString("en-GB")}</span>}
                      </p>
                      {a.superseded && <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">Superseded</span>}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => viewArchive(a)}>
                      <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}