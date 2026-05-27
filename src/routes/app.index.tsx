import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db, type Campaign, type Client, type Template } from "@/lib/db";
import { getSession } from "@/lib/session";
import { Users, Mail, Send, CheckCircle2, XCircle, ArrowRight, Plus, TrendingUp, Activity } from "lucide-react";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

function Dashboard() {
  const session = getSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (session && session.role === "employee") navigate({ to: "/app/clients" });
  }, [session, navigate]);

  const [stats, setStats] = useState({ clients: 0, templates: 0, campaigns: 0, success: 0, fail: 0 });
  const [recentCampaigns, setRecentCampaigns] = useState<Campaign[]>([]);
  const [recentClients, setRecentClients] = useState<Client[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.role === "employee") return;
    Promise.all([
      db.clients.getAll(),
      db.templates.getAll(),
      db.campaigns.getAll(),
      db.sendHistory.countByStatus("success"),
      db.sendHistory.countByStatus("fail"),
    ]).then(([allClients, allTemplates, allCampaigns, success, fail]) => {
      setStats({
        clients: allClients.length,
        templates: allTemplates.length,
        campaigns: allCampaigns.length,
        success,
        fail,
      });
      setRecentCampaigns(allCampaigns.slice(0, 6));
      setRecentClients(allClients.slice(0, 5));
      setTemplates(allTemplates);
    }).finally(() => setLoading(false));
  }, []);

  if (session?.role === "employee") return null;

  const totalSent = stats.success + stats.fail;
  const successRate = totalSent > 0 ? Math.round((stats.success / totalSent) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Good {getGreeting()}, {session?.name?.split(" ")[0] ?? "Admin"} 👋
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Here's what's happening with your campaigns.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/app/clients">
            <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-700 transition-colors shadow-sm">
              <Plus className="w-3.5 h-3.5" /> Add Client
            </button>
          </Link>
          <Link to="/app/campaigns">
            <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20">
              <Send className="w-3.5 h-3.5" /> New Campaign
            </button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={Users} label="Total Clients" value={stats.clients} color="blue" sub="All contacts" loading={loading} />
        <StatCard icon={Mail} label="Templates" value={stats.templates} color="violet" sub="Email designs" loading={loading} />
        <StatCard icon={Send} label="Campaigns" value={stats.campaigns} color="amber" sub="All time" loading={loading} />
        <StatCard icon={CheckCircle2} label="Emails Sent" value={stats.success} color="emerald" sub={`${successRate}% success rate`} loading={loading} />
        <StatCard icon={XCircle} label="Failed" value={stats.fail} color="red" sub="Delivery issues" loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-slate-400" />
                <span className="font-semibold text-slate-800 dark:text-white">Recent Campaigns</span>
              </div>
              <Link to="/app/campaigns" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {loading ? (
              <div className="flex justify-center py-14">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : recentCampaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center px-6">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                  <Send className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-600">No campaigns yet</p>
                <p className="text-xs text-slate-400 mt-1">Start a campaign to reach your clients</p>
                <Link to="/app/campaigns">
                  <button className="mt-4 px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
                    Start Campaign
                  </button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentCampaigns.map((c) => {
                  const tpl = templates.find((t) => t.id === c.template_id);
                  const total = c.total_recipients || 1;
                  const rate = Math.round((c.success_count / total) * 100);
                  return (
                    <Link
                      key={c.id}
                      to="/app/campaigns/$id"
                      params={{ id: c.id }}
                      className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                    >
                      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", statusBg(c.status))}>
                        <Send className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800 dark:text-white truncate">{c.name}</span>
                          <StatusBadge status={c.status} />
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{tpl?.name ?? "—"} · {new Date(c.created_at).toLocaleDateString()}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-slate-800 dark:text-white">{rate}%</div>
                        <div className="text-xs text-slate-400">{c.success_count}/{c.total_recipients}</div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0 hidden sm:block" />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <span className="font-semibold text-slate-800 dark:text-white text-sm">Quick Actions</span>
            </div>
            <div className="p-3 space-y-1.5">
              {[
                { icon: Users, label: "Add New Client", desc: "Add a contact manually", to: "/app/clients", color: "text-blue-600 bg-blue-50" },
                { icon: Mail, label: "Create Template", desc: "Design a new email", to: "/app/templates", color: "text-violet-600 bg-violet-50" },
                { icon: Send, label: "Start Campaign", desc: "Send bulk emails", to: "/app/campaigns", color: "text-amber-600 bg-amber-50" },
              ].map((a) => (
                <Link key={a.label} to={a.to as any}>
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", a.color)}>
                      <a.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-700">{a.label}</div>
                      <div className="text-xs text-slate-400">{a.desc}</div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <span className="font-semibold text-slate-800 dark:text-white text-sm">Recent Clients</span>
              <Link to="/app/clients" className="text-xs text-primary hover:underline">View all</Link>
            </div>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : recentClients.length === 0 ? (
              <div className="px-5 py-6 text-center text-xs text-slate-400">No clients yet</div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentClients.map((c) => (
                  <Link key={c.id} to="/app/clients/$id" params={{ id: c.id }}>
                    <div className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50 transition-colors">
                      <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0", getAvatarColor(c.name))}>
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-700 truncate">{c.name}</div>
                        <div className="text-xs text-slate-400 truncate">{c.country}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function statusBg(s: string) {
  return s === "completed" ? "bg-emerald-500" : s === "running" ? "bg-amber-500" : s === "failed" ? "bg-red-500" : "bg-slate-400";
}

function cn(...cls: (string | boolean | undefined | null)[]) {
  return cls.filter(Boolean).join(" ");
}

const AVATAR_COLORS = ["bg-red-400", "bg-orange-400", "bg-amber-400", "bg-lime-500", "bg-green-500", "bg-teal-500", "bg-cyan-500", "bg-sky-500", "bg-blue-500", "bg-indigo-500", "bg-violet-500", "bg-purple-500", "bg-pink-500", "bg-rose-400"];
function getAvatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function StatCard({ icon: Icon, label, value, color, sub, loading }: { icon: any; label: string; value: number; color: string; sub: string; loading?: boolean }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    violet: "bg-violet-50 text-violet-600",
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
    red: "bg-red-50 text-red-500",
  };
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
      <div className="flex items-start justify-between gap-2">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", colors[color])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-3">
        {loading ? (
          <div className="h-8 w-16 bg-slate-100 rounded animate-pulse" />
        ) : (
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{value.toLocaleString()}</div>
        )}
        <div className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-0.5">{label}</div>
        <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-emerald-100 text-emerald-700",
    running: "bg-amber-100 text-amber-700",
    failed: "bg-red-100 text-red-600",
    pending: "bg-slate-100 text-slate-500",
  };
  return (
    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium capitalize", map[status] ?? map.pending)}>
      {status}
    </span>
  );
}
