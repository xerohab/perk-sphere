import React, { useEffect, useState } from "react";
import { Calendar, FileText, TrendingUp, Activity, Award, Loader2, Eye } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/perk/PageHeader";
import EmptyState from "@/components/perk/EmptyState";
import StatCard from "@/components/perk/StatCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { readWeeklyReport, readReportArchives, readReportArchive, summarizeWeeklyReport } from "@/lib/report-presentation";

export default function WeeklyReports() {
  const [preview, setPreview] = useState(null);
  const [summary, setSummary] = useState(() => summarizeWeeklyReport({activity:[],reward_requests:[]}));
  const [archives, setArchives] = useState([]);
  const [activeArchive, setActiveArchive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [archivesError, setArchivesError] = useState(null);
  const [loadingArchive, setLoadingArchive] = useState(false);

  // Loads the current-week preview (primary content). A failure here is a
  // hard error — the page cannot function without it.
  const loadPreview = async () => {
    try {
      const res = await base44.functions.invoke("perkSphereReports", { action: "preview" });
      const data = res?.data || res;
      if (data?.ok === false) throw new Error(data.error);
      // Linux returns { ok, report: { week_start, activity, reward_requests, ... } }
      const report = readWeeklyReport(data);
      const totals = summarizeWeeklyReport(report);
      setPreview(report);
      setSummary(totals);
      setError(null);
    } catch (e) {
      const errData = e?.response?.data || {};
      setError(errData.error || e.message || "Failed to load reports");
    }
  };

  // Loads historical archives (optional feature). A failure here must NOT
  // prevent the weekly preview from loading — archives require a separate
  // identity-verification gate that may be disabled.
  const loadArchives = async () => {
    setArchivesError(null);
    try {
      const res = await base44.functions.invoke("perkSphereReports", { action: "archives", filters: {} });
      const data = res?.data || res;
      if (data?.ok === false) throw new Error(data.error);
      setArchives(readReportArchives(data));
    } catch (e) {
      const errData = e?.response?.data || {};
      setArchivesError(errData.error || errData.code || e.message);
      setArchives([]);
    }
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    await loadPreview();
    setLoading(false);
    loadArchives();
  };

  useEffect(() => { load(); }, []);

  const viewArchive = async (archive) => {
    setActiveArchive(null);
    setLoadingArchive(true);
    try {
      const res = await base44.functions.invoke("perkSphereReports", { action: "detail", archiveId: archive.id });
      const data = res?.data || res;
      if (data?.ok === false) throw new Error(data.error);
      setActiveArchive(readReportArchive(data));
    } catch (e) {
      const errData = e?.response?.data || {};
      setArchivesError(errData.error || e.message);
    } finally {
      setLoadingArchive(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  const pv = preview || {};
  const {totalActivities,verified,pending,rejected,activitiesByType,activitiesByClass,rewardPending,rewardApproved,isEmptyWeek} = summary;

  return (
    <div>
      <PageHeader title="Weekly Reports" description="Your activity summary using Monday-to-Sunday UTC weeks" />
      <p className="mt-2 text-sm text-muted-foreground">This report may not include every reward. Your wallet history shows confirmed Points and XP.</p>

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
              <StatCard label="Recorded Activities" value={totalActivities} icon={Activity} />
              <StatCard label="Verified" value={verified} icon={TrendingUp} accent="text-emerald-600" />
              <StatCard label="Pending" value={pending} icon={Calendar} accent="text-amber-600" />
              <StatCard label="Rejected" value={rejected} icon={Activity} accent="text-red-600" />
            </div>
          </div>

          {/* Friendly empty-week summary */}
          {isEmptyWeek && (
            <Card className="mt-4 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-secondary p-2 text-muted-foreground">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">No activity recorded this week</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Complete tasks, watch content, or participate in quizzes to see your weekly activity here. This preview does not create an archive or award rewards.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Classification breakdown */}
          {activitiesByClass.length > 0 && (
            <Card className="mt-4 p-5">
              <h4 className="text-sm font-semibold">Activity by Classification</h4>
              <div className="mt-3 space-y-2">
                {activitiesByClass.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{c.classification || "Unknown"}</span>
                    <span className="font-medium">{c.count ?? 0}</span>
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
                    <span className="capitalize">{t.type || "Unknown"}</span>
                    <span className="font-medium">{t.count ?? 0}</span>
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
                <p className="mt-1 text-lg font-semibold">{rewardPending}</p>
              </div>
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-xs text-muted-foreground">Approved (not yet paid)</p>
                <p className="mt-1 text-lg font-semibold">{rewardApproved}</p>
              </div>
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-xs text-muted-foreground">Confirmed rewards</p>
                <Link to="/points-history" className="mt-1 inline-block font-semibold underline">View wallet history</Link>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Approved requests are not confirmed payouts until the ledger has been reconciled.
            </p>
          </Card>

          {/* Historical archives (optional — requires separate identity gate) */}
          <div className="mt-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4" /> Historical Reports
            </h3>
            {archivesError ? (
              <div className="mt-4 rounded-xl border border-border bg-secondary/30 p-4">
                <p className="text-sm font-medium text-muted-foreground">Archives unavailable</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Historical reports are temporarily unavailable. Your current-week preview above is unaffected.
                </p>
                <Button variant="outline" size="sm" className="mt-3" onClick={loadArchives}>Retry archives</Button>
              </div>
            ) : loadingArchive ? (
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
