import React from "react";
import CrudPage from "@/components/perk/CrudPage";

export default function AdminCampaigns() {
  return (
    <CrudPage
      title="Campaigns"
      description="Temporary promotions and activities."
      entity="Campaign"
      columns={[
        { key: "name", label: "Name" },
        { key: "start_date", label: "Start", render: (i) => i.start_date ? new Date(i.start_date).toLocaleDateString() : "—" },
        { key: "end_date", label: "End", render: (i) => i.end_date ? new Date(i.end_date).toLocaleDateString() : "—" },
        { key: "active", label: "Active", render: (i) => (i.active !== false ? "Yes" : "No") }
      ]}
      fields={[
        { key: "name", label: "Campaign Name", type: "text" },
        { key: "description", label: "Description", type: "textarea" },
        { key: "image", label: "Image URL", type: "text" },
        { key: "start_date", label: "Start Date (ISO)", type: "text" },
        { key: "end_date", label: "End Date (ISO)", type: "text" },
        { key: "point_rules", label: "Point Rules", type: "number" },
        { key: "xp_rules", label: "XP Rules", type: "number" },
        { key: "per_user_limit", label: "Per-User Limit", type: "number" },
        { key: "global_limit", label: "Global Limit", type: "number" },
        { key: "active", label: "Active", type: "boolean" }
      ]}
    />
  );
}