import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { UserPlus, Trash2, ShieldCheck } from "lucide-react";
import PageHeader from "@/components/perk/PageHeader";
import StatusBadge from "@/components/perk/StatusBadge";
import EmptyState from "@/components/perk/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import ConfirmDialog from "@/components/perk/ConfirmDialog";

// Staff & role management. All changes go through the manageStaff backend function,
// which is server-authorised, audit-logged and escalation-proof (see shared/permissions.ts).
export default function AdminRoles() {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantForm, setGrantForm] = useState({ email: "", staff_role: "" });
  const [granting, setGranting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("manageStaff", { action: "list" });
      setData(res.data || res);
    } catch (e) {
      toast({ title: "Failed to load staff", description: e?.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const grant = async () => {
    if (!grantForm.email || !grantForm.staff_role) { toast({ title: "Email and role are required", variant: "destructive" }); return; }
    setGranting(true);
    try {
      await base44.functions.invoke("manageStaff", { action: "grant", email: grantForm.email, staff_role: grantForm.staff_role });
      toast({ title: "Role granted" });
      setGrantOpen(false);
      setGrantForm({ email: "", staff_role: "" });
      load();
    } catch (e) {
      toast({ title: "Grant failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setGranting(false);
    }
  };

  const revoke = async (member) => {
    try {
      await base44.functions.invoke("manageStaff", { action: "revoke", staff_id: member.id });
      toast({ title: "Role revoked" });
      load();
    } catch (e) {
      toast({ title: "Revoke failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  const members = data?.members || [];
  const grantable = data?.grantable_roles || [];
  const roles = data?.roles || [];

  return (
    <div>
      <PageHeader
        title="Roles & Permissions"
        description="Manage staff accounts and their roles. All changes are audit-logged and enforced server-side."
        actions={grantable.length > 0 ? <Button size="sm" onClick={() => setGrantOpen(true)}><UserPlus className="mr-1 h-4 w-4" /> Grant Role</Button> : null}
      />

      {/* Current staff */}
      <div className="mb-8">
        <h3 className="mb-3 text-sm font-semibold">Staff Members</h3>
        {members.length === 0 ? (
          <EmptyState title="No staff members" description="Grant a role to add staff." />
        ) : (
          <div className="space-y-3">
            {members.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.full_name || m.email}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={m.staff_role} />
                  {!m.active && <span className="text-xs text-muted-foreground">inactive</span>}
                  {m.can_manage && (
                    <ConfirmDialog
                      trigger={<Button variant="outline" size="sm" className="text-red-600"><Trash2 className="mr-1 h-3.5 w-3.5" /> Revoke</Button>}
                      title={`Revoke ${m.email}?`}
                      description="This removes their staff role and admin panel access. They will keep their regular member account."
                      confirmLabel="Revoke"
                      destructive
                      onConfirm={() => revoke(m)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Role catalog */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4" /> Role Catalog</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {roles.map((r) => (
            <div key={r.role} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{r.label}</p>
                <span className="text-xs text-muted-foreground">{r.permissions.length} permissions</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{r.description}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {r.permissions.map((p) => (
                  <span key={p} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{p}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grant dialog */}
      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Grant Staff Role</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Recipient Email</Label>
              <Input value={grantForm.email} onChange={(e) => setGrantForm({ ...grantForm, email: e.target.value })} className="mt-1.5" placeholder="user@example.com" />
              <p className="mt-1 text-xs text-muted-foreground">They must already have a Perk Sphere account.</p>
            </div>
            <div>
              <Label>Role</Label>
              <Select value={grantForm.staff_role} onValueChange={(v) => setGrantForm({ ...grantForm, staff_role: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select a role" /></SelectTrigger>
                <SelectContent>
                  {grantable.map((g) => <SelectItem key={g.role} value={g.role}>{g.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={grant} disabled={granting}>{granting ? "Granting..." : "Grant Role"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}