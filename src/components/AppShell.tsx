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

const ADMIN_NAV = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/clients", label: "Clients", icon: Users },
  { to: "/app/templates", label: "Templates", icon: Mail },
  { to: "/app/campaigns", label: "Campaigns", icon: Send },
  { to: "/app/employees", label: "Employees", icon: UserCog },
];

const EMPLOYEE_NAV = [
  { to: "/app/clients", label: "Clients", icon: Users },
  { to: "/app/campaigns", label: "Campaigns", icon: Send },
];

export function AppShell({ children }: Props) {
  const navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location });
  const [session, setSessionState] = useState<Session | null>(() => getSession());
  const [online, setOnline] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!session) {
      navigate({ to: "/login" });
      return;
    }
    if (session.role === "employee") {
      const restricted = ["/app", "/app/templates", "/app/employees"];
      const isRestricted = restricted.some((p) =>
        p === "/app" ? location.pathname === "/app" || location.pathname === "/app/" : location.pathname.startsWith(p)
      );
      if (isRestricted) navigate({ to: "/app/clients" });
    }
  }, [session, navigate, location.pathname]);

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

  const nav = session.role === "admin" ? ADMIN_NAV : EMPLOYEE_NAV;

  const isActive = (to: string, exact?: boolean) =>
    exact
      ? location.pathname === to
      : location.pathname === to || location.pathname.startsWith(to + "/");

  const Sidebar = (
    <div className="h-full flex flex-col bg-gradient-to-b from-[oklch(0.2_0.06_262)] to-[oklch(0.14_0.05_262)] text-white">
      {/* Logo */}
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-[oklch(0.6_0.2_280)] flex items-center justify-center shadow-lg shadow-primary/30 shrink-0">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <div className="font-bold text-sm leading-tight">Starlink Jewels</div>
            <div className="text-[10px] opacity-60 tracking-widest uppercase">Email Marketing</div>
          </div>
        </div>
        <button
          className="lg:hidden p-1.5 rounded-md hover:bg-white/10 transition-colors"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {nav.map((n) => {
          const Icon = n.icon;
          const active = isActive(n.to, (n as any).exact);
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all relative",
                active
                  ? "bg-gradient-to-r from-primary to-[oklch(0.55_0.2_275)] text-white shadow-md shadow-primary/25"
                  : "hover:bg-white/8 text-white/70 hover:text-white"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{n.label}</span>
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/70" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User + logout */}
      <div className="p-3 border-t border-white/10 space-y-1">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-[oklch(0.6_0.2_280)] flex items-center justify-center text-xs font-bold shrink-0">
            {session.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{session.name}</div>
            <div className="text-[10px] opacity-60 capitalize">{session.role}</div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-white/70 hover:bg-white/10 hover:text-white text-sm"
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
      <aside className="hidden lg:flex w-60 flex-shrink-0 sticky top-0 h-screen">{Sidebar}</aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] shadow-2xl">{Sidebar}</aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-13 border-b bg-card/80 backdrop-blur-md px-4 sm:px-5 flex items-center justify-between gap-3 sticky top-0 z-30 shadow-sm">
          <button
            className="lg:hidden p-2 -ml-1 rounded-md hover:bg-muted transition-colors"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <button
            onClick={check}
            disabled={checking}
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all",
              online === null && "bg-muted text-muted-foreground border-border",
              online === true && "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800",
              online === false && "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800"
            )}
            title="Click to re-check mail server"
          >
            {checking ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : online ? (
              <Wifi className="w-3 h-3" />
            ) : (
              <WifiOff className="w-3 h-3" />
            )}
            <span className="hidden sm:inline">
              {checking ? "Checking…" : online === null ? "Checking…" : online ? "Mail Server Online" : "Mail Server Offline"}
            </span>
          </button>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6 max-w-screen-2xl">{children}</main>
      </div>
    </div>
  );
}
