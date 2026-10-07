import React from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ServiceCard({ name, icon, configured, isConnected, connection, connecting, disconnecting, onConnect, onDisconnect }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-lg font-bold">{icon}</div>
          <div>
            <p className="text-sm font-semibold">{name}</p>
            <p className="text-xs text-muted-foreground">
              {!configured ? "Not configured" : isConnected ? (connection?.provider_display_name || connection?.account_handle || "Connected") : "Not connected"}
            </p>
          </div>
        </div>
        {isConnected ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"><Check className="h-3 w-3" /> Connected</span>
        ) : !configured ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">Not configured</span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Not connected</span>
        )}
      </div>
      {isConnected && connection?.connected_at && (
        <p className="mt-3 text-xs text-muted-foreground">Connected on {new Date(connection.connected_at).toLocaleDateString()}</p>
      )}
      <div className="mt-4">
        {!configured ? (
          <p className="text-xs text-muted-foreground">This provider is not yet configured. Please check back later.</p>
        ) : isConnected ? (
          <Button variant="outline" className="w-full" onClick={onDisconnect} disabled={disconnecting}>
            {disconnecting ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Disconnecting...</> : "Disconnect"}
          </Button>
        ) : (
          <Button className="w-full" onClick={onConnect} disabled={connecting}>
            {connecting ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Connecting...</> : "Connect"}
          </Button>
        )}
      </div>
    </div>
  );
}