import React, { useState } from "react";
import { Monitor, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import ConfirmDialog from "./ConfirmDialog";
import EmptyState from "./EmptyState";

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function DeviceRow({ device, onRevoke }) {
  const revoked = device.status === "revoked";
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{device.device_name || "Browser extension"}</p>
          {revoked && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/30 dark:text-red-400">Revoked</span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {device.platform || "Chromium"} · v{device.client_version || "unknown"}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Last seen: {formatDate(device.last_seen_at)} · Connected: {formatDate(device.created_at)}
        </p>
      </div>
      {!revoked && (
        <ConfirmDialog
          trigger={<Button size="sm" variant="outline"><Trash2 className="h-3.5 w-3.5" /> Revoke</Button>}
          title="Revoke this device?"
          description="The Perk Sphere extension on this device will no longer be able to access your account until it is paired again."
          confirmLabel="Revoke Device"
          destructive
          onConfirm={() => onRevoke(device.device_uuid)}
        />
      )}
    </div>
  );
}

export default function BrowserDevicesCard({ devices, loading, error, onRevoke, onRefresh }) {
  const { toast } = useToast();
  const [revoking, setRevoking] = useState(false);

  const handleRevoke = async (uuid) => {
    setRevoking(true);
    try {
      await onRevoke(uuid);
      toast({ title: "Device revoked" });
    } catch (e) {
      toast({ title: "Unable to revoke device", description: e.message, variant: "destructive" });
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Monitor className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <h4 className="text-sm font-semibold">Connected Devices</h4>
        </div>
        <Button size="icon" variant="ghost" onClick={onRefresh} disabled={loading || revoking}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>
      {error && <p className="mb-3 text-xs text-red-600">{error}</p>}
      {devices.length === 0 && !loading ? (
        <EmptyState title="No browser extensions are currently connected to your account." />
      ) : (
        <div className="space-y-2">
          {devices.map((d) => (
            <DeviceRow key={d.device_uuid} device={d} onRevoke={handleRevoke} />
          ))}
        </div>
      )}
    </div>
  );
}