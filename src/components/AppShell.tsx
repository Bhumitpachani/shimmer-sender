import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { clearSession, getSession, type Session } from "@/lib/session";
import { pingMail } from "@/lib/mailApi";
import {
  LayoutDashboard,
  Users,
  Mail,
  Send,
  UserCog,
  LogOut,
  Sparkles,
  Wifi,
  WifiOff,
  RefreshCw,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  children: React.ReactNode;
}

const NAV = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/clients", label: "Clients", icon: Users },
  { to: "/app/templates", label: "Templates", icon: Mail },
  { to: "/app/campaigns", label: "Campaigns", icon: Send },
];

export function AppShell({ children }: Props) {
  const navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location });
  // Read session synchronously to avoid a blank first render
  const [session, setSessionState] = useState<Session | null>(() => getSession());
  const [online, setOnline] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!session) navigate({ to: "/login" });
  }, [session, navigate]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const check = async () => {
    setChecking(true);
    const ok = await pingMail();
    setOnline(ok);
    setChecking(false);
  };

  useEffect(() => {
    check();
    const i = setInterval(check, 60_000);
    return () => clearInterval(i);
  }, []);

  if (!session) return null;

  const handleLogout = () => {
    clearSession();
    setSessionState(null);
    navigate({ to: "/login" });
  };

  const nav = [...NAV];
  if (session.role === "admin")
    nav.push({ to: "/app/employees", label: "Employees", icon: UserCog });

  const isActive = (to: string, exact?: boolean) =>
    exact
      ? location.pathname === to
      : location.pathname === to || location.pathname.startsWith(to + "/");

  const Sidebar = (
    <div className="h-full flex flex-col bg-gradient-to-b from-sidebar to-[oklch(0.16_0.05_262)] text-sidebar-foreground">
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-[oklch(0.6_0.2_280)] flex items-center justify-center shadow-lg shadow-primary/30">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-bold leading-tight">Starlink Jewels</div>
            <div className="text-[11px] opacity-70 tracking-wide uppercase">Email Marketing</div>
          </div>
        </div>
        <button
          className="lg:hidden p-1.5 rounded-md hover:bg-white/10"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {nav.map((n) => {
          const Icon = n.icon;
          const active = isActive(n.to, (n as any).exact);
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all relative group",
                active
                  ? "bg-gradient-to-r from-primary to-[oklch(0.55_0.2_275)] text-primary-foreground shadow-md shadow-primary/30"
                  : "hover:bg-white/5 text-white/80 hover:text-white"
              )}
            >
              <Icon className="w-4 h-4" />
              {n.label}
              {active && (
                <span className="absolute right-2 w-1.5 h-1.5 rounded-full bg-white/80" />
              )}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 py-2 mb-2 rounded-lg bg-white/5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-[oklch(0.6_0.2_280)] flex items-center justify-center text-sm font-semibold">
            {session.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{session.name}</div>
            <div className="text-[11px] opacity-70 capitalize">{session.role}</div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground hover:bg-white/10 hover:text-white"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" /> Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-shrink-0">{Sidebar}</aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] shadow-2xl">{Sidebar}</aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b bg-card/80 backdrop-blur px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-30">
          <button
            className="lg:hidden p-2 -ml-2 rounded-md hover:bg-muted"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <button
            onClick={check}
            className={cn(
              "flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors",
              online === null && "bg-muted text-muted-foreground",
              online === true && "bg-success/10 text-success border-success/30",
              online === false && "bg-destructive/10 text-destructive border-destructive/30"
            )}
            title="Click to re-check email server status"
          >
            {checking ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : online ? (
              <Wifi className="w-3 h-3" />
            ) : (
              <WifiOff className="w-3 h-3" />
            )}
            <span className="hidden sm:inline">
              {checking
                ? "Checking..."
                : online === null
                  ? "Checking..."
                  : online
                    ? "Mail Server Connected"
                    : "Mail Server Offline"}
            </span>
            <span className="sm:hidden">
              {online === null ? "..." : online ? "Online" : "Offline"}
            </span>
          </button>
        </header>
        <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
