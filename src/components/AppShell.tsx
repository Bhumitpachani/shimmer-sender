import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { clearSession, getSession, type Session } from "@/lib/session";
import { pingMail } from "@/lib/mailApi";
import {
  LayoutDashboard, Users, Mail, Send, UserCog, LogOut, Sparkles,
  Wifi, WifiOff, RefreshCw, Menu, ChevronLeft, ChevronRight,
  ChevronDown,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const PAGE_TITLES: Record<string, string> = {
  "/app": "Dashboard",
  "/app/clients": "Clients",
  "/app/templates": "Email Templates",
  "/app/campaigns": "Campaigns",
  "/app/employees": "Employees",
};
function getPageTitle(p: string) {
  if (PAGE_TITLES[p]) return PAGE_TITLES[p];
  if (p.startsWith("/app/campaigns/")) return "Campaign Details";
  if (p.startsWith("/app/clients/")) return "Client Details";
  return "Dashboard";
}

const ALL_NAV = [
  { key: "dashboard", section: "Overview", to: "/app" as const, label: "Dashboard", icon: LayoutDashboard, exact: true, adminOnly: false },
  { key: "clients", section: "Management", to: "/app/clients" as const, label: "Clients", icon: Users, exact: false, adminOnly: false },
  { key: "campaigns", section: "Management", to: "/app/campaigns" as const, label: "Campaigns", icon: Send, exact: false, adminOnly: false },
  { key: "templates", section: "Administration", to: "/app/templates" as const, label: "Templates", icon: Mail, exact: false, adminOnly: false },
  { key: "employees", section: "Administration", to: "/app/employees" as const, label: "Employees", icon: UserCog, exact: false, adminOnly: true },
];

function buildNavSections(session: Session) {
  const visibleItems = ALL_NAV.filter((item) => {
    if (session.role === "admin") return true;
    if (item.adminOnly) return false;
    return session.permissions.includes(item.key as any);
  });

  const sections: { section: string; items: typeof ALL_NAV }[] = [];
  for (const item of visibleItems) {
    let sec = sections.find((s) => s.section === item.section);
    if (!sec) { sec = { section: item.section, items: [] }; sections.push(sec); }
    sec.items.push(item);
  }
  return sections;
}

function getDefaultRedirect(session: Session): string {
  if (session.role === "admin") return "/app";
  if (session.permissions.includes("dashboard")) return "/app";
  if (session.permissions.includes("clients")) return "/app/clients";
  if (session.permissions.includes("campaigns")) return "/app/campaigns";
  if (session.permissions.includes("templates")) return "/app/templates";
  return "/login";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location });
  const [session, setSession] = useState<Session | null>(() => getSession());
  const [online, setOnline] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!session) { navigate({ to: "/login" }); return; }
    if (session.role === "employee") {
      const path = location.pathname;
      const allowed = ALL_NAV.filter((item) => {
        if (item.adminOnly) return false;
        return session.permissions.includes(item.key as any);
      });
      const isAllowed =
        allowed.some((item) =>
          item.exact
            ? path === item.to || path === item.to + "/"
            : path === item.to || path.startsWith(item.to + "/")
        );
      if (!isAllowed) {
        navigate({ to: getDefaultRedirect(session) as any });
      }
    }
  }, [session, navigate, location.pathname]);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const check = async () => { setChecking(true); setOnline(await pingMail()); setChecking(false); };
  useEffect(() => { check(); const t = setInterval(check, 60_000); return () => clearInterval(t); }, []);

  const logout = () => { clearSession(); setSession(null); navigate({ to: "/login" }); };

  if (!session) return null;

  const navSections = buildNavSections(session);
  const pageTitle = getPageTitle(location.pathname);
  const isActive = (to: string, exact?: boolean) =>
    exact ? location.pathname === to || location.pathname === "/app/" : location.pathname === to || location.pathname.startsWith(to + "/");

  const SidebarInner = ({ compact }: { compact: boolean }) => (
    <div className={cn("h-full flex flex-col bg-[#0f172a] text-white transition-all duration-200", compact ? "w-[68px]" : "w-64")}>
      <div className={cn("h-16 flex items-center shrink-0 border-b border-white/[0.06]", compact ? "justify-center" : "px-5 gap-3")}>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-[oklch(0.55_0.22_280)] flex items-center justify-center shadow-lg shadow-primary/30 shrink-0">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        {!compact && (
          <div>
            <div className="font-bold text-[15px] leading-tight text-white">Starlink Jewels</div>
            <div className="text-[10px] text-slate-500 tracking-[0.15em] uppercase">Email Marketing</div>
          </div>
        )}
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        <TooltipProvider delayDuration={0}>
          {navSections.map((sec, si) => (
            <div key={sec.section} className={cn("px-3", si > 0 && "mt-5")}>
              {!compact && <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.12em] px-2 mb-1.5">{sec.section}</div>}
              {compact && si > 0 && <div className="my-3 px-2"><Separator className="bg-white/[0.06]" /></div>}
              <div className="space-y-0.5">
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.to, item.exact);
                  const linkEl = (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={cn(
                        "flex items-center rounded-lg text-sm font-medium transition-all relative",
                        compact ? "justify-center py-3 mx-0" : "gap-3 px-3 py-2.5",
                        active ? "bg-primary/90 text-white shadow-sm" : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                      )}
                    >
                      {active && !compact && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-white/60" />}
                      <Icon className="w-[18px] h-[18px] shrink-0" />
                      {!compact && item.label}
                    </Link>
                  );
                  return compact ? (
                    <Tooltip key={item.to}>
                      <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                      <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
                    </Tooltip>
                  ) : linkEl;
                })}
              </div>
            </div>
          ))}
        </TooltipProvider>
      </nav>

      <div className="shrink-0 border-t border-white/[0.06] p-3">
        {!compact ? (
          <div
            onClick={logout}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/[0.06] transition-colors cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-[oklch(0.6_0.2_280)] flex items-center justify-center text-xs font-bold text-white shrink-0">
              {session.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white leading-tight truncate">{session.name}</div>
              <div className="text-[11px] text-slate-500 capitalize">{session.role}</div>
            </div>
            <LogOut className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
          </div>
        ) : (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={logout} className="w-full flex justify-center p-2.5 rounded-xl hover:bg-white/[0.06] transition-colors text-slate-500 hover:text-white">
                  <LogOut className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign Out</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-100 dark:bg-slate-950">
      <div className="hidden lg:flex sticky top-0 h-screen shrink-0 relative overflow-visible">
        <SidebarInner compact={collapsed} />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-[76px] w-6 h-6 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center z-50 hover:bg-slate-50 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5 text-slate-500" /> : <ChevronLeft className="w-3.5 h-3.5 text-slate-500" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative shadow-2xl"><SidebarInner compact={false} /></div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-4 sm:px-6 gap-4 sticky top-0 z-30 shadow-sm">
          <button className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-slate-100 transition-colors" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
          <h2 className="font-semibold text-slate-800 dark:text-white text-[15px]">{pageTitle}</h2>
          <div className="flex-1" />
          <button
            onClick={check}
            disabled={checking}
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all shrink-0",
              online === true && "bg-emerald-50 text-emerald-700 border-emerald-200",
              online === false && "bg-red-50 text-red-600 border-red-200",
              online === null && "bg-slate-100 text-slate-400 border-slate-200"
            )}
          >
            {checking ? <RefreshCw className="w-3 h-3 animate-spin" /> : online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span className="hidden sm:inline">{checking ? "Checking…" : online === null ? "…" : online ? "Mail Online" : "Mail Offline"}</span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 pl-2 pr-2 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-[oklch(0.6_0.2_280)] flex items-center justify-center text-sm font-bold text-white shrink-0">
                  {session.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-semibold text-slate-800 dark:text-white leading-tight">{session.name}</div>
                  <div className="text-[11px] text-slate-400 capitalize">{session.role}</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">
                Signed in as <span className="font-semibold text-foreground">@{session.username}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="gap-2 text-destructive focus:text-destructive cursor-pointer">
                <LogOut className="w-4 h-4" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 p-5 sm:p-7 max-w-[1600px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
