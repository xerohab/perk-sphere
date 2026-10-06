import React from "react";
import CrudPage from "@/components/perk/CrudPage";

export default function AdminRewards() {
  return (
    <CrudPage
      title="Rewards"
      description="Manage the rewards catalogue available in the user store."
      entity="Reward"
      columns={[
        { key: "name", label: "Name" },
        { key: "points_cost", label: "Cost", align: "right" },
        { key: "stock_available", label: "Stock", align: "right", render: (i) => (i.unlimited_stock ? "Unlimited" : i.stock_available ?? 0) },
        { key: "active", label: "Active", render: (i) => (i.active !== false ? "Yes" : "No") }
      ]}
      fields={[
        { key: "name", label: "Name", type: "text" },
        { key: "image", label: "Image URL", type: "text" },
        { key: "description", label: "Description", type: "textarea" },
        { key: "points_cost", label: "Points Cost", type: "number" },
        { key: "required_rank", label: "Required Rank (optional)", type: "text" },
        { key: "stock_available", label: "Stock Available", type: "number" },
        { key: "unlimited_stock", label: "Unlimited Stock", type: "boolean" },
        { key: "max_redemptions_per_user", label: "Max Redemptions Per User (0 = unlimited)", type: "number" },
        { key: "start_date", label: "Start Date (ISO)", type: "text" },
        { key: "end_date", label: "End Date (ISO)", type: "text" },
        { key: "manual_approval_required", label: "Manual Approval Required", type: "boolean" },
        { key: "active", label: "Active", type: "boolean" },
        { key: "terms", label: "Terms", type: "textarea" }
      ]}
    />
  );
}