import React, { useState, useEffect, useRef } from "react";
import { KeyRound, Copy, Check, Clock, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

export default function BrowserPairingCard() {
  const [code, setCode] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const sec = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setRemaining(sec);
      if (sec <= 0) {
        clearInterval(timerRef.current);
        setCode(null);
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [expiresAt]);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const res = await base44.functions.invoke("createBrowserPairingCode", {});
      const body = res?.data ?? res;
      if (body?.ok && body.data?.pairing_code) {
        setCode(body.data.pairing_code);
        setExpiresAt(Date.now() + (body.data.expires_in_seconds || 600) * 1000);
      } else {
        setError(body?.error?.message || "Unable to generate pairing code.");
      }
    } catch (e) {
      const msg = e?.response?.data?.error?.message || e?.data?.error?.message;
      setError(msg || "Pairing service unavailable.");
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (!code) return;
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const expired = !code && expiresAt !== null && remaining <= 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
        <h4 className="text-sm font-semibold">Pair a Browser</h4>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Generate a one-time pairing code and enter it into the Perk Sphere browser extension. This code can connect one browser and expires after 10 minutes.
      </p>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

      {!code && !expired && (
        <Button className="mt-3" onClick={generate} disabled={loading}>
          <KeyRound className="h-4 w-4" /> {loading ? "Generating..." : "Generate Pairing Code"}
        </Button>
      )}

      {code && (
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Pairing code</p>
            <code className="mt-1 block w-full rounded-lg border border-border bg-secondary px-3 py-2 text-lg font-mono font-bold tracking-wider">{code}</code>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Expires in {mm}:{ss}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={copyCode}>
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy Code"}
            </Button>
            <Button size="sm" variant="outline" onClick={generate} disabled={loading}>
              <RefreshCw className="h-3.5 w-3.5" /> Generate New Code
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Generating a new code invalidates the previous unused code.</p>
        </div>
      )}

      {expired && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">Pairing code expired.</p>
          <Button size="sm" onClick={generate} disabled={loading}>
            <KeyRound className="h-4 w-4" /> Generate New Code
          </Button>
        </div>
      )}
    </div>
  );
}