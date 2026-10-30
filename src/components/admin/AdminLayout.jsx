import React, { Suspense } from "react";
import { Outlet, Navigate } from "react-router-dom";
import {
  LayoutDashboard, Users, Coins, TrendingUp, Gift, ClipboardCheck, Globe,
  AtSign, Share2, ListChecks, ScrollText, Megaphone, Award, Ban, ShieldAlert,
  Bell, BarChart3, History, Lock, Settings, ClipboardList, Plug, BookOpen, HelpCircle, FileText
} from "lucide-react";
import SidebarLayout from "@/components/perk/SidebarLayout";
import AccessGate from "@/components/perk/AccessGate";
import PageTransition, { ContentSpinner } from "@/components/perk/PageTransition";
import { useAuth } from "@/lib/AuthContext";

const navItems = [
  { label: "Dashboard", path: "/admin", icon: LayoutDashboard, permission: "dashboard.view" },
  { label: "Launch checks", path: "/admin/launch-checks", icon: ClipboardCheck, permission: "rules.view" },
  { label: "Users", path: "/admin/users", icon: Users, permission: "users.view" },
  { label: "Points", path: "/admin/points", icon: Coins, permission: "ledger.view" },
  { label: "Loyalty XP", path: "/admin/loyalty", icon: TrendingUp, permission: "loyalty.view" },
  { label: "Rewards", path: "/admin/rewards", icon: Gift, permission: "rewards.view" },
  { label: "Redemptions", path: "/admin/redemptions", icon: ClipboardCheck, permission: "redemptions.view" },
  { label: "Reward Review", path: "/admin/reward-review", icon: ClipboardCheck, permission: "rewards.view" },
  { label: "Destinations", path: "/admin/destinations", icon: Globe, permission: "destinations.view" },
  { label: "Sites & Domains", path: "/admin/sites", icon: Globe, permission: "destinations.view" },
  { label: "Tracked Accounts", path: "/admin/tracked-accounts", icon: AtSign, permission: "destinations.view" },
  { label: "Directory", path: "/admin/directory", icon: BookOpen, permission: "destinations.view" },
  { label: "Dir. Requests", path: "/admin/directory-requests", icon: ListChecks, permission: "destinations.view" },
  { label: "Social Activity", path: "/admin/social", icon: Share2, permission: "activity.view" },
  { label: "Activities", path: "/admin/activities", icon: ListChecks, permission: "activity.view" },
  { label: "Rules", path: "/admin/rules", icon: ScrollText, permission: "rules.view" },
  { label: "Campaigns", path: "/admin/campaigns", icon: Megaphone, permission: "campaigns.view" },
  { label: "Sponsorships", path: "/admin/sponsors", icon: Megaphone, permission: "campaigns.manage" },
  { label: "Tasks", path: "/admin/tasks", icon: ClipboardList, permission: "tasks.view" },
  { label: "Quizzes", path: "/admin/quizzes", icon: HelpCircle, permission: "tasks.view" },
  { label: "Game Rewards", path: "/admin/games", icon: HelpCircle, permission: "tasks.edit" },
  { label: "Partners", path: "/admin/partners", icon: Plug, permission: "partners.view" },
  { label: "Partner Rewards", path: "/admin/partner-rewards", icon: Coins, permission: "partners.view" },
  { label: "Achievements", path: "/admin/achievements", icon: Award, permission: "achievements.view" },
  { label: "Restrictions", path: "/admin/restrictions", icon: Ban, permission: "restrictions.view" },
  { label: "Fraud Review", path: "/admin/fraud", icon: ShieldAlert, permission: "fraud.view" },
  { label: "Notifications", path: "/admin/notifications", icon: Bell, permission: "dashboard.view" },
  { label: "Analytics", path: "/admin/analytics", icon: BarChart3, permission: "analytics.view" },
  { label: "Reports", path: "/admin/reports", icon: FileText, permission: "analytics.view" },
  { label: "Audit Log", path: "/admin/audit", icon: History, permission: "audit.view" },
  { label: "Roles & Permissions", path: "/admin/roles", icon: Lock, permission: "staff.view" },
  { label: "Settings", path: "/admin/settings", icon: Settings, permission: "settings.view" }
];

export default function AdminLayout() {
  const { user } = useAuth();
  if (user && user.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }
  return (
    <AccessGate>
      {(access) => {
        const items = navItems.filter((n) => !n.permission || access.permissions.includes(n.permission));
        return (
          <SidebarLayout brand="Perk Sphere Admin" accentFrom="#0f172a" accentTo="#334155" navItems={items}>
            <PageTransition>
              <Suspense fallback={<ContentSpinner />}>
                <Outlet />
              </Suspense>
            </PageTransition>
          </SidebarLayout>
        );
      }}
    </AccessGate>
  );
}
