import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { useSearchParams } from "react-router-dom";
import PageHeader from "@/components/perk/PageHeader";
import ServiceCard from "@/components/perk/ServiceCard";
import {useAuth} from "@/lib/AuthContext";
import {Button} from "@/components/ui/button";

const SERVICES = [
  { key: "google", name: "Google", icon: "G" },
  { key: "youtube", name: "YouTube", icon: "▶" },
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
  const {user} = useAuth();
  const [claiming,setClaiming] = useState(null);
  const [loadError,setLoadError] = useState("");
  const [searchParams] = useSearchParams();
  const [connections, setConnections] = useState([]);
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(null);
  const [disconnecting, setDisconnecting] = useState(null);

  const load = useCallback(async () => {
    if(!user?.id){setConnections([]);setLoading(false);return;}
    setLoadError("");
    try {
      const [c, cfgRes] = await Promise.all([
        base44.entities.ConnectedService.filter({user_id:user.id},'-created_date', 50),
        base44.functions.invoke("oauthConfig", {}).then(r => r.data || r).catch(() => ({ providers: {} }))
      ]);
      setConnections(c || []);
      setConfig(cfgRes.providers || {});
    } catch { setConnections([]);setConfig({});setLoadError("Could not load your connections. Please retry.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

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

  const getConnection = (key) => connections.find((c) => c.service === key && c.user_id === user?.id);
  const claimReward = async provider => {
    setClaiming(provider);
    try {
      const response=await base44.functions.invoke("claimSocialLinkReward",{provider});
      const body=response.data;
      if(body?.ok!==true)throw Error("Current ownership could not be verified. Please retry.");
      const result=body.data;
      const description=result?.issued ? `You earned ${result.points} Points and ${result.xp} XP.` : result?.duplicate ? "You have already received this linking reward." : result?.reason==="social_account_already_rewarded" ? "This account has already received its linking reward." : "Linking rewards are not available for this service yet.";
      toast({title:result?.issued?"Linking reward received":"Linking reward",description});
    } catch { toast({title:"Reward unavailable",description:"Current ownership could not be verified. Please retry later.",variant:"destructive"}); }
    finally { setClaiming(null); }
  };

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
      <p className="mb-4 text-sm text-muted-foreground">YouTube verifies your channel identity. Views, likes, comments, shares and subscriptions do not earn Points or XP.</p>
      {loadError && <div role="alert" className="mb-4 rounded-lg border p-4">{loadError} <Button variant="outline" onClick={load}>Retry</Button></div>}
      <div className="grid gap-4 sm:grid-cols-2">
        {SERVICES.map((s) => {
          const conn = getConnection(s.key);
          const configured = config[s.key]?.configured === true;
          const isConnected = conn && conn.status === "connected";
          return (
            <div key={s.key} className="space-y-2"><ServiceCard
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
            {isConnected && config[s.key]?.linking_rewards_available === true && <Button variant="outline" disabled={claiming!==null || disconnecting!==null || connecting!==null} onClick={()=>claimReward(s.key)}>{claiming===s.key ? "Verifying ownership…" : "Check linking reward"}</Button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}