import React, { useState, Suspense } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, Home, Globe, Info, LayoutDashboard, User } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/perk/ThemeToggle";
import PageTransition, { ContentSpinner } from "@/components/perk/PageTransition";

const NAV = [
  { label: "Home", path: "/" },
  { label: "How It Works", path: "/#how-it-works" },
  { label: "Destinations", path: "/destinations" },
  { label: "Rewards", path: "/#rewards" },
  { label: "About", path: "/about" }
];

export default function PublicLayout() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const go = (path) => {
    setOpen(false);
    if (path.startsWith("/#")) {
      const hash = path.slice(2);
      if (location.pathname !== "/") {
        navigate("/");
        setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" }), 100);
      } else {
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      navigate(path);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="safe-top sticky top-0 z-40 border-b border-border bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm">
              <span className="text-sm font-bold">P</span>
            </div>
            <span className="text-base font-semibold tracking-tight">Perk Sphere</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <button key={item.label} onClick={() => go(item.path)} className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle className="hidden sm:block" />
            {isAuthenticated ? (
              <Button size="sm" onClick={() => navigate("/dashboard")}>Dashboard</Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => navigate("/login")}>Sign In</Button>
                <Button size="sm" onClick={() => navigate("/register")}>Join</Button>
              </>
            )}
            <button className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {open && (
          <div className="border-t border-border bg-background md:hidden">
            <nav className="flex flex-col gap-1 px-4 py-3">
              {NAV.map((item) => (
                <button key={item.label} onClick={() => go(item.path)} className="rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
                  {item.label}
                </button>
              ))}
              <div className="mt-2 flex items-center gap-2 border-t border-border pt-3">
                <ThemeToggle />
                {isAuthenticated ? (
                  <Button size="sm" className="flex-1" onClick={() => go("/dashboard")}>Dashboard</Button>
                ) : (
                  <>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => go("/login")}>Sign In</Button>
                    <Button size="sm" className="flex-1" onClick={() => go("/register")}>Join</Button>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1 pb-20 md:pb-0">
        <PageTransition>
          <Suspense fallback={<ContentSpinner />}>
            <Outlet />
          </Suspense>
        </PageTransition>
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
                  <span className="text-xs font-bold">P</span>
                </div>
                <span className="text-sm font-semibold">Perk Sphere</span>
              </div>
              <p className="mt-3 max-w-sm text-sm text-muted-foreground">
                Your activity. Your loyalty. Your rewards. Perk Sphere brings rewards, loyalty and participating online destinations together in one place.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Explore</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link to="/destinations" className="text-muted-foreground hover:text-foreground">Destinations</Link></li>
                <li><Link to="/#how-it-works" className="text-muted-foreground hover:text-foreground">How It Works</Link></li>
                <li><Link to="/#rewards" className="text-muted-foreground hover:text-foreground">Rewards</Link></li>
                <li><Link to="/about" className="text-muted-foreground hover:text-foreground">About</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link to="/dashboard" className="text-muted-foreground hover:text-foreground">Dashboard</Link></li>
                <li><Link to="/login" className="text-muted-foreground hover:text-foreground">Sign In</Link></li>
                <li><Link to="/register" className="text-muted-foreground hover:text-foreground">Create Account</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Legal</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link to="/privacy-policy" className="text-muted-foreground hover:text-foreground">Privacy Policy</Link></li>
                <li><Link to="/terms-of-service" className="text-muted-foreground hover:text-foreground">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-border pt-6 text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} Perk Sphere. Activity tracking requires the relevant Perk Sphere client and your consent.</p>
          </div>
        </div>
      </footer>

      {/* Mobile bottom tab bar */}
      <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-50 flex items-stretch justify-around border-t border-border bg-background/95 backdrop-blur md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <Link to="/" className={cn("flex flex-1 flex-col items-center gap-0.5 px-1 py-2.5 text-xs font-medium transition-colors", location.pathname === "/" ? "text-foreground" : "text-muted-foreground")}>
          <Home className="h-5 w-5" />
          <span>Home</span>
        </Link>
        <Link to="/destinations" className={cn("flex flex-1 flex-col items-center gap-0.5 px-1 py-2.5 text-xs font-medium transition-colors", location.pathname.startsWith("/destinations") ? "text-foreground" : "text-muted-foreground")}>
          <Globe className="h-5 w-5" />
          <span>Destinations</span>
        </Link>
        <Link to="/about" className={cn("flex flex-1 flex-col items-center gap-0.5 px-1 py-2.5 text-xs font-medium transition-colors", location.pathname === "/about" ? "text-foreground" : "text-muted-foreground")}>
          <Info className="h-5 w-5" />
          <span>About</span>
        </Link>
        {isAuthenticated ? (
          <Link to="/dashboard" className={cn("flex flex-1 flex-col items-center gap-0.5 px-1 py-2.5 text-xs font-medium transition-colors", location.pathname.startsWith("/dashboard") ? "text-foreground" : "text-muted-foreground")}>
            <LayoutDashboard className="h-5 w-5" />
            <span>Dashboard</span>
          </Link>
        ) : (
          <Link to="/login" className={cn("flex flex-1 flex-col items-center gap-0.5 px-1 py-2.5 text-xs font-medium transition-colors", location.pathname.startsWith("/login") || location.pathname.startsWith("/register") ? "text-foreground" : "text-muted-foreground")}>
            <User className="h-5 w-5" />
            <span>Sign In</span>
          </Link>
        )}
      </nav>
    </div>
  );
}