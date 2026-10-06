import React from "react";
import { Outlet, Navigate } from "react-router-dom";
import {
  LayoutDashboard, Users, Coins, TrendingUp, Gift, ClipboardCheck, Globe,
  AtSign, Share2, ListChecks, ScrollText, Megaphone, Award, Ban, ShieldAlert,
  Bell, BarChart3, History, Lock, Settings
} from "lucide-react";
import SidebarLayout from "@/components/perk/SidebarLayout";
import { useAuth } from "@/lib/AuthContext";

const navItems = [
  { label: "Dashboard", path: "/admin", icon: LayoutDashboard },
  { label: "Users", path: "/admin/users", icon: Users },
  { label: "Points", path: "/admin/points", icon: Coins },
  { label: "Loyalty XP", path: "/admin/loyalty", icon: TrendingUp },
  { label: "Rewards", path: "/admin/rewards", icon: Gift },
  { label: "Redemptions", path: "/admin/redemptions", icon: ClipboardCheck },
  { label: "Sites & Domains", path: "/admin/sites", icon: Globe },
  { label: "Tracked Accounts", path: "/admin/tracked-accounts", icon: AtSign },
  { label: "Social Activity", path: "/admin/social", icon: Share2 },
  { label: "Activities", path: "/admin/activities", icon: ListChecks },
  { label: "Rules", path: "/admin/rules", icon: ScrollText },
  { label: "Campaigns", path: "/admin/campaigns", icon: Megaphone },
  { label: "Achievements", path: "/admin/achievements", icon: Award },
  { label: "Restrictions", path: "/admin/restrictions", icon: Ban },
  { label: "Fraud Review", path: "/admin/fraud", icon: ShieldAlert },
  { label: "Notifications", path: "/admin/notifications", icon: Bell },
  { label: "Analytics", path: "/admin/analytics", icon: BarChart3 },
  { label: "Audit Log", path: "/admin/audit", icon: History },
  { label: "Roles & Permissions", path: "/admin/roles", icon: Lock },
  { label: "Settings", path: "/admin/settings", icon: Settings }
];

export default function AdminLayout() {
  const { user } = useAuth();
  if (user && user.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }
  return (
    <SidebarLayout brand="Perk Sphere Admin" accentFrom="#0f172a" accentTo="#334155" navItems={navItems}>
      <Outlet />
    </SidebarLayout>
  );
}