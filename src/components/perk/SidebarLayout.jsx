import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, LogOut, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import RankBadge from "@/components/perk/RankBadge";

export default function SidebarLayout({ brand, navItems, accentFrom, accentTo, children }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + "/");

  const handleLogout = () => {
    logout(false);
    navigate("/login");
  };

  const displayName = user?.display_name || user?.username || user?.full_name || user?.email || "Member";

  const NavList = () => (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      {navItems.map((item) => {
        const active = isActive(item.path);
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setOpen(false)}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            )}
          >
            <Icon className={cn("h-4 w-4", active && "text-foreground")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const BrandHeader = () => (
    <div className="flex items-center gap-3 px-5 py-5">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm"
        style={{ background: `linear-gradient(135deg, ${accentFrom}, ${accentTo})` }}
      >
        <span className="text-sm font-bold">P</span>
      </div>
      <div>
        <p className="text-sm font-semibold leading-tight">{brand}</p>
        <p className="text-[11px] text-muted-foreground">perksphere.org</p>
      </div>
    </div>
  );

  const UserCard = () => (
    <div className="border-t border-border px-3 py-3">
      <div className="flex items-center gap-3 rounded-xl px-2 py-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-semibold uppercase">
          {displayName.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{displayName}</p>
          <div className="mt-0.5">
            {user?.role === "admin" ? (
              <Link to="/admin" className="text-[11px] text-muted-foreground hover:text-foreground">Admin Panel</Link>
            ) : (
              user?.loyalty_rank && <RankBadge rank={user.loyalty_rank} className="!py-0.5 !text-[10px]" />
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleLogout} title="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg text-white" style={{ background: `linear-gradient(135deg, ${accentFrom}, ${accentTo})` }}>
            <span className="text-xs font-bold">P</span>
          </div>
          <span className="text-sm font-semibold">{brand}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card lg:flex">
        <BrandHeader />
        <NavList />
        <UserCard />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-card shadow-xl">
            <div className="flex items-center justify-between">
              <BrandHeader />
              <Button variant="ghost" size="icon" className="mr-3" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <NavList />
            <UserCard />
          </aside>
        </div>
      )}

      {/* Content */}
      <div className="lg:pl-64">
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}