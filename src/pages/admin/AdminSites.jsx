import React from "react";
import CrudPage from "@/components/perk/CrudPage";

const CATEGORY_OPTS = [
  { value: "preferred", label: "Preferred" },
  { value: "partner", label: "Partner" },
  { value: "neutral", label: "Neutral" },
  { value: "other", label: "Other" }
];
const STATUS_OPTS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "pending", label: "Pending" }
];
const ELIGIBILITY_OPTS = [
  { value: "allowed", label: "Allowed" },
  { value: "neutral", label: "Neutral" },
  { value: "disallowed", label: "Disallowed" }
];

export default function AdminSites() {
  return (
    <CrudPage
      title="Sites & Domains"
      description="Register websites participating in Perk Sphere."
      entity="Website"
      columns={[
        { key: "site_name", label: "Site" },
        { key: "domain", label: "Domain" },
        { key: "category", label: "Category", render: (i) => <span className="capitalize">{i.category}</span> },
        { key: "eligibility", label: "Eligibility", render: (i) => <span className="capitalize">{i.eligibility || "neutral"}</span> },
        { key: "status", label: "Status", render: (i) => <span className="capitalize">{i.status}</span> },
        { key: "tracking_enabled", label: "Tracking", render: (i) => (i.tracking_enabled !== false ? "On" : "Off") }
      ]}
      fields={[
        { key: "site_name", label: "Site Name", type: "text" },
        { key: "domain", label: "Domain", type: "text" },
        { key: "logo", label: "Logo URL", type: "text" },
        { key: "description", label: "Description", type: "textarea" },
        { key: "platform", label: "Platform", type: "text" },
        { key: "category", label: "Category", type: "select", options: CATEGORY_OPTS },
        { key: "eligibility", label: "Eligibility", type: "select", options: ELIGIBILITY_OPTS },
        { key: "status", label: "Status", type: "select", options: STATUS_OPTS },
        { key: "publicly_visible", label: "Publicly Visible", type: "boolean" },
        { key: "tracking_enabled", label: "Tracking Enabled", type: "boolean" },
        { key: "points_eligible", label: "Points Eligible", type: "boolean" },
        { key: "xp_eligible", label: "XP Eligible", type: "boolean" },
        { key: "default_points_rule", label: "Default Points", type: "number" },
        { key: "default_xp_rule", label: "Default XP", type: "number" },
        { key: "daily_maximum", label: "Daily Maximum", type: "number" },
        { key: "cooldown_seconds", label: "Cooldown (seconds)", type: "number" },
        { key: "notes", label: "Notes", type: "textarea" }
      ]}
    />
  );
}