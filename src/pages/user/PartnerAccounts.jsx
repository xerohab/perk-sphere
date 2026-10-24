import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Link2, Unlink, Copy, Check, Clock, ShieldCheck, ExternalLink, Loader2, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import PageHeader from "@/components/perk/PageHeader";
import EmptyState from "@/components/perk/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import ConfirmDialog from "@/components/perk/ConfirmDialog";
import { getPartnerState } from "@/lib/partner-account-state";

const STATE_BADGE = {
  unavailable: { label: "Check unavailable", cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400", icon: AlertTriangle },
  unverified: { label: "Verification needed", cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400", icon: AlertTriangle },
  connected: { label: "Connected", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400", icon: ShieldCheck },
  pending: { label: "Pending", cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400", icon: Clock },
  expired: { label: "Expired", cls: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400", icon: XCircle },
  connect: { label: "Not linked", cls: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300", icon: Link2 },
  disconnected: { label: "Disconnected", cls: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300", icon: Unlink },
  coming_soon: { label: "Coming soon", cls: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400", icon: Clock }
};

export default function PartnerAccounts() {
  const { toast } = useToast();
  const [partners, setPartners] = useState([]);
  const [links, setLinks] = useState([]);
  const [connected, setConnected] = useState([]);
  const [verification, setVerification] = useState({});
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [challengeDialog, setChallengeDialog] = useState(null);
  const [copied, setCopied] = useState(false);
  const [linking, setLinking] = useState(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [partnersRes, linksRes] = await Promise.all([
        base44.functions.invoke("partnerAccountLink", { action: "listPartners" }),
        base44.functions.invoke("partnerAccountLink", { action: "listLinks" })
      ]);
      const pData = partnersRes?.data || partnersRes;
      const lData = linksRes?.data || linksRes;
      setPartners(pData?.partners || []);
      setLinks(lData?.links || []);
      setConnected(lData?.connected || []);
      setVerification(lData?.verification || {});
      setLoadError(false);
    } catch (e) {
      setLoadError(true);
      setVerification({});
      toast({ title: "Failed to load", description: "Your saved connections have been kept. Please retry the connection check.", variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const hasPending = links.some((l) => l.status === "pending" && (!l.expires_at || new Date(l.expires_at) > new Date()));
  useEffect(() => {
    if (!hasPending) return;
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [hasPending, load]);

  const startLink = async (partner) => {
    setLinking(partner.id);
    try {
      const res = await base44.functions.invoke("partnerAccountLink", { action: "createChallenge", partnerId: partner.id });
      const data = res?.data || res;
      if (data?.challenge_token) {
        setChallengeDialog({ partner, challenge_token: data.challenge_token, expires_at: data.expires_at, instructions: data.instructions });
        load();
      }
    } catch (e) {
      toast({ title: "Failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setLinking(null);
    }
  };

  const unlink = async (connId) => {
    try {
      await base44.functions.invoke("partnerAccountLink", { action: "unlink", connectedServiceId: connId });
      toast({ title: "Account unlinked" });
      load();
    } catch (e) {
      const errData = e?.response?.data || {};
      const isRetry = errData.retry || errData.code === "linux_unavailable";
      toast({
        title: isRetry ? "Unlinking temporarily unavailable" : "Failed",
        description: errData.error || e.message,
        variant: "destructive",
        action: isRetry ? { label: "Retry", onClick: () => unlink(connId) } : undefined
      });
    }
  };

  const copyChallenge = async () => {
    try {
      await navigator.clipboard.writeText(challengeDialog.challenge_token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_e) { toast({ title: "Copy failed", variant: "destructive" }); }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  return (
    <div>
      <PageHeader title="Partner Accounts" description="Connect your partner site accounts to earn rewards for verified activity." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" disabled={refreshing} onClick={load}><RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />{refreshing ? "Checking connections…" : "Refresh connections"}</Button>
        {loadError && <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">Connection checks are temporarily unavailable. Saved connections have not been removed.</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {partners.length === 0 ? (
          <div className="col-span-full"><EmptyState title={loadError ? "Unable to load partners" : "No partners available"} description={loadError ? "Retry the connection check to load your partners." : "Partner integrations will appear here once they are configured."} /></div>
        ) : (
          partners.map((p) => {
            const { state, conn, link } = getPartnerState(p, links, connected, verification);
            const badge = STATE_BADGE[state];
            const BadgeIcon = badge.icon;
            return (
              <div key={p.id} className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold">{p.name}</h3>
                    {p.website_url && <a href={p.website_url} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400"><ExternalLink className="h-3 w-3" /> {p.website_url}</a>}
                  </div>
                  <span className={`flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}><BadgeIcon className="h-3 w-3" /> {badge.label}</span>
                </div>
                {p.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}

                {["connected", "unavailable", "unverified"].includes(state) && conn && (
                  <p className="mt-2 text-xs text-muted-foreground">Account: <span className="font-medium">{conn.account_handle || conn.external_account_id}</span></p>
                )}
                {state === "unavailable" && <p className="mt-2 text-xs text-muted-foreground">We could not verify the current connection. Refresh to try again; any saved connection is preserved.</p>}
                {state === "unverified" && <p className="mt-2 text-xs text-muted-foreground">Your saved connection is not currently confirmed by the partner. Disconnect it before reconnecting.</p>}
                {state === "pending" && link && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400"><Loader2 className="h-3 w-3 animate-spin" /> Waiting for {p.name} to confirm...{link.expires_at && <span className="ml-1">expires {new Date(link.expires_at).toLocaleTimeString()}</span>}</p>
                )}
                {state === "expired" && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400"><AlertTriangle className="h-3 w-3" /> Challenge expired. Request a new one to continue.</p>
                )}
                {state === "coming_soon" && (
                  <p className="mt-2 text-xs text-muted-foreground">This partner is being set up. Account linking will be available once the integration is activated.</p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {state === "connect" && (
                    <Button size="sm" onClick={() => startLink(p)} disabled={linking === p.id}>
                      {linking === p.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Link2 className="mr-1.5 h-3.5 w-3.5" />}
                      Connect
                    </Button>
                  )}
                  {state === "pending" && (
                    <Button size="sm" variant="outline" onClick={() => startLink(p)} disabled={linking === p.id}>
                      {linking === p.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                      New challenge
                    </Button>
                  )}
                  {state === "expired" && (
                    <Button size="sm" onClick={() => startLink(p)} disabled={linking === p.id}>
                      {linking === p.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                      Retry
                    </Button>
                  )}
                  {state === "disconnected" && (
                    <Button size="sm" onClick={() => startLink(p)} disabled={linking === p.id}>
                      {linking === p.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Link2 className="mr-1.5 h-3.5 w-3.5" />}
                      Reconnect
                    </Button>
                  )}
                  {conn?.status === "connected" && (
                    <ConfirmDialog
                      trigger={<Button variant="outline" size="sm" className="text-red-600"><Unlink className="mr-1.5 h-3.5 w-3.5" /> Disconnect</Button>}
                      title={`Disconnect from ${p.name}?`}
                      description="You will stop earning rewards from this partner until you connect again."
                      confirmLabel="Disconnect"
                      destructive
                      onConfirm={() => unlink(conn.id)}
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {challengeDialog && (
        <Dialog open={!!challengeDialog} onOpenChange={(o) => !o && setChallengeDialog(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Connect to {challengeDialog.partner.name}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-blue-300 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-950/30">
                <Clock className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Single-use challenge — expires in 10 minutes</p>
                  <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">{challengeDialog.instructions}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium">Challenge token</p>
                <div className="mt-1 flex gap-2">
                  <code className="flex-1 break-all rounded-lg bg-secondary p-2 font-mono text-xs">{challengeDialog.challenge_token}</code>
                  <Button variant="outline" size="sm" onClick={copyChallenge}>{copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}</Button>
                </div>
              </div>
              <div className="rounded-lg bg-secondary p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Next steps:</p>
                <ol className="mt-1.5 list-decimal space-y-1 pl-4">
                  <li>Copy the challenge token above.</li>
                  <li>Go to <a href={challengeDialog.partner.website_url} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">{challengeDialog.partner.name}</a> and log in to your account.</li>
                  <li>Find the Perk Sphere connection page and paste the challenge token.</li>
                  <li>Approve the connection. The link completes automatically here once {challengeDialog.partner.name} confirms.</li>
                </ol>
              </div>
              <p className="text-xs text-muted-foreground">This page will update automatically when the connection is confirmed.</p>
            </div>
            <DialogFooter>
              <a href={challengeDialog.partner.website_url} target="_blank" rel="noopener noreferrer" className="mr-auto">
                <Button variant="outline"><ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open {challengeDialog.partner.name}</Button>
              </a>
              <DialogClose asChild><Button>Done</Button></DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}