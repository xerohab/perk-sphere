import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { AlertTriangle, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { TASK_TYPES, COMPLETION_LIMITS, REWARD_TYPES, VERIFICATION_MODES } from "@/lib/task-utils";

const STEPS = ["Information", "Destination", "Requirements", "Reward", "Limits", "Schedule", "Review"];
const VIEWING_TYPES = ["watch_video", "live_stream", "spend_time"];

const empty = {
  name: "", description: "", image: "", task_type: "visit_website",
  destination_id: "", destination_type: "", destination_name: "", destination_platform: "",
  content_id: "", content_url: "", content_title: "", channel_name: "",
  required_seconds: 0, required_percentage: 0, require_continuous: false,
  event_start: "", event_end: "", available_from: "", available_until: "", timezone: "",
  points_reward: 0, xp_reward: 0, achievement_id: "", reward_type: "none",
  completion_limit_type: "once_ever", max_completions: 0, cooldown_seconds: 0,
  verification_mode: "client_assisted",
  active: true, publicly_visible: true, featured: false, archived: false, terms: ""
};

export default function TaskWizard({ open, onClose, editing, onSaved }) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(empty);
  const [destinations, setDestinations] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [disallowedWarn, setDisallowedWarn] = useState(false);
  const [confirmDisallowed, setConfirmDisallowed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(0);
      setForm(editing ? { ...empty, ...editing } : empty);
      setConfirmDisallowed(false);
      setDisallowedWarn(false);
      (async () => {
        const [w, a, ach] = await Promise.all([
          base44.entities.Website.list('-updated_date', 500),
          base44.entities.TrackedAccount.list('-updated_date', 500),
          base44.entities.Achievement.list('display_order', 100)
        ]);
        const dests = [
          ...(w || []).map((x) => ({ id: x.id, type: "website", name: x.site_name || x.domain, platform: x.platform || "Website", eligibility: x.eligibility, enabled: x.status !== "inactive" && x.tracking_enabled !== false })),
          ...(a || []).map((x) => ({ id: x.id, type: "tracked_account", name: x.account_name || x.username, platform: x.platform, eligibility: x.eligibility, enabled: x.active !== false && x.tracking_enabled !== false }))
        ];
        setDestinations(dests);
        setAchievements(ach || []);
      })();
    }
  }, [open, editing]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const isViewing = VIEWING_TYPES.includes(form.task_type);
  const isLive = form.task_type === "live_stream";

  const selectDest = (id) => {
    const d = destinations.find((x) => x.id === id);
    if (!d) return;
    set("destination_id", d.id);
    set("destination_type", d.type);
    set("destination_name", d.name);
    set("destination_platform", d.platform);
    setDisallowedWarn(d.eligibility === "disallowed");
    if (d.eligibility !== "disallowed") setConfirmDisallowed(false);
  };

  const save = async () => {
    if (!form.name) { toast({ title: "Name is required", variant: "destructive" }); setStep(0); return; }
    if (!form.task_type) { toast({ title: "Task type is required", variant: "destructive" }); setStep(0); return; }
    if (form.verification_mode === "trusted_automatic") {
      const d = destinations.find((x) => x.id === form.destination_id);
      if (!d || d.eligibility !== "allowed" || !d.enabled) {
        toast({ title: "Trusted Automatic requires an Allowed, enabled destination", variant: "destructive" });
        setStep(1);
        return;
      }
    }
    setSaving(true);
    try {
      const payload = { ...form };
      // Clean empty date strings
      ["event_start", "event_end", "available_from", "available_until"].forEach((k) => { if (!payload[k]) delete payload[k]; });
      ["required_seconds", "required_percentage", "max_completions", "cooldown_seconds", "points_reward", "xp_reward"].forEach((k) => { payload[k] = Number(payload[k]) || 0; });
      const action = editing ? "update" : "create";
      await base44.functions.invoke("manageTask", { action, taskId: editing?.id, data: payload, confirmDisallowed });
      toast({ title: editing ? "Task updated" : "Task created" });
      onSaved?.();
      onClose();
    } catch (e) {
      const data = e?.response?.data || {};
      if (data.error === "disallowed_destination") {
        toast({ title: "Disallowed destination", description: data.message, variant: "destructive" });
        setStep(1);
      } else {
        toast({ title: "Failed", description: data.error || e.message, variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const canNext = () => {
    if (step === 0) return !!form.name && !!form.task_type;
    if (step === 1) {
      if (form.verification_mode === "trusted_automatic" && form.destination_id) {
        const d = destinations.find((x) => x.id === form.destination_id);
        if (!d || d.eligibility !== "allowed" || !d.enabled) return false;
      }
      return !disallowedWarn || confirmDisallowed;
    }
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Edit Task" : "Create New Task"}</DialogTitle></DialogHeader>

        {/* Step indicator */}
        <div className="flex flex-wrap gap-1">
          {STEPS.map((s, i) => (
            <button key={s} onClick={() => setStep(i)} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-secondary text-foreground" : "bg-secondary/50 text-muted-foreground"}`}>
              {i + 1}. {s}
            </button>
          ))}
        </div>

        <div className="space-y-4 py-2">
          {/* Step 1: Information */}
          {step === 0 && (
            <>
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} className="mt-1.5" placeholder="Watch Monday Night Breakdown" /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} className="mt-1.5" /></div>
              <div><Label>Image URL (optional)</Label><Input value={form.image} onChange={(e) => set("image", e.target.value)} className="mt-1.5" placeholder="https://..." /></div>
              <div>
                <Label>Task Type</Label>
                <Select value={form.task_type} onValueChange={(v) => set("task_type", v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{TASK_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Step 2: Destination */}
          {step === 1 && (
            <>
              <div>
                <Label>Destination</Label>
                <Select value={form.destination_id} onValueChange={selectDest}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select a destination" /></SelectTrigger>
                  <SelectContent>
                    {destinations.map((d) => <SelectItem key={d.id} value={d.id}>{d.name} ({d.platform}) — {d.eligibility === "allowed" ? "Allowed" : d.eligibility === "disallowed" ? "Disallowed" : "Neutral"}{!d.enabled ? " · disabled" : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {disallowedWarn && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
                  <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">This destination is classified as Disallowed</p>
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Rewarding users for a disallowed destination is unusual. The destination status will not be changed. Confirm to proceed.</p>
                    <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmDisallowed} onChange={(e) => setConfirmDisallowed(e.target.checked)} /> I understand — create this task anyway</label>
                  </div>
                </div>
              )}
              {form.destination_name && !disallowedWarn && <p className="text-xs text-muted-foreground">Selected: {form.destination_name} ({form.destination_platform})</p>}
              {form.verification_mode === "trusted_automatic" && form.destination_id && (() => {
                const d = destinations.find((x) => x.id === form.destination_id);
                if (!d || d.eligibility !== "allowed" || !d.enabled) {
                  return (
                    <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-700 dark:bg-red-950/30">
                      <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
                      <div>
                        <p className="text-sm font-medium text-red-800 dark:text-red-300">Trusted Automatic requires an Allowed, enabled destination</p>
                        <p className="mt-1 text-xs text-red-700 dark:text-red-400">This task will not be delivered to browser extensions until its destination is classified as Allowed and enabled. Update the destination in the Destinations admin page first.</p>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </>
          )}

          {/* Step 3: Requirements */}
          {step === 2 && (
            <>
              {isViewing && (
                <>
                  {(form.task_type === "watch_video" || isLive) && (
                    <div><Label>{isLive ? "Channel / Stream Name" : "Video Title"}</Label><Input value={isLive ? form.channel_name : form.content_title} onChange={(e) => set(isLive ? "channel_name" : "content_title", e.target.value)} className="mt-1.5" /></div>
                  )}
                  <div><Label>Content / Video ID</Label><Input value={form.content_id} onChange={(e) => set("content_id", e.target.value)} className="mt-1.5" placeholder="video id, stream id..." /></div>
                  <div><Label>Content / Stream URL</Label><Input value={form.content_url} onChange={(e) => set("content_url", e.target.value)} className="mt-1.5" placeholder="https://..." /></div>
                  <div><Label>Required Watch Time (seconds)</Label><Input type="number" value={form.required_seconds} onChange={(e) => set("required_seconds", e.target.value)} className="mt-1.5" placeholder="600 = 10 minutes" /></div>
                  {form.task_type === "watch_video" && <div><Label>Required Percentage (0-100, optional)</Label><Input type="number" value={form.required_percentage} onChange={(e) => set("required_percentage", e.target.value)} className="mt-1.5" placeholder="80" /></div>}
                  <div className="flex items-center justify-between rounded-lg border border-border p-3"><div><Label>Require continuous viewing</Label><p className="text-xs text-muted-foreground">Reject if the user skips or leaves</p></div><Switch checked={form.require_continuous} onCheckedChange={(c) => set("require_continuous", c)} /></div>
                </>
              )}
              {isLive && (
                <>
                  <div><Label>Event Start</Label><Input type="datetime-local" value={form.event_start} onChange={(e) => set("event_start", e.target.value)} className="mt-1.5" /></div>
                  <div><Label>Event End</Label><Input type="datetime-local" value={form.event_end} onChange={(e) => set("event_end", e.target.value)} className="mt-1.5" /></div>
                </>
              )}
              {!isViewing && (
                <>
                  <div><Label>Target URL (optional)</Label><Input value={form.content_url} onChange={(e) => set("content_url", e.target.value)} className="mt-1.5" placeholder="https://..." /></div>
                  {form.task_type === "spend_time" && <div><Label>Required Active Time (seconds)</Label><Input type="number" value={form.required_seconds} onChange={(e) => set("required_seconds", e.target.value)} className="mt-1.5" /></div>}
                  <p className="text-xs text-muted-foreground">Non-viewing tasks are verified when the activity is recorded and the task is completed through the secure completion flow.</p>
                </>
              )}
            </>
          )}

          {/* Step 4: Reward */}
          {step === 3 && (
            <>
              <div>
                <Label>Reward Type</Label>
                <Select value={form.reward_type} onValueChange={(v) => set("reward_type", v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{REWARD_TYPES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {(form.reward_type === "points" || form.reward_type === "points_xp") && <div><Label>Points Reward</Label><Input type="number" value={form.points_reward} onChange={(e) => set("points_reward", e.target.value)} className="mt-1.5" /></div>}
              {(form.reward_type === "xp" || form.reward_type === "points_xp") && <div><Label>XP Reward</Label><Input type="number" value={form.xp_reward} onChange={(e) => set("xp_reward", e.target.value)} className="mt-1.5" /></div>}
              {form.reward_type === "achievement" && (
                <div>
                  <Label>Achievement</Label>
                  <Select value={form.achievement_id} onValueChange={(v) => set("achievement_id", v)}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select achievement" /></SelectTrigger>
                    <SelectContent>{achievements.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <p className="text-xs text-muted-foreground">All rewards are issued through the authoritative server-side ledger. The frontend never modifies balances directly.</p>
            </>
          )}

          {/* Step 5: Limits */}
          {step === 4 && (
            <>
              <div>
                <Label>Completion Limit</Label>
                <Select value={form.completion_limit_type} onValueChange={(v) => set("completion_limit_type", v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{COMPLETION_LIMITS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {form.completion_limit_type === "custom_max" && <div><Label>Maximum Completions</Label><Input type="number" value={form.max_completions} onChange={(e) => set("max_completions", e.target.value)} className="mt-1.5" /></div>}
              {form.completion_limit_type === "unlimited" && <div><Label>Cooldown (seconds)</Label><Input type="number" value={form.cooldown_seconds} onChange={(e) => set("cooldown_seconds", e.target.value)} className="mt-1.5" placeholder="3600 = 1 hour" /></div>}
              <div>
                <Label>Verification Mode</Label>
                <Select value={form.verification_mode} onValueChange={(v) => set("verification_mode", v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{VERIFICATION_MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">Trusted Automatic completes the task server-side when the Linux API reports enough verified activity. Client-Assisted requires the user's device to verify viewing. Manual needs an admin.</p>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3"><Label>Active</Label><Switch checked={form.active} onCheckedChange={(c) => set("active", c)} /></div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3"><Label>Publicly Visible</Label><Switch checked={form.publicly_visible} onCheckedChange={(c) => set("publicly_visible", c)} /></div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3"><Label>Featured (shown on homepage)</Label><Switch checked={form.featured} onCheckedChange={(c) => set("featured", c)} /></div>
            </>
          )}

          {/* Step 6: Schedule */}
          {step === 5 && (
            <>
              <div><Label>Available From</Label><Input type="datetime-local" value={form.available_from} onChange={(e) => set("available_from", e.target.value)} className="mt-1.5" /></div>
              <div><Label>Available Until</Label><Input type="datetime-local" value={form.available_until} onChange={(e) => set("available_until", e.target.value)} className="mt-1.5" /></div>
              <div><Label>Timezone</Label><Input value={form.timezone} onChange={(e) => set("timezone", e.target.value)} className="mt-1.5" placeholder="Europe/London" /></div>
              {isLive && <p className="text-xs text-muted-foreground">Livestream event window is set in the Requirements step. Availability controls when the task appears.</p>}
              <div><Label>Terms (optional)</Label><Textarea value={form.terms} onChange={(e) => set("terms", e.target.value)} className="mt-1.5" /></div>
            </>
          )}

          {/* Step 7: Review */}
          {step === 6 && (
            <div className="space-y-2 text-sm">
              <h3 className="font-semibold">Review</h3>
              <p><span className="text-muted-foreground">Name:</span> {form.name}</p>
              <p><span className="text-muted-foreground">Type:</span> {TASK_TYPES.find((t) => t.value === form.task_type)?.label}</p>
              <p><span className="text-muted-foreground">Destination:</span> {form.destination_name || "—"}</p>
              {isViewing && <p><span className="text-muted-foreground">Required watch:</span> {form.required_seconds}s</p>}
              <p><span className="text-muted-foreground">Reward:</span> {form.reward_type === "none" ? "None" : `${form.points_reward > 0 ? form.points_reward + " pts " : ""}${form.xp_reward > 0 ? form.xp_reward + " XP" : ""}${form.achievement_id ? " Achievement" : ""}`}</p>
              <p><span className="text-muted-foreground">Limit:</span> {COMPLETION_LIMITS.find((c) => c.value === form.completion_limit_type)?.label}</p>
              <p><span className="text-muted-foreground">Verification:</span> {VERIFICATION_MODES.find((m) => m.value === form.verification_mode)?.label}</p>
              <p><span className="text-muted-foreground">Active:</span> {form.active ? "Yes" : "No"} · <span className="text-muted-foreground">Featured:</span> {form.featured ? "Yes" : "No"}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex !justify-between">
          <Button variant="outline" onClick={() => step > 0 ? setStep(step - 1) : onClose()}><ChevronLeft className="mr-1 h-4 w-4" /> {step > 0 ? "Back" : "Cancel"}</Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext()}>Next <ChevronRight className="ml-1 h-4 w-4" /></Button>
          ) : (
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : <><Check className="mr-1 h-4 w-4" /> {editing ? "Save Changes" : "Publish Task"}</>}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}