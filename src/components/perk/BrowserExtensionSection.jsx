import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import BrowserExtensionDownloadCard from "./BrowserExtensionDownloadCard";
import BrowserPairingCard from "./BrowserPairingCard";
import BrowserDevicesCard from "./BrowserDevicesCard";

export default function BrowserExtensionSection() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("listBrowserDevices", {});
      const body = res?.data ?? res;
      if (body?.ok) {
        setDevices(body.data?.devices || []);
      } else {
        setError(body?.error?.message || "Unable to load connected devices.");
      }
    } catch (e) {
      const msg = e?.response?.data?.error?.message || e?.data?.error?.message;
      setError(msg || "Unable to load connected devices.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDevices(); }, [loadDevices]);

  const handleRevoke = async (deviceUuid) => {
    try {
      const res = await base44.functions.invoke("revokeBrowserDevice", { device_uuid: deviceUuid });
      const body = res?.data ?? res;
      if (!body?.ok) throw new Error(body?.error?.message || "Unable to revoke device.");
    } catch (e) {
      const msg = e?.response?.data?.error?.message || e?.data?.error?.message;
      throw new Error(msg || e?.message || "Unable to revoke device.");
    }
    await loadDevices();
  };

  return (
    <div className="space-y-4">
      <BrowserExtensionDownloadCard devices={devices} />
      <BrowserPairingCard />
      <BrowserDevicesCard
        devices={devices}
        loading={loading}
        error={error}
        onRevoke={handleRevoke}
        onRefresh={loadDevices}
      />
    </div>
  );
}