import React from "react";
import PageHeader from "@/components/perk/PageHeader";
import BrowserExtensionSection from "@/components/perk/BrowserExtensionSection";

export default function BrowserExtension() {
  return (
    <div>
      <PageHeader
        title="Browser Extension"
        description="Install the Perk Sphere extension, pair your browser, and manage connected devices."
      />
      <BrowserExtensionSection />
    </div>
  );
}