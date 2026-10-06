import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Plus } from "lucide-react";
import PageHeader from "@/components/perk/PageHeader";
import StatusBadge from "@/components/perk/StatusBadge";
import EmptyState from "@/components/perk/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose
} from "@/components/ui/dialog";

const TYPES = [
  { value: "points_earning_paused", label: "Points Earning Paused" },
  { value: "xp_earning_paused", label: "XP Earning Paused" },
  { value: "redemption_disabled", label: "Reward Redemption Disabled" },
  { value: "account_review", label: "Account Review" },
  { value: "temporary_suspension", label: "Temporary Suspension" }
];

export default function AdminRestrictions() {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ userId: "", type: "points_earning_paused", reason: "", endDate: "", internalNote: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await base44.entities.Restriction.list('-created_date', 200);
      setItems(r || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.userId || !form.reason) { toast({ title: "User ID and reason are required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await base44.entities.Restriction.create({
        user_id: form.userId,
        type: form.type,
        reason: form.reason,
        start_date: new Date().toISOString(),
        end_date: form.endDate || null,
        active: true,
        internal_note: form.internalNote
      });
      toast({ title: "Restriction created" });
      setOpen(false);
      setForm({ userId: "", type: "points_earning_paused", reason: "", endDate: "", internalNote: "" });
      load();
    } catch (e) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (r) => {
    await base44.entities.Restriction.update(r.id, { active: !r.active });
    load();
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  return (
    <div>
      <PageHeader
        title="Restrictions"
        description={`${items.filter((i) => i.active).length} active restrictions`}
        actions={<Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" /> New Restriction</Button>}
      />
      {items.length === 0 ? (
        <EmptyState title="No restrictions" />
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div>
                <p className="text-sm font-medium capitalize">{r.type?.replace(/_/g, " ")}</p>
                <p className="text-xs text-muted-foreground">{r.reason}</p>
                <p className="mt-1 text-xs text-muted-foreground">User {r.user_id?.slice(0, 8)} · Until {r.end_date ? new Date(r.end_date).toLocaleDateString() : "indefinite"}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={r.active ? "active" : "inactive"} />
                <Button variant="outline" size="sm" onClick={() => toggle(r)}>{r.active ? "Deactivate" : "Reactivate"}</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Restriction</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>User ID</Label><Input value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="mt-1.5" /></div>
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Reason</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="mt-1.5" /></div>
            <div><Label>End Date (leave blank for indefinite)</Label><Input type="datetime-local" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="mt-1.5" /></div>
            <div><Label>Internal Note</Label><Textarea value={form.internalNote} onChange={(e) => setForm({ ...form, internalNote: e.target.value })} className="mt-1.5" /></div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={create} disabled={saving}>{saving ? "Saving..." : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}