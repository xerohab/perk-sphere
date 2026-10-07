import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, LogOut, Grid, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import RankBadge from "@/components/perk/RankBadge";
import ThemeToggle from "@/components/perk/ThemeToggle";

export default function SidebarLayout({ brand, navItems, accentFrom, accentTo, children }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const tabHistory = useRef(new Map());

  // Longest-prefix match so nested routes highlight the right tab and "/" only
  // wins when nothing else does.
  const ownerOf = (pathname) => {
    let best = null;
    for (const item of navItems) {
      if (pathname === item.path || pathname.startsWith(item.path + "/")) {
        if (!best || item.path.length > best.path.length) best = item;
      }
    }
    return best;
  };

  useEffect(() => {
    const owner = ownerOf(location.pathname);
    if (owner) tabHistory.current.set(owner.path, location.pathname);
  }, [location.pathname]);

  const isActive = (item) => {
    const owner = ownerOf(location.pathname);
    return !!owner && owner.path === item.path;
  };

  const handleLogout = () => {
    logout(false);
    navigate("/login");
  };

  const handleTabClick = (item, e) => {
    const owner = ownerOf(location.pathname);
    if (owner && owner.path === item.path) {
      // Re-tapping the active tab resets to its root.
      if (location.pathname !== item.path) {
        e.preventDefault();
        navigate(item.path, { replace: true });
      }
    } else {
      // Switching tabs restores the last visited page for that tab, if any.
      const last = tabHistory.current.get(item.path);
      if (last && last !== location.pathname) {
        e.preventDefault();
        navigate(last);
      }
    }
  };

  const displayName = user?.display_name || user?.username || user?.full_name || user?.email || "Member";

  // Mobile top bar: show back button on non-root routes, brand on root routes.
  const rootPaths = navItems.map((i) => i.path);
  const isRootRoute = rootPaths.includes(location.pathname);
  const owner = ownerOf(location.pathname);
  const mobileTitle = isRootRoute ? brand : (owner?.label || brand);

  // Bottom tabs: first 4 items + a "More" tab that opens the drawer (if there are more).
  const hasMore = navItems.length > 5;
  const bottomTabs = hasMore ? navItems.slice(0, 4) : navItems.slice(0, 5);

  const NavList = () => (
    <div className="flex min-h-0 flex-1 flex-col px-3 py-4">
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <Link key={item.path} to={item.path} onClick={() => setOpen(false)} className={cn("group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors", active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground")}>
              <Icon className={cn("h-4 w-4", active && "text-foreground")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <button onClick={handleLogout} className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground">
        <LogOut className="h-4 w-4" />
        Logout
      </button>
    </div>
  );

  const BrandHeader = () => (
    <div className="flex items-center gap-3 px-5 py-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${accentFrom}, ${accentTo})` }}>
        <span className="text-sm font-bold">P</span>
      </div>
      <div>
        <p className="text-sm font-semibold leading-tight">{brand}</p>
        <p className="text-xs text-muted-foreground">perksphere.org</p>
      </div>
    </div>
  );

  const UserCard = () => (
    <div className="border-t border-border px-3 py-3">
      <div className="flex items-center gap-3 rounded-xl px-2 py-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-semibold uppercase">{displayName.charAt(0)}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{displayName}</p>
          <div className="mt-0.5">
            {user?.role === "admin" ? (
              <Link to="/admin" className="text-xs text-muted-foreground hover:text-foreground">Admin Panel</Link>
            ) : (
              user?.loyalty_rank && <RankBadge rank={user.loyalty_rank} className="!py-0.5 !text-xs" />
            )}
          </div>
        </div>
        <ThemeToggle />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleLogout} title="Sign out"><LogOut className="h-4 w-4" /></Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile top bar */}
      <div className="safe-top sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          {isRootRoute ? (
            <>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg text-white" style={{ background: `linear-gradient(135deg, ${accentFrom}, ${accentTo})` }}>
                <span className="text-xs font-bold">P</span>
              </div>
              <span className="text-sm font-semibold">{brand}</span>
            </>
          ) : (
            <>
              <Button variant="ghost" size="icon" aria-label="Back" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
              <span className="text-sm font-semibold">{mobileTitle}</span>
            </>
          )}
        </div>
        <Button variant="ghost" size="icon" aria-label="Open menu" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></Button>
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
              <Button variant="ghost" size="icon" className="mr-3" onClick={() => setOpen(false)}><X className="h-5 w-5" /></Button>
            </div>
            <NavList />
            <UserCard />
          </aside>
        </div>
      )}

      {/* Content */}
      <div className="lg:pl-64">
        <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 lg:px-10 lg:py-10 lg:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      {isMobile && (
        <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-50 flex items-stretch justify-around border-t border-border bg-background/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {bottomTabs.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            return (
              <Link key={item.path} to={item.path} onClick={(e) => handleTabClick(item, e)} className={cn("flex flex-1 flex-col items-center gap-0.5 px-1 py-2.5 text-xs font-medium transition-colors", active ? "text-foreground" : "text-muted-foreground")}>
                <Icon className={cn("h-5 w-5", active && "text-foreground")} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
          {hasMore && (
            <button onClick={() => setOpen(true)} className="flex flex-1 flex-col items-center gap-0.5 px-1 py-2.5 text-xs font-medium text-muted-foreground">
              <Grid className="h-5 w-5" />
              <span>More</span>
            </button>
          )}
        </nav>
      )}
    </div>
  );
}