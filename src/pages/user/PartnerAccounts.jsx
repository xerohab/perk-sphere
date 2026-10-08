import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Link2, Unlink, Copy, Check, Clock, ShieldCheck, ExternalLink } from "lucide-react";
import PageHeader from "@/components/perk/PageHeader";
import EmptyState from "@/components/perk/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import ConfirmDialog from "@/components/perk/ConfirmDialog";

export default function PartnerAccounts() {
  const { toast } = useToast();
  const [partners, setPartners] = useState([]);
  const [connected, setConnected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [challengeDialog, setChallengeDialog] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [partnersRes, linksRes] = await Promise.all([
        base44.functions.invoke("partnerAccountLink", { action: "listPartners" }),
        base44.functions.invoke("partnerAccountLink", { action: "listLinks" })
      ]);
      const pData = partnersRes?.data || partnersRes;
      const lData = linksRes?.data || linksRes;
      setPartners(pData?.partners || []);
      setConnected(lData?.connected || []);
    } catch (e) {
      toast({ title: "Failed to load", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const startLink = async (partner) => {
    try {
      const res = await base44.functions.invoke("partnerAccountLink", {
        action: "createChallenge",
        partnerId: partner.id
      });
      const data = res?.data || res;
      if (data?.challenge_token) {
        setChallengeDialog({
          partner,
          challenge_token: data.challenge_token,
          expires_at: data.expires_at,
          instructions: data.instructions
        });
      }
    } catch (e) {
      toast({ title: "Failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    }
  };

  const unlink = async (connId) => {
    try {
      await base44.functions.invoke("partnerAccountLink", { action: "unlink", connectedServiceId: connId });
      toast({ title: "Account unlinked" });
      load();
    } catch (e) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  const copyChallenge = async () => {
    try {
      await navigator.clipboard.writeText(challengeDialog.challenge_token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_e) {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const isLinked = (partnerId) => connected.some((c) => c.service === `partner_${partnerId}` && c.status === "connected");

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  return (
    <div>
      <PageHeader title="Partner Accounts" description="Connect your partner site accounts to earn rewards for verified activity." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {partners.length === 0 ? (
          <div className="col-span-full"><EmptyState title="No partners available" description="Partner integrations will appear here once they are configured." /></div>
        ) : (
          partners.map((p) => {
            const linked = isLinked(p.id);
            const conn = connected.find((c) => c.service === `partner_${p.id}` && c.status === "connected");
            return (
              <div key={p.id} className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold">{p.name}</h3>
                    {p.website_url && <a href={p.website_url} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400"><ExternalLink className="h-3 w-3" /> {p.website_url}</a>}
                  </div>
                  {linked ? (
                    <span className="flex-shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"><ShieldCheck className="mr-1 inline h-3 w-3" /> Linked</span>
                  ) : (
                    <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-500/15 dark:text-slate-300">Not linked</span>
                  )}
                </div>
                {p.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
                {linked && conn && <p className="mt-2 text-xs text-muted-foreground">Account: {conn.account_handle || conn.external_account_id}</p>}
                <div className="mt-4 flex gap-2">
                  {!linked ? (
                    <Button size="sm" onClick={() => startLink(p)}><Link2 className="mr-1 h-3.5 w-3.5" /> Link account</Button>
                  ) : (
                    <ConfirmDialog
                      trigger={<Button variant="outline" size="sm" className="text-red-600"><Unlink className="mr-1 h-3.5 w-3.5" /> Unlink</Button>}
                      title={`Unlink from ${p.name}?`}
                      description="You will stop earning rewards from this partner until you link again."
                      confirmLabel="Unlink"
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

      {/* Challenge Dialog */}
      {challengeDialog && (
        <Dialog open={!!challengeDialog} onOpenChange={(o) => !o && setChallengeDialog(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Link {challengeDialog.partner.name} account</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-blue-300 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-950/30">
                <Clock className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Single-use challenge</p>
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
              <p className="text-xs text-muted-foreground">Send an ACCOUNT_LINKED event to the Linux API from {challengeDialog.partner.name} with this challenge_token and your account reference. The link completes automatically once the partner verifies the challenge.</p>
            </div>
            <DialogFooter><DialogClose asChild><Button>Done</Button></DialogClose></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}