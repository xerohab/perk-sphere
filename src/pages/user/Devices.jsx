import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Smartphone, Trash2 } from "lucide-react";
import PageHeader from "@/components/perk/PageHeader";
import StatusBadge from "@/components/perk/StatusBadge";
import EmptyState from "@/components/perk/EmptyState";
import ConfirmDialog from "@/components/perk/ConfirmDialog";
import { Button } from "@/components/ui/button";

export default function Devices() {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const d = await base44.entities.Device.list('-last_active', 50);
      setItems(d || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const revoke = async (device) => {
    await base44.entities.Device.update(device.id, { status: "revoked" });
    toast({ title: "Device revoked", description: `${device.friendly_name || device.device_type} can no longer submit activity.` });
    load();
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  return (
    <div>
      <PageHeader title="Devices" description="Clients connected to your Perk Sphere account" />
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <Smartphone className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p>Supported clients include the Chrome/Edge/Safari extensions and the Android/iOS apps. Devices are registered automatically when they first connect through the tracking API.</p>
      </div>
      {items.length === 0 ? (
        <EmptyState title="No connected devices" description="Devices will appear here once you connect the extension or mobile app." />
      ) : (
        <div className="space-y-3">
          {items.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-secondary p-2.5 text-muted-foreground"><Smartphone className="h-5 w-5" /></div>
                <div>
                  <p className="text-sm font-medium">{d.friendly_name || d.device_type}</p>
                  <p className="text-xs text-muted-foreground">{d.device_type} · v{d.client_version || "—"} · Last active {d.last_active ? new Date(d.last_active).toLocaleDateString() : "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={d.status} />
                {d.status !== "revoked" && (
                  <ConfirmDialog
                    trigger={<Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-red-500" /></Button>}
                    title="Revoke this device?"
                    description="The device will no longer be able to submit activity to your account."
                    confirmLabel="Revoke"
                    destructive
                    onConfirm={() => revoke(d)}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}