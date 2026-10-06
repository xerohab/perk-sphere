import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import PageHeader from "@/components/perk/PageHeader";
import StatusBadge from "@/components/perk/StatusBadge";
import EmptyState from "@/components/perk/EmptyState";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose
} from "@/components/ui/dialog";

const STATUSES = ["pending", "approved", "fulfilled", "rejected", "cancelled", "refunded"];

export default function AdminRedemptions() {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ status: "", adminNotes: "", fulfilmentInfo: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await base44.entities.Redemption.list('-created_date', 500);
      setItems(r || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openEdit = (r) => { setEditing(r); setForm({ status: r.status, adminNotes: r.admin_notes || "", fulfilmentInfo: r.fulfilment_info || "" }); };

  const save = async () => {
    setSaving(true);
    try {
      await base44.functions.invoke("updateRedemption", {
        redemptionId: editing.id, status: form.status, adminNotes: form.adminNotes, fulfilmentInfo: form.fulfilmentInfo
      });
      toast({ title: "Redemption updated" });
      setEditing(null);
      load();
    } catch (e) {
      toast({ title: "Failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  return (
    <div>
      <PageHeader title="Redemptions" description={`${items.length} total · ${items.filter((i) => i.status === "pending").length} pending`} />
      {items.length === 0 ? (
        <EmptyState title="No redemptions yet" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Reward</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 text-right font-medium">Points</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium">{r.reward_name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.user_id?.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-right">{r.points_spent}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(r.created_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right"><Button variant="outline" size="sm" onClick={() => openEdit(r)}>Manage</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Manage Redemption</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="rounded-lg bg-secondary p-3 text-sm">
                <p className="font-medium">{editing.reward_name}</p>
                <p className="text-muted-foreground">{editing.points_spent} points · {new Date(editing.created_date).toLocaleDateString()}</p>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Admin Notes</Label>
                <Textarea value={form.adminNotes} onChange={(e) => setForm({ ...form, adminNotes: e.target.value })} className="mt-1.5" />
              </div>
              <div>
                <Label>Fulfilment Information</Label>
                <Textarea value={form.fulfilmentInfo} onChange={(e) => setForm({ ...form, fulfilmentInfo: e.target.value })} className="mt-1.5" />
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}