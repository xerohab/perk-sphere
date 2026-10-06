import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { ShieldCheck, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

// Fetches the signed-in account's staff access and gates the admin panel.
// Renders a bootstrap "Claim Super Admin" screen when no Super Admin exists,
// or a "no staff role" notice otherwise. On success, calls children with the
// access object so the layout can filter navigation by permission.
export default function AccessGate({ children }) {
  const { toast } = useToast();
  const [access, setAccess] = useState(null);
  const [claiming, setClaiming] = useState(false);

  const load = async () => {
    try {
      const res = await base44.functions.invoke("getMyAccess", {});
      setAccess(res.data || res);
    } catch (e) {
      setAccess({ ok: false, error: e?.response?.data?.error || e.message });
    }
  };

  useEffect(() => { load(); }, []);

  const claim = async () => {
    setClaiming(true);
    try {
      await base44.functions.invoke("manageStaff", { action: "claim" });
      await load();
      toast({ title: "Super Admin claimed" });
    } catch (e) {
      toast({ title: "Claim failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setClaiming(false);
    }
  };

  if (!access) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (access.is_staff) {
    return children(access);
  }

  if (access.can_claim_super_admin) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400"><ShieldCheck className="h-6 w-6" /></div>
        <h2 className="mt-4 text-lg font-semibold">Claim Super Admin</h2>
        <p className="mt-2 text-sm text-muted-foreground">No Super Admin has been set up yet. As the app owner, claim Super Admin to manage staff roles and the platform.</p>
        <Button className="mt-5" onClick={claim} disabled={claiming}>{claiming ? "Claiming..." : "Claim Super Admin"}</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"><Lock className="h-6 w-6" /></div>
      <h2 className="mt-4 text-lg font-semibold">No staff role assigned</h2>
      <p className="mt-2 text-sm text-muted-foreground">Your account has admin access, but no staff role has been assigned to it yet. Ask a Super Admin to grant you a role from Roles & Permissions.</p>
    </div>
  );
}