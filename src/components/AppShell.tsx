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
  const [session, setSessionState] = useState<Session | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      navigate({ to: "/login" });
      return;
    }
    setSessionState(s);
  }, [navigate]);

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
    navigate({ to: "/login" });
  };

  const nav = [...NAV];
  if (session.role === "admin") nav.push({ to: "/app/employees", label: "Employees", icon: UserCog });

  const isActive = (to: string, exact?: boolean) =>
    exact ? location.pathname === to : location.pathname === to || location.pathname.startsWith(to + "/");

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-bold leading-tight">Starlink Jewels</div>
              <div className="text-xs opacity-70">Email Marketing</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = isActive(n.to, (n as any).exact);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active ? "bg-primary text-primary-foreground" : "hover:bg-white/5"
                )}
              >
                <Icon className="w-4 h-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/10">
          <div className="text-xs px-1 mb-2 opacity-70">Signed in as</div>
          <div className="text-sm font-medium px-1">{session.name}</div>
          <div className="text-xs px-1 opacity-70 mb-3">{session.role}</div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground hover:bg-white/10" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" /> Logout
          </Button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b bg-card px-6 flex items-center justify-end gap-3">
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
            {checking ? <RefreshCw className="w-3 h-3 animate-spin" /> : online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {checking ? "Checking..." : online === null ? "Checking..." : online ? "Mail Server Connected" : "Mail Server Offline"}
          </button>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
