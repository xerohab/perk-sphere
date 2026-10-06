import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Send } from "lucide-react";
import PageHeader from "@/components/perk/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue
} from "@/components/ui/select";

export default function AdminNotifications() {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ userId: "", title: "", message: "" });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await base44.entities.User.list('-created_date', 500);
      setUsers(u || []);
    })();
  }, []);

  const send = async () => {
    if (!form.userId || !form.title) { toast({ title: "User and title required", variant: "destructive" }); return; }
    setSending(true);
    try {
      await base44.functions.invoke("adminWrite", {
        entity: "Notification", op: "create",
        data: { user_id: form.userId, type: "admin_message", title: form.title, message: form.message }
      });
      toast({ title: "Notification sent" });
      setForm({ userId: "", title: "", message: "" });
    } catch (e) {
      toast({ title: "Failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <PageHeader title="Notifications" description="Send a notification to a specific user" />
      <div className="max-w-lg rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <Label>Recipient</Label>
            <Select value={form.userId} onValueChange={(v) => setForm({ ...form, userId: v })}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select a user" /></SelectTrigger>
              <SelectContent>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.display_name || u.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1.5" /></div>
          <div><Label>Message</Label><Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="mt-1.5" /></div>
          <Button onClick={send} disabled={sending}><Send className="mr-1 h-4 w-4" /> {sending ? "Sending..." : "Send Notification"}</Button>
        </div>
      </div>
    </div>
  );
}