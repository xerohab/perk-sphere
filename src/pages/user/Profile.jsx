import React, { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/perk/PageHeader";
import RankBadge from "@/components/perk/RankBadge";
import StatusBadge from "@/components/perk/StatusBadge";

export default function Profile() {
  const { user, checkUserAuth } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({
    username: user?.username || "",
    display_name: user?.display_name || "",
    profile_image: user?.profile_image || ""
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe(form);
      await checkUserAuth();
      toast({ title: "Profile updated" });
    } catch (e) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Profile" description="Your Perk Sphere account details" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-2xl font-bold text-white">
              {(form.display_name || user?.email || "P").charAt(0).toUpperCase()}
            </div>
            <p className="mt-3 text-base font-semibold">{form.display_name || user?.email}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {user?.loyalty_rank && <RankBadge rank={user.loyalty_rank} />}
              <StatusBadge status={user?.account_status || "active"} />
            </div>
          </div>
          <div className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Points</span><span className="font-semibold">{(user?.points_balance || 0).toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Loyalty XP</span><span className="font-semibold">{(user?.loyalty_xp || 0).toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Joined</span><span className="text-muted-foreground">{user?.created_date ? new Date(user.created_date).toLocaleDateString() : "—"}</span></div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-semibold">Edit Profile</h3>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="display_name">Display Name</Label>
              <Input id="display_name" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="profile_image">Profile Image URL</Label>
              <Input id="profile_image" value={form.profile_image} onChange={(e) => setForm({ ...form, profile_image: e.target.value })} className="mt-1.5" placeholder="https://..." />
            </div>
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}