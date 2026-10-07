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
      if (res?.ok) {
        setDevices(res.data?.devices || []);
      } else {
        setError(res?.error?.message || "Unable to load connected devices.");
      }
    } catch (_e) {
      setError("Unable to load connected devices.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDevices(); }, [loadDevices]);

  const handleRevoke = async (deviceUuid) => {
    const res = await base44.functions.invoke("revokeBrowserDevice", { device_uuid: deviceUuid });
    if (!res?.ok) throw new Error(res?.error?.message || "Unable to revoke device.");
    await loadDevices();
  };

  return (
    <div className="mt-6 space-y-4">
      <h3 className="text-sm font-semibold">Browser Extension</h3>
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