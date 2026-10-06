import React from "react";
import CrudPage from "@/components/perk/CrudPage";

export default function AdminRules() {
  return (
    <CrudPage
      title="Activity Rules"
      description="Data-driven rules that define how points and XP are awarded for activity."
      entity="Rule"
      columns={[
        { key: "name", label: "Name" },
        { key: "trigger_type", label: "Trigger", render: (i) => <span className="capitalize">{i.trigger_type?.replace(/_/g, " ")}</span> },
        { key: "platform", label: "Platform" },
        { key: "points_effect", label: "Points", align: "right" },
        { key: "xp_effect", label: "XP", align: "right" },
        { key: "enabled", label: "Enabled", render: (i) => (i.enabled !== false ? "Yes" : "No") }
      ]}
      fields={[
        { key: "name", label: "Name", type: "text" },
        { key: "description", label: "Description", type: "textarea" },
        { key: "trigger_type", label: "Trigger Type", type: "text" },
        { key: "platform", label: "Platform", type: "text" },
        { key: "target", label: "Target", type: "text" },
        { key: "points_effect", label: "Points Effect", type: "number" },
        { key: "xp_effect", label: "XP Effect", type: "number" },
        { key: "cooldown_seconds", label: "Cooldown (seconds)", type: "number" },
        { key: "daily_maximum", label: "Daily Maximum", type: "number" },
        { key: "per_user_maximum", label: "Per-User Maximum", type: "number" },
        { key: "start_date", label: "Start Date (ISO)", type: "text" },
        { key: "end_date", label: "End Date (ISO)", type: "text" },
        { key: "enabled", label: "Enabled", type: "boolean" },
        { key: "priority", label: "Priority", type: "number" }
      ]}
    />
  );
}