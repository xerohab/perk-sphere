import React, { useState, useEffect } from "react";
import { Globe, Download, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchRelease } from "@/lib/extensionRelease";
import { isOutdated } from "@/lib/versionUtils";

export default function BrowserExtensionDownloadCard({ devices = [] }) {
  const [release, setRelease] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetchRelease("chromium");
      if (!cancelled) {
        setRelease(r);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const available = !!(release && release.download_url && release.version);
  const outdatedDevices = available
    ? devices.filter(
        (d) => d.status === "active" && release.version && isOutdated(d.client_version, release.version)
      )
    : [];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Globe className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
        <h4 className="text-sm font-semibold">Perk Sphere for Chrome / Chromium</h4>
      </div>

      {available ? (
        <>
          <p className="mt-2 text-xs text-muted-foreground">Latest version: v{release.version}</p>
          {outdatedDevices.length > 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 dark:bg-amber-950/20">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
              <div className="text-xs">
                <p className="font-medium text-amber-900 dark:text-amber-300">Update available</p>
                <p className="text-amber-700 dark:text-amber-400">
                  Installed: v{outdatedDevices[0].client_version} · Latest: v{release.version}
                </p>
              </div>
            </div>
          )}
          <Button className="mt-3" asChild>
            <a href={release.download_url} target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4" /> Download Latest Extension
            </a>
          </Button>
        </>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          {loading ? "Checking for latest release..." : "Extension download coming soon"}
        </p>
      )}

      <div className="mt-4 rounded-lg bg-secondary p-3">
        <p className="text-xs font-medium">Installation</p>
        <ol className="mt-1.5 list-decimal space-y-0.5 pl-4 text-xs text-muted-foreground">
          <li>Download the ZIP.</li>
          <li>Extract it.</li>
          <li>Open chrome://extensions</li>
          <li>Enable Developer mode.</li>
          <li>Choose "Load unpacked".</li>
          <li>Select the extracted extension folder.</li>
        </ol>
      </div>
    </div>
  );
}