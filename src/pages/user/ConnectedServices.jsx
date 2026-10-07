import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { useSearchParams } from "react-router-dom";
import PageHeader from "@/components/perk/PageHeader";
import ServiceCard from "@/components/perk/ServiceCard";

const SERVICES = [
  { key: "google", name: "YouTube / Google", icon: "▶" },
  { key: "x", name: "X (Twitter)", icon: "𝕏" }
];

const ERROR_MESSAGES = {
  provider_not_configured: "This provider is not configured yet.",
  provider_error: "The provider returned an error. Please try again.",
  missing_params: "The connection request was incomplete.",
  state_invalid: "The security state was invalid. Please try again.",
  state_used: "This connection link was already used. Please try again.",
  state_expired: "The connection link expired. Please try again.",
  token_exchange_failed: "Could not complete authorization. Please try again.",
  provider_identity_failed: "Could not retrieve your account information. Please try again.",
  credential_encryption_failed: "Server encryption error. Please contact support.",
  credential_storage_failed: "Could not save your credentials. Please try again.",
  connection_storage_failed: "Could not save your connection. Please try again.",
  callback_failed: "Connection failed. Please try again."
};

export default function ConnectedServices() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [connections, setConnections] = useState([]);
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(null);
  const [disconnecting, setDisconnecting] = useState(null);

  const load = useCallback(async () => {
    try {
      const [c, cfgRes] = await Promise.all([
        base44.entities.ConnectedService.list('-created_date', 50),
        base44.functions.invoke("oauthConfig", {}).then(r => r.data || r).catch(() => ({ providers: {} }))
      ]);
      setConnections(c || []);
      setConfig(cfgRes.providers || {});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const status = searchParams.get("status");
    const provider = searchParams.get("provider");
    const reason = searchParams.get("reason");
    if (status === "connected") {
      toast({ title: "Service connected", description: "Your account is now linked." });
      load();
    } else if (status === "error") {
      toast({ title: "Connection failed", description: ERROR_MESSAGES[reason] || "An error occurred.", variant: "destructive" });
    }
    if (status) window.history.replaceState({}, "", "/connected-services");
  }, [searchParams, toast, load]);

  const getConnection = (key) => connections.find((c) => c.service === key);

  const handleConnect = async (key) => {
    setConnecting(key);
    try {
      const res = await base44.functions.invoke("oauthStart", { provider: key });
      const data = res.data || res;
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else if (data.error) {
        toast({ title: "Connection failed", description: data.error === "provider_not_configured" ? "This provider is not configured yet." : data.message || data.error, variant: "destructive" });
      }
    } catch (e) {
      const data = e?.response?.data || {};
      toast({ title: "Connection failed", description: data.error === "provider_not_configured" ? "This provider is not configured yet." : (data.error || e.message), variant: "destructive" });
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (key) => {
    setDisconnecting(key);
    try {
      await base44.functions.invoke("disconnectService", { provider: key });
      toast({ title: "Disconnected", description: "Your account has been unlinked." });
      await load();
    } catch (e) {
      toast({ title: "Failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setDisconnecting(null);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  return (
    <div>
      <PageHeader title="Connected Services" description="Manage third-party accounts linked to your Perk Sphere profile" />
      <div className="grid gap-4 sm:grid-cols-2">
        {SERVICES.map((s) => {
          const conn = getConnection(s.key);
          const configured = config[s.key]?.configured !== false;
          const isConnected = conn && conn.status === "connected";
          return (
            <ServiceCard
              key={s.key}
              name={s.name}
              icon={s.icon}
              configured={configured}
              isConnected={isConnected}
              connection={conn}
              connecting={connecting === s.key}
              disconnecting={disconnecting === s.key}
              onConnect={() => handleConnect(s.key)}
              onDisconnect={() => handleDisconnect(s.key)}
            />
          );
        })}
      </div>
    </div>
  );
}