import React from "react";
import CrudPage from "@/components/perk/CrudPage";

export default function AdminRoles() {
  return (
    <CrudPage
      title="Roles & Permissions"
      description="Define staff roles and their permission sets. Additional roles can be added here."
      entity="Role"
      columns={[
        { key: "name", label: "Role" },
        { key: "description", label: "Description" },
        { key: "permissions", label: "Permissions", render: (i) => (i.permissions?.length || 0) + " permissions" },
        { key: "active", label: "Active", render: (i) => (i.active !== false ? "Yes" : "No") }
      ]}
      fields={[
        { key: "name", label: "Role Name", type: "text" },
        { key: "description", label: "Description", type: "textarea" },
        { key: "permissions", label: "Permissions (comma-separated)", type: "text" },
        { key: "display_order", label: "Display Order", type: "number" },
        { key: "active", label: "Active", type: "boolean" }
      ]}
    />
  );
}