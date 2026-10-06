import React from "react";
import { ShieldCheck, Eye, Bell, Smartphone, Plug, History, Cookie, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/perk/PageHeader";

const SECTIONS = [
  {
    icon: Smartphone,
    title: "Connected Devices",
    body: "You can view and revoke any device connected to your account at any time from the Devices page. A device is registered only when you explicitly sign in on it."
  },
  {
    icon: Plug,
    title: "Connected Services",
    body: "Third-party services (such as X or YouTube) are linked only with your explicit consent through OAuth, and only when those integrations are available. You can disconnect any service at any time."
  },
  {
    icon: Eye,
    title: "Activity Tracking",
    body: "Perk Sphere does not silently monitor your browsing. Activity is recorded only when you install and use a Perk Sphere client (such as the browser extension or mobile app), and only on destinations that Perk Sphere has classified. Those clients are not available yet; when they ship, tracking will require your explicit opt-in."
  },
  {
    icon: History,
    title: "Activity History",
    body: "Only activity relevant to earning rewards is stored, never your full browsing history. Your complete activity history is available to you at any time in the Activity section."
  },
  {
    icon: Bell,
    title: "Notifications",
    body: "You receive in-app notifications for points, XP, achievements, redemptions and account changes. Notifications stay inside the app unless you later enable extension or mobile delivery."
  },
  {
    icon: Cookie,
    title: "Public Destination Directory",
    body: "The list of participating destinations and their eligibility (Allowed, Neutral, Disallowed) is public. It does not reveal anything about you or your activity."
  }
];

export default function Privacy() {
  return (
    <div>
      <PageHeader title="Privacy" description="How Perk Sphere handles your data" />
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300">
        <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0" />
        <p>Perk Sphere is built with privacy in mind. We only collect activity required by the rewards system, and only from members who explicitly participate. No tracking happens unless you install and enable a Perk Sphere client.</p>
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
      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <Trash2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          You can delete your account and all associated data at any time from the Danger Zone on your <Link to="/profile" className="font-medium text-foreground hover:underline">Profile</Link> page.
        </p>
      </div>
    </div>
  );
}