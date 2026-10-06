import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/perk/PageHeader";
import RankBadge from "@/components/perk/RankBadge";
import StatusBadge from "@/components/perk/StatusBadge";
import { useTheme } from "@/lib/ThemeContext";
import { Sun, Moon, Monitor, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose
} from "@/components/ui/dialog";

export default function Profile() {
  const { user, checkUserAuth, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [form, setForm] = useState({
    username: user?.username || "",
    display_name: user?.display_name || "",
    profile_image: user?.profile_image || ""
  });
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await base44.entities.User.delete(user.id);
      toast({ title: "Account deleted" });
      await logout(false);
      navigate("/login", { replace: true });
    } catch (e) {
      toast({ title: "Deletion failed", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const themeOptions = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor }
  ];

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

          {/* Appearance / Theme */}
          <div className="mt-6 border-t border-border pt-6">
            <h3 className="text-sm font-semibold">Appearance</h3>
            <p className="mt-1 text-xs text-muted-foreground">Choose how Perk Sphere looks to you.</p>
            <div className="mt-3 flex gap-2">
              {themeOptions.map((opt) => {
                const Icon = opt.icon;
                const activeTheme = theme || "system";
                return (
                  <button
                    key={opt.value}
                    onClick={() => setTheme(opt.value)}
                    className={cn(
                      "flex flex-1 flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-medium transition-colors",
                      activeTheme === opt.value
                        ? "border-foreground bg-secondary text-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="mt-6 rounded-2xl border border-red-200 bg-red-50/50 p-6 dark:border-red-900/50 dark:bg-red-950/20">
        <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">Danger Zone</h3>
        <p className="mt-1 text-xs text-muted-foreground">Permanently delete your account and all associated data. This action cannot be undone.</p>
        <div className="mt-4">
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-1 h-4 w-4" /> Delete Account
          </Button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={(o) => !o && setDeleteOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account permanently?</DialogTitle>
            <DialogDescription>
              This will permanently delete your account, including all points, XP, activity history, redemptions, achievements, and connected services. This action <strong>cannot</strong> be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={deleting}>Cancel</Button></DialogClose>
            <Button variant="destructive" onClick={handleDeleteAccount} disabled={deleting}>
              {deleting ? "Deleting..." : "Yes, delete my account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}