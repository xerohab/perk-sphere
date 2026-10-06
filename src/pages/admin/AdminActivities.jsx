import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Plus } from "lucide-react";
import PageHeader from "@/components/perk/PageHeader";
import StatusBadge from "@/components/perk/StatusBadge";
import ResponsiveTable from "@/components/perk/ResponsiveTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose
} from "@/components/ui/dialog";

const SOURCES = [
  { value: "admin_entered", label: "Admin Entered" },
  { value: "extension_detected", label: "Extension Detected" },
  { value: "api_verified", label: "API Verified" },
  { value: "unverified", label: "Unverified" }
];

export default function AdminActivities() {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ userId: "", platform: "", activityType: "", targetAccount: "", targetUrl: "", detectionSource: "admin_entered" });
  const [saving, setSaving] = useState(false);

  const load = async (silent) => {
    if (!silent) setLoading(true);
    try {
      const a = await base44.entities.Activity.list('-created_date', 200);
      setItems(a || []);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.userId || !form.platform || !form.activityType) {
      toast({ title: "User ID, platform and activity type are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await base44.functions.invoke("recordActivity", {
        userId: form.userId, platform: form.platform, activity_type: form.activityType,
        target_account: form.targetAccount, target_url: form.targetUrl, detection_source: form.detectionSource
      });
      toast({ title: "Activity recorded" });
      setOpen(false);
      setForm({ userId: "", platform: "", activityType: "", targetAccount: "", targetUrl: "", detectionSource: "admin_entered" });
      load(true);
    } catch (e) {
      toast({ title: "Failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const cols = [
    { key: "platform", label: "Platform", render: (a) => <span className="capitalize">{a.platform}</span> },
    { key: "activity_type", label: "Type", render: (a) => <span className="capitalize">{a.activity_type?.replace(/_/g, " ")}</span> },
    { key: "target", label: "Target", render: (a) => a.target_account || a.target || "—" },
    { key: "user_id", label: "User", mono: true, render: (a) => a.user_id?.slice(0, 8) },
    { key: "created_date", label: "Date", render: (a) => new Date(a.created_date).toLocaleString() },
    { key: "verification_status", label: "Source", render: (a) => <StatusBadge status={a.verification_status} /> }
  ];

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  return (
    <div>
      <PageHeader title="Activities" description={`${items.length} recorded activity events`} actions={<Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" /> Record Activity</Button>} />
      <ResponsiveTable columns={cols} rows={items} emptyTitle="No activities recorded" />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Activity</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>User ID</Label><Input value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="mt-1.5" placeholder="Paste user ID" /></div>
            <div><Label>Platform</Label><Input value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className="mt-1.5" placeholder="x, youtube, web..." /></div>
            <div><Label>Activity Type</Label><Input value={form.activityType} onChange={(e) => setForm({ ...form, activityType: e.target.value })} className="mt-1.5" placeholder="profile_visit, like_detected..." /></div>
            <div><Label>Target Account</Label><Input value={form.targetAccount} onChange={(e) => setForm({ ...form, targetAccount: e.target.value })} className="mt-1.5" /></div>
            <div><Label>Target URL</Label><Input value={form.targetUrl} onChange={(e) => setForm({ ...form, targetUrl: e.target.value })} className="mt-1.5" /></div>
            <div><Label>Detection Source</Label><Select value={form.detectionSource} onValueChange={(v) => setForm({ ...form, detectionSource: v })}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent>{SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={create} disabled={saving}>{saving ? "Saving..." : "Record"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}