import React from "react";
import { ShieldCheck, Eye, Bell, Smartphone, Plug, History } from "lucide-react";
import PageHeader from "@/components/perk/PageHeader";

const SECTIONS = [
  { icon: Smartphone, title: "Connected Devices", body: "You can view and revoke any device connected to your account at any time. Devices are registered only when you explicitly connect a Perk Sphere client." },
  { icon: Plug, title: "Connected Services", body: "Third-party services (such as X or YouTube) are linked only with your explicit consent via OAuth. You can disconnect any service at any time." },
  { icon: Eye, title: "Tracked Activity", body: "Perk Sphere records activity only on participating websites and tracked social accounts. We do not collect your full browsing history. Only activity relevant to earning rewards is stored." },
  { icon: History, title: "Activity History", body: "Your full activity history is available to you and can be reviewed at any time in the Activity section." },
  { icon: Bell, title: "Notifications", body: "You receive notifications for points, XP, achievements, redemptions and account changes. These stay within the app unless you enable extension or mobile delivery later." }
];

export default function Privacy() {
  return (
    <div>
      <PageHeader title="Privacy" description="How Perk Sphere handles your data" />
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
        <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0" />
        <p>Perk Sphere is built with privacy in mind. We only collect activity required by the rewards system, and only from users who explicitly participate. External tracking integrations are added with your explicit consent.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.title} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-secondary p-2.5 text-muted-foreground"><Icon className="h-5 w-5" /></div>
                <h3 className="text-sm font-semibold">{s.title}</h3>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{s.body}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}