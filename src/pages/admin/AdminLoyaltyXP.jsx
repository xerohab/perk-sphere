import React from "react";
import CrudPage from "@/components/perk/CrudPage";

export default function AdminLoyaltyXP() {
  return (
    <CrudPage
      title="Loyalty Levels"
      description="Define XP thresholds for each loyalty rank. Users are ranked automatically from their XP."
      entity="LoyaltyLevel"
      sortBy="minimum_xp"
      columns={[
        { key: "name", label: "Name" },
        { key: "minimum_xp", label: "Min XP", align: "right" },
        { key: "display_order", label: "Order", align: "right" },
        { key: "active", label: "Active", render: (i) => (i.active !== false ? "Yes" : "No") }
      ]}
      fields={[
        { key: "name", label: "Name", type: "text" },
        { key: "minimum_xp", label: "Minimum XP", type: "number" },
        { key: "icon", label: "Icon (emoji or name)", type: "text" },
        { key: "description", label: "Description", type: "text" },
        { key: "display_order", label: "Display Order", type: "number" },
        { key: "active", label: "Active", type: "boolean" }
      ]}
    />
  );
}