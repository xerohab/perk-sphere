import React, { useState } from "react";
import { Globe, Copy, Check, Loader2, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

// Reusable DNS TXT verification setup card.
// Shows the exact DNS record to publish, copy buttons for every field,
// provider-specific instructions, a Verify Domain button, and
// pending / verified / failed states.
export default function DnsSetupCard({ domain, token, verified, verifying, error, onVerify, verifiedAt = undefined }) {
  const [copied, setCopied] = useState(null);
  const [showProviderHelp, setShowProviderHelp] = useState(false);

  const hostname = `_perksphere.${domain}`;

  const copy = (key, value) => {
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const CopyButton = ({ field, value }) => (
    <button
      type="button"
      onClick={() => copy(field, value)}
      className="flex-shrink-0 rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      title="Copy to clipboard"
    >
      {copied === field ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );

  const FieldRow = ({ label, value, field, mono = true }) => (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={`mt-0.5 truncate text-sm ${mono ? "font-mono" : ""}`}>{value}</p>
      </div>
      <CopyButton field={field} value={value} />
    </div>
  );

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      {/* Header with status */}
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Globe className="h-4 w-4" /> DNS Domain Verification
        </h3>
        {verified ? (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Verified
          </span>
        ) : error ? (
          <span className="flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700 dark:bg-red-500/15 dark:text-red-400">
            <XCircle className="h-3.5 w-3.5" /> Failed
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
            <Loader2 className="h-3.5 w-3.5" /> Pending
          </span>
        )}
      </div>

      {verified ? (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-700 dark:bg-emerald-950/30">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Domain ownership confirmed</p>
            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
              Linux verified the DNS TXT record for <code className="font-mono">{domain}</code>
              {verifiedAt && ` on ${new Date(verifiedAt).toLocaleString("en-GB")}`}. You can proceed to the next onboarding step.
            </p>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-3 text-xs text-muted-foreground">
            Publish a DNS TXT record to prove ownership of <code className="font-mono">{domain}</code>. Linux verifies the record — verification is not done locally.
          </p>

          {/* DNS record fields */}
          <div className="mt-4 space-y-2">
            <FieldRow label="Record type" value="TXT" field="type" mono={false} />
            <FieldRow label="Name / Host" value={hostname} field="hostname" />
            <FieldRow label="Value / Content" value={token || "(awaiting provisioning)"} field="value" />
            <FieldRow label="TTL" value="3600 (1 hour)" field="ttl" mono={false} />
          </div>

          {/* Error state */}
          {error && (
            <div className="mt-3 flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-700 dark:bg-red-950/30">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400" />
              <div>
                <p className="text-xs font-medium text-red-800 dark:text-red-300">Verification failed</p>
                <p className="mt-0.5 text-xs text-red-700 dark:text-red-400">{error}</p>
                <p className="mt-1 text-xs text-red-700 dark:text-red-400">This may be due to DNS caching. Wait a few minutes and retry.</p>
              </div>
            </div>
          )}

          {/* Provider-specific instructions */}
          <button
            type="button"
            onClick={() => setShowProviderHelp(!showProviderHelp)}
            className="mt-3 flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            {showProviderHelp ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            DNS provider instructions
          </button>
          {showProviderHelp && (
            <div className="mt-2 space-y-3 rounded-lg border border-border bg-secondary/30 p-4 text-xs text-muted-foreground">
              <div>
                <p className="font-medium text-foreground">Cloudflare</p>
                <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                  <li>Log in to Cloudflare and select your domain</li>
                  <li>Go to DNS, then Records, then Add record</li>
                  <li>Type: <strong>TXT</strong>, Name: <code className="font-mono">_perksphere</code></li>
                  <li>Content: paste the Value above</li>
                  <li>TTL: Auto, Proxy status: DNS only</li>
                  <li>Save</li>
                </ol>
              </div>
              <div>
                <p className="font-medium text-foreground">Other providers (GoDaddy, Namecheap, Route 53, etc.)</p>
                <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                  <li>Go to your domain's DNS management page</li>
                  <li>Add a new TXT record</li>
                  <li>Host/Name: <code className="font-mono">{hostname}</code></li>
                  <li>Value/Content: paste the Value above</li>
                  <li>TTL: 1 hour (or default)</li>
                  <li>Save</li>
                </ol>
                <p className="mt-1">Some providers require the full hostname including your domain. Others only need <code className="font-mono">_perksphere</code>. Check your provider's documentation.</p>
              </div>
            </div>
          )}

          {/* Verify button */}
          {onVerify && (
            <Button
              className="mt-4 w-full"
              onClick={onVerify}
              disabled={verifying || !token}
            >
              {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
              Verify Domain
            </Button>
          )}
        </>
      )}
    </div>
  );
}
