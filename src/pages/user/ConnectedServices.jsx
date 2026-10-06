import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Plug, Info } from "lucide-react";
import PageHeader from "@/components/perk/PageHeader";
import StatusBadge from "@/components/perk/StatusBadge";

const SERVICES = [
  { key: "x", name: "X (Twitter)", icon: "𝕏" },
  { key: "youtube", name: "YouTube / Google", icon: "▶" }
];

export default function ConnectedServices() {
  const { user } = useAuth();
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const c = await base44.entities.ConnectedService.list('-created_date', 50);
      setConnections(c || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const getConnection = (key) => connections.find((c) => c.service === key);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  return (
    <div>
      <PageHeader title="Connected Services" description="Manage third-party accounts linked to your Perk Sphere profile" />
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p>OAuth integrations are not yet configured. Connecting a service will be available once the official API integration is added. No connections are active right now.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {SERVICES.map((s) => {
          const conn = getConnection(s.key);
          const configured = conn && conn.status !== "not_configured";
          return (
            <div key={s.key} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-lg font-bold">{s.icon}</div>
                  <div>
                    <p className="text-sm font-semibold">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{configured ? conn.account_handle || "Connected" : "Not connected"}</p>
                  </div>
                </div>
                <StatusBadge status={configured ? conn.status : "not_configured"} />
              </div>
              <div className="mt-4">
                {configured ? (
                  <p className="text-xs text-muted-foreground">Connected on {conn.connected_at ? new Date(conn.connected_at).toLocaleDateString() : "—"}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Integration not yet configured.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}