import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { KeyRound, Loader2, AlertTriangle, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose
} from "@/components/ui/dialog";

// Secure one-time credential handoff for partner operators.
// Step 1: Admin requests a handoff token (5-minute TTL, single-use).
// Step 2: Admin or partner operator retrieves the decrypted credentials using the token.
export default function PartnerCredentialHandoff({ partner, onClose, onRefresh }) {
  const { toast } = useToast();
  const [step, setStep] = useState("idle"); // idle | requesting | token-ready | retrieving | credentials
  const [handoffToken, setHandoffToken] = useState("");
  const [retrieveToken, setRetrieveToken] = useState("");
  const [credentials, setCredentials] = useState(null);
  const [copied, setCopied] = useState(null);

  const requestHandoff = async () => {
    setStep("requesting");
    try {
      const res = await base44.functions.invoke("partnerCredentialHandoff", { action: "request", partnerId: partner.id });
      const body = res?.data || res;
      if (body?.handoff_token) {
        setHandoffToken(body.handoff_token);
        setRetrieveToken(body.handoff_token);
        setStep("token-ready");
        toast({ title: "Handoff token generated", description: `Expires in ${body.expires_in_minutes} minutes. Single-use only.` });
      } else {
        toast({ title: "Failed", description: body?.error || "Unexpected response", variant: "destructive" });
        setStep("idle");
      }
    } catch (e) {
      const errData = e?.response?.data || {};
      toast({ title: "Handoff failed", description: errData.error || e.message, variant: "destructive" });
      setStep("idle");
    }
  };

  const retrieveCredentials = async () => {
    if (!retrieveToken) { toast({ title: "Token required", variant: "destructive" }); return; }
    setStep("retrieving");
    try {
      const res = await base44.functions.invoke("partnerCredentialHandoff", { action: "retrieve", partnerId: partner.id, token: retrieveToken });
      const body = res?.data || res;
      if (body?.partner_secret) {
        setCredentials({ partner_key_id: body.partner_key_id, partner_secret: body.partner_secret, linux_api_partner_id: body.linux_api_partner_id });
        setStep("credentials");
        toast({ title: "Credentials retrieved", description: "Single-use token consumed. Save these now." });
      } else {
        toast({ title: "Failed", description: body?.error || "Unexpected response", variant: "destructive" });
        setStep("token-ready");
      }
    } catch (e) {
      const errData = e?.response?.data || {};
      toast({ title: "Retrieval failed", description: errData.error || e.message, variant: "destructive" });
      setStep("token-ready");
    }
  };

  const copy = (key, value) => {
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const close = () => {
    setStep("idle");
    setHandoffToken("");
    setRetrieveToken("");
    setCredentials(null);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Credential Handoff — {partner.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Prerequisites check */}
          {!partner.linux_api_partner_id && (
            <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-700 dark:bg-red-950/30">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-300">Linux UUID not set</p>
                <p className="mt-1 text-xs text-red-700 dark:text-red-400">This partner has not been reconciled with Linux. Set the Linux Partner UUID first.</p>
              </div>
            </div>
          )}

          {partner.linux_api_partner_id && step === "idle" && (
            <>
              <div className="flex items-start gap-3 rounded-lg border border-blue-300 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-950/30">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300">How credential handoff works</p>
                  <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">Step 1: Generate a one-time token (valid for 5 minutes). Step 2: Retrieve the decrypted credentials using the token. The token is single-use — once retrieved, it cannot be used again. You must rotate credentials first if no active credential exists.</p>
                </div>
              </div>
              <Button onClick={requestHandoff} className="w-full">
                <KeyRound className="mr-2 h-4 w-4" /> Request Handoff Token
              </Button>
            </>
          )}

          {step === "requesting" && (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          )}

          {step === "token-ready" && (
            <>
              <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">One-time token generated</p>
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Copy this token and use it to retrieve the credentials. It expires in 5 minutes and can only be used once.</p>
                </div>
              </div>
              <div>
                <Label>Handoff Token</Label>
                <div className="mt-1.5 flex gap-2">
                  <Input readOnly value={handoffToken} className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => copy("token", handoffToken)}>
                    {copied === "token" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Button onClick={retrieveCredentials} className="w-full">
                <KeyRound className="mr-2 h-4 w-4" /> Retrieve Credentials
              </Button>
            </>
          )}

          {step === "retrieving" && (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          )}

          {step === "credentials" && credentials && (
            <>
              <div className="flex items-start gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-700 dark:bg-emerald-950/30">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Credentials retrieved — save now</p>
                  <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">The partner secret is shown only once. The handoff token has been consumed. Configure these in the partner application secrets.</p>
                </div>
              </div>
              <div>
                <Label>PERKSPHERE_PARTNER_KEY_ID</Label>
                <div className="mt-1.5 flex gap-2">
                  <Input readOnly value={credentials.partner_key_id} className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => copy("key", credentials.partner_key_id)}>
                    {copied === "key" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div>
                <Label>PERKSPHERE_PARTNER_HMAC_SECRET</Label>
                <div className="mt-1.5 flex gap-2">
                  <Input readOnly value={credentials.partner_secret} className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => copy("secret", credentials.partner_secret)}>
                    {copied === "secret" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="rounded-lg bg-secondary p-3 text-xs text-muted-foreground">
                <p className="font-medium">Linux Partner UUID</p>
                <p className="mt-1 font-mono break-all">{credentials.linux_api_partner_id}</p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild><Button variant="outline" onClick={close}>Close</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}