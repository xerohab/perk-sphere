import React from "react";
import CrudPage from "@/components/perk/CrudPage";

export default function AdminAchievements() {
  return (
    <CrudPage
      title="Achievements"
      description="Badges users can unlock."
      entity="Achievement"
      columns={[
        { key: "name", label: "Name" },
        { key: "criteria_type", label: "Criteria", render: (i) => <span className="capitalize">{i.criteria_type?.replace(/_/g, " ")}</span> },
        { key: "criteria_value", label: "Value", align: "right" },
        { key: "active", label: "Active", render: (i) => (i.active !== false ? "Yes" : "No") }
      ]}
      fields={[
        { key: "name", label: "Name", type: "text" },
        { key: "description", label: "Description", type: "textarea" },
        { key: "icon", label: "Icon", type: "text" },
        { key: "criteria_type", label: "Criteria Type", type: "text" },
        { key: "criteria_value", label: "Criteria Value", type: "number" },
        { key: "hidden", label: "Hidden Achievement", type: "boolean" },
        { key: "active", label: "Active", type: "boolean" },
        { key: "display_order", label: "Display Order", type: "number" }
      ]}
    />
  );
}