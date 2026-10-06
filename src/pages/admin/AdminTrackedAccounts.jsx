import React from "react";
import CrudPage from "@/components/perk/CrudPage";

const CATEGORY_OPTS = [
  { value: "preferred", label: "Preferred" },
  { value: "partner", label: "Partner" },
  { value: "neutral", label: "Neutral" },
  { value: "rival", label: "Rival" },
  { value: "other", label: "Other" }
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
        { key: "category", label: "Category", render: (i) => <span className="capitalize">{i.category}</span> },
        { key: "active", label: "Active", render: (i) => (i.active !== false ? "Yes" : "No") }
      ]}
      fields={[
        { key: "platform", label: "Platform", type: "text" },
        { key: "account_name", label: "Account Name", type: "text" },
        { key: "username", label: "Username / Handle", type: "text" },
        { key: "profile_url", label: "Profile URL", type: "text" },
        { key: "external_platform_id", label: "External Platform ID", type: "text" },
        { key: "category", label: "Category", type: "select", options: CATEGORY_OPTS },
        { key: "active", label: "Active", type: "boolean" },
        { key: "notes", label: "Notes", type: "textarea" }
      ]}
    />
  );
}