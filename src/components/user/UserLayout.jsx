import React, { Suspense } from "react";
import { Outlet } from "react-router-dom";
import {
  LayoutDashboard, Gift, Coins, Activity, Award, History, TrendingUp,
  Bell, Plug, User, ShieldCheck, Target, Globe, Handshake, BookOpen, HelpCircle, BarChart3, ClipboardCheck, ListChecks, Gamepad2
} from "lucide-react";
import SidebarLayout from "@/components/perk/SidebarLayout";
import PageTransition, { ContentSpinner } from "@/components/perk/PageTransition";

const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Earn", path: "/earn", icon: Coins },
  { label: "Tasks", path: "/tasks", icon: Target },
  { label: "Directory", path: "/directory", icon: BookOpen },
  { label: "Video Quizzes", path: "/quizzes", icon: HelpCircle },
  { label: "Games", path: "/games", icon: Gamepad2 },
  { label: "Rewards", path: "/rewards", icon: Gift },
  { label: "Activity", path: "/activity", icon: Activity },
  { label: "Weekly Reports", path: "/weekly-reports", icon: BarChart3 },
  { label: "Reward Requests", path: "/reward-review", icon: ClipboardCheck },
  { label: "Directory Requests", path: "/directory-requests", icon: ListChecks },
  { label: "Achievements", path: "/achievements", icon: Award },
  { label: "Points History", path: "/points-history", icon: History },
  { label: "Wallet", path: "/wallet", icon: Coins },
  { label: "Loyalty", path: "/loyalty", icon: TrendingUp },
  { label: "Notifications", path: "/notifications", icon: Bell },
  { label: "Connected Services", path: "/connected-services", icon: Plug },
  { label: "Partner Accounts", path: "/partner-accounts", icon: Handshake },
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
