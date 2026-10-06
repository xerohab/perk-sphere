import React from "react";
import CrudPage from "@/components/perk/CrudPage";

const CATEGORY_OPTS = [
  { value: "preferred", label: "Preferred" },
  { value: "partner", label: "Partner" },
  { value: "neutral", label: "Neutral" },
  { value: "rival", label: "Rival" },
  { value: "other", label: "Other" }
];
const ELIGIBILITY_OPTS = [
  { value: "allowed", label: "Allowed" },
  { value: "neutral", label: "Neutral" },
  { value: "disallowed", label: "Disallowed" }
];

export default function AdminTrackedAccounts() {
  return (
    <CrudPage
      title="Tracked Accounts"
      description="Social accounts tracked by Perk Sphere for activity analytics."
      entity="TrackedAccount"
      columns={[
        { key: "account_name", label: "Account" },
        { key: "platform", label: "Platform", render: (i) => <span className="capitalize">{i.platform}</span> },
        { key: "username", label: "Handle" },
        { key: "eligibility", label: "Eligibility", render: (i) => <span className="capitalize">{i.eligibility || "neutral"}</span> },
        { key: "category", label: "Category", render: (i) => <span className="capitalize">{i.category}</span> },
        { key: "active", label: "Active", render: (i) => (i.active !== false ? "Yes" : "No") }
      ]}
      fields={[
        { key: "platform", label: "Platform", type: "text" },
        { key: "account_name", label: "Account Name", type: "text" },
        { key: "username", label: "Username / Handle", type: "text" },
        { key: "profile_url", label: "Profile URL", type: "text" },
        { key: "external_platform_id", label: "External Platform ID", type: "text" },
        { key: "description", label: "Description", type: "textarea" },
        { key: "category", label: "Category", type: "select", options: CATEGORY_OPTS },
        { key: "eligibility", label: "Eligibility", type: "select", options: ELIGIBILITY_OPTS },
        { key: "active", label: "Active", type: "boolean" },
        { key: "publicly_visible", label: "Publicly Visible", type: "boolean" },
        { key: "tracking_enabled", label: "Tracking Enabled", type: "boolean" },
        { key: "points_eligible", label: "Points Eligible", type: "boolean" },
        { key: "xp_eligible", label: "XP Eligible", type: "boolean" },
        { key: "notes", label: "Notes", type: "textarea" }
      ]}
    />
  );
}