import React from "react";
import { Code2, ShoppingBag, Radio, FileText, CheckCircle2, Clock, ArrowRight } from "lucide-react";

// Catalog of integration kits/packages available to partner websites.
// The Universal API Kit is available now (documentation + HMAC signing spec).
// WordPress/WooCommerce and Streaming SDK packages require external development
// and are marked Coming Soon until the Linux API and partner-side packages are built.
const KITS = [
  {
    id: "universal_api",
    icon: Code2,
    name: "Universal API Kit",
    tagline: "Available now",
    status: "available",
    description: "HTTP + HMAC-SHA256 event submission to the Linux API. Works with any website or backend that can sign requests. This is the primary integration path.",
    delivers: [
      "Integration guide with endpoint and authentication spec",
      "Event payload schemas for all supported event types",
      "HMAC signing reference (signature canonical form, headers, replay protection)",
      "Per-partner credentials (key ID + secret) generated on registration"
    ],
    endpoint: "https://api.perksphere.org/events"
  },
  {
    id: "wordpress_woocommerce",
    icon: ShoppingBag,
    name: "WordPress / WooCommerce Package",
    tagline: "Coming soon",
    status: "coming_soon",
    description: "Drop-in WordPress plugin for WooCommerce stores. Automatically fires registration, purchase, subscription, and refund events without custom signing code.",
    delivers: [
      "WordPress plugin (external development required)",
      "WooCommerce order and subscription hooks",
      "Automatic user-account linking",
      "Admin settings panel for credential entry"
    ],
    endpoint: "https://api.perksphere.org/events"
  },
  {
    id: "streaming_sdk",
    icon: Radio,
    name: "Streaming SDK",
    tagline: "Coming soon",
    status: "coming_soon",
    description: "SDK for streaming platforms to emit watch-progress, stream-start, and stream-end events with accurate eligible-seconds tracking.",
    delivers: [
      "Streaming SDK (external development required)",
      "Watch-progress heartbeat events",
      "Broadcast lifecycle events (started, ended)",
      "Eligible-seconds calculation guidance"
    ],
    endpoint: "https://api.perksphere.org/events"
  }
];

const STATUS_BADGE = {
  available: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  coming_soon: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  setup_required: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400"
};

export default function PartnerIntegrationKits({ onSelectKit }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Integration Architecture</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Partner websites send authenticated events to the Linux API at <code className="rounded bg-secondary px-1 py-0.5 text-xs">api.perksphere.org</code>.
          The Linux API validates credentials, prevents replay, and delivers trusted events to Perk Sphere.
          Perk Sphere is the sole reward authority — no partner or Linux API event can issue Points or XP directly.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-lg bg-secondary px-2.5 py-1 font-medium">Partner Website</span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="rounded-lg bg-indigo-100 px-2.5 py-1 font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400">Linux API</span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="rounded-lg bg-secondary px-2.5 py-1 font-medium">Perk Sphere (rewards)</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {KITS.map((kit) => {
          const Icon = kit.icon;
          const isAvailable = kit.status === "available";
          return (
            <div key={kit.id} className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="rounded-lg bg-secondary p-2.5">
                  <Icon className="h-5 w-5 text-foreground" />
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[kit.status]}`}>{kit.tagline}</span>
              </div>
              <h3 className="mt-3 text-base font-semibold">{kit.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{kit.description}</p>
              <ul className="mt-3 space-y-1.5">
                {kit.delivers.map((d) => (
                  <li key={d} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    {isAvailable ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" /> : <Clock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />}
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 rounded-lg bg-secondary/60 p-2">
                <p className="text-xs font-medium text-muted-foreground">Endpoint</p>
                <p className="mt-0.5 font-mono text-xs">{kit.endpoint}</p>
              </div>
              {isAvailable && onSelectKit && (
                <button
                  onClick={() => onSelectKit(kit.id)}
                  className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-accent"
                >
                  <FileText className="h-3.5 w-3.5" /> Use this kit
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}