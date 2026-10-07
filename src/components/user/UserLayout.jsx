import React, { Suspense } from "react";
import { Outlet } from "react-router-dom";
import {
  LayoutDashboard, Gift, Coins, Activity, Award, History, TrendingUp,
  Bell, Plug, Smartphone, User, ShieldCheck, Target, Globe
} from "lucide-react";
import SidebarLayout from "@/components/perk/SidebarLayout";
import PageTransition, { ContentSpinner } from "@/components/perk/PageTransition";

const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Earn", path: "/earn", icon: Coins },
  { label: "Tasks", path: "/tasks", icon: Target },
  { label: "Rewards", path: "/rewards", icon: Gift },
  { label: "Activity", path: "/activity", icon: Activity },
  { label: "Achievements", path: "/achievements", icon: Award },
  { label: "Points History", path: "/points-history", icon: History },
  { label: "Loyalty", path: "/loyalty", icon: TrendingUp },
  { label: "Notifications", path: "/notifications", icon: Bell },
  { label: "Connected Services", path: "/connected-services", icon: Plug },
  { label: "Devices", path: "/devices", icon: Smartphone },
  { label: "Browser Extension", path: "/browser-extension", icon: Globe },
  { label: "Profile", path: "/profile", icon: User },
  { label: "Privacy", path: "/privacy", icon: ShieldCheck }
];

export default function UserLayout() {
  return (
    <SidebarLayout brand="Perk Sphere" accentFrom="#6366f1" accentTo="#8b5cf6" navItems={navItems}>
      <PageTransition>
        <Suspense fallback={<ContentSpinner />}>
          <Outlet />
        </Suspense>
      </PageTransition>
    </SidebarLayout>
  );
}