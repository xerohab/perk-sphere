import React, { useEffect, useState } from "react";
import { FileText, Loader2, Eye, Archive, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/perk/PageHeader";
import EmptyState from "@/components/perk/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

function getArray(data, key) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  const v = data[key] || data.items || data.data;
  return Array.isArray(v) ? v : [];
}

function getData(data, key) {
  if (!data) return null;
  return data[key] || data.data || data;
}

export default function AdminReports() {
  const { toast } = useToast();
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeArchive, setActiveArchive] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const [stage2Disabled, setStage2Disabled] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    setStage2Disabled(false);
    try {
      const res = await base44.functions.invoke("perkSphereReports", { action: "adminArchives", filters: {} });
      const data = res?.data || res;
      if (data?.ok === false) throw new Error(data.error);
      setArchives(getArray(data, "archives"));
    } catch (e) {
      const errData = e?.response?.data || {};
      const errCode = errData.code || errData.error || e.message || "";
      if (errCode === "stage2_identity_not_enabled") {
        setStage2Disabled(true);
      } else {
        setError(errData.error || e.message || "Failed to load reports");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const viewDetail = async (archive) => {
    setActiveArchive(null);
    setLoadingDetail(true);
    try {
      const res = await base44.functions.invoke("perkSphereReports", { action: "adminDetail", archiveId: archive.id });
      const data = res?.data || res;
      if (data?.ok === false) throw new Error(data.error);
      setActiveArchive(getData(data, "archive") || data);
    } catch (e) {
      const errData = e?.response?.data || {};
      toast({ title: "Failed to load detail", description: errData.error || e.message, variant: "destructive" });
    } finally {
      setLoadingDetail(false);
    }
  };

  const createArchive = async () => {
    setArchiving(true);
    try {
      const res = await base44.functions.invoke("perkSphereReports", { action: "archive" });
      const data = res?.data || res;
      if (data?.ok === false) throw new Error(data.error);
      toast({ title: "Archive created", description: "The weekly archive has been created." });
      load();
    } catch (e) {
      const errData = e?.response?.data || {};
      const errCode = errData.code || errData.error || e.message || "";
      if (errCode === "stage2_identity_not_enabled") {
        toast({ title: "Awaiting activation", description: "Administrator report archives are awaiting final activation.", variant: "default" });
      } else {
        toast({ title: "Archive failed", description: errData.error || e.message, variant: "destructive" });
      }
    } finally {
      setArchiving(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  return (
    <div>
      <PageHeader title="Administrator Reports" description="Review member reports, examine classifications and create weekly archives" />

      <div className="mt-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
        <div>
          <p className="text-xs text-blue-800 dark:text-blue-300">Historical report versions are preserved. Superseded reports are clearly identified. Ordinary members cannot access other members' reports.</p>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button onClick={createArchive} disabled={archiving || stage2Disabled}>
          {archiving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />} Create Weekly Archive
        </Button>
      </div>

      {stage2Disabled && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Administrator report archives are awaiting final activation.</p>
              <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">
                Historical report archives require an additional identity-verification step on the Linux API that is not yet enabled. Ordinary weekly report previews remain available to members independently.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && !stage2Disabled && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Reports temporarily unavailable</p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={load}>Retry</Button>
        </div>
      )}

      {!error && !stage2Disabled && (
        <div className="mt-6">
          {loadingDetail ? (
            <div className="flex h-20 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : activeArchive ? (
            <Card className="p-5">
              <Button variant="ghost" size="sm" className="mb-3" onClick={() => setActiveArchive(null)}>← Back to archives</Button>
              <h4 className="text-sm font-semibold">
                {activeArchive.week_start ? new Date(activeArchive.week_start).toLocaleDateString("en-GB") : "Archive"}
                {activeArchive.user_reference && <span className="ml-2 text-xs text-muted-foreground">Member: {activeArchive.user_reference}</span>}
                {activeArchive.superseded && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">Superseded</span>}
              </h4>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-secondary/50 p-3 text-xs">{JSON.stringify(activeArchive, null, 2)}</pre>
            </Card>
          ) : archives.length === 0 ? (
            <EmptyState title="No archives" description="Create a weekly archive using the button above." />
          ) : (
            <div className="space-y-3">
              {archives.map((a) => (
                <Card key={a.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium">
                      {a.week_start ? new Date(a.week_start).toLocaleDateString("en-GB") : "Report"}
                      {a.week_end && <span className="text-muted-foreground"> - {new Date(a.week_end).toLocaleDateString("en-GB")}</span>}
                    </p>
                    {a.user_reference && <p className="text-xs text-muted-foreground">Member: {a.user_reference}</p>}
                    {a.superseded && <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">Superseded</span>}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => viewDetail(a)}>
                    <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}