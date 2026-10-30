import React from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ServiceCard({name,icon,configured,isConnected,connection,connecting,disconnecting,onConnect,onDisconnect,configurationUnavailable=false,needsReconnect=false,requiresReview=false,canDisconnect=isConnected,actionsDisabled=false}){
  const identity=connection?.provider_display_name||connection?.account_handle;
  const connectedDate=Date.parse(connection?.connected_at);
  const unavailable=configurationUnavailable||!configured;
  const status=requiresReview?"Needs review":needsReconnect?"Reconnect needed":isConnected?"Connected":configurationUnavailable?"Check unavailable":configured?"Not connected":"Unavailable";
  return <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-lg font-bold">{icon}</div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{identity|| (configurationUnavailable?"Availability could not be checked":isConnected?"Linked account":configured?"Not connected":"New connections are unavailable")}</p>
        </div>
      </div>
      <span className={"inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium "+(isConnected?"bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400":"bg-secondary text-muted-foreground")}>
        {isConnected&&<Check className="h-3 w-3"/>}{status}
      </span>
    </div>
    {canDisconnect&&Number.isFinite(connectedDate)&&<p className="mt-3 text-xs text-muted-foreground">Linked on {new Date(connectedDate).toLocaleDateString()}</p>}
    {requiresReview&&<p className="mt-3 text-xs text-muted-foreground">Multiple connection records need review. Disconnect to remove stored access, then contact support before reconnecting.</p>}
    {needsReconnect&&!requiresReview&&<p className="mt-3 text-xs text-muted-foreground">Reconnect to refresh account verification. Reconnecting does not grant another once-only linking reward.</p>}
    {unavailable&&<p className="mt-3 text-xs text-muted-foreground">{configurationUnavailable?"Provider availability could not be checked. Use Retry above.":"New connections are not available for this service right now."}</p>}
    <div className="mt-4 flex flex-col gap-2">
      {(!isConnected||needsReconnect)&&configured&&!configurationUnavailable&&!requiresReview&&<Button className="w-full" onClick={onConnect} disabled={actionsDisabled||connecting||disconnecting}>
        {connecting?<><Loader2 className="mr-1 h-4 w-4 animate-spin"/>Connecting…</>:needsReconnect?"Reconnect":"Connect"}
      </Button>}
      {canDisconnect&&<Button variant="outline" className="w-full" onClick={onDisconnect} disabled={actionsDisabled||disconnecting||connecting}>
        {disconnecting?<><Loader2 className="mr-1 h-4 w-4 animate-spin"/>Disconnecting…</>:"Disconnect"}
      </Button>}
    </div>
  </div>;
}
