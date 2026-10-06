import React from "react";
import CrudPage from "@/components/perk/CrudPage";

export default function AdminSettings() {
  return (
    <CrudPage
      title="System Settings"
      description="Platform-wide configuration values."
      entity="Setting"
      columns={[
        { key: "key", label: "Key", mono: true },
        { key: "value", label: "Value" },
        { key: "category", label: "Category" },
        { key: "description", label: "Description" }
      ]}
      fields={[
        { key: "key", label: "Key", type: "text" },
        { key: "value", label: "Value", type: "text" },
        { key: "category", label: "Category", type: "text" },
        { key: "description", label: "Description", type: "textarea" }
      ]}
    />
  );
}