import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Users, Mail, Send, CheckCircle2, XCircle, TrendingUp } from "lucide-react";
import { getSession } from "@/lib/session";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

function Dashboard() {
  const session = getSession();
  const [stats, setStats] = useState({ clients: 0, templates: 0, campaigns: 0, success: 0, fail: 0 });
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [c, t, cm, hSuccess, hFail, rec] = await Promise.all([
        supabase.from("clients").select("*", { count: "exact", head: true }),
        supabase.from("templates").select("*", { count: "exact", head: true }),
        supabase.from("campaigns").select("*", { count: "exact", head: true }),
        supabase.from("send_history").select("*", { count: "exact", head: true }).eq("status", "success"),
        supabase.from("send_history").select("*", { count: "exact", head: true }).eq("status", "fail"),
        supabase.from("campaigns").select("*").order("created_at", { ascending: false }).limit(5),
      ]);
      setStats({
        clients: c.count ?? 0,
        templates: t.count ?? 0,
        campaigns: cm.count ?? 0,
        success: hSuccess.count ?? 0,
        fail: hFail.count ?? 0,
      });
      setRecent(rec.data ?? []);
    })();
  }, []);

  const Tile = ({ icon: Icon, label, value, iconBg }: any) => (
    <Card className="p-4 sm:p-5 relative overflow-hidden hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">{label}</div>
          <div className="text-2xl sm:text-3xl font-bold mt-1 tracking-tight">{value.toLocaleString()}</div>
        </div>
        <div className={`p-2 sm:p-2.5 rounded-xl ${iconBg} shadow-sm shrink-0`}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8 bg-gradient-to-br from-primary via-[oklch(0.5_0.2_275)] to-[oklch(0.55_0.22_295)] text-primary-foreground shadow-xl shadow-primary/20">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -right-20 -bottom-20 w-64 h-64 rounded-full bg-white/5 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-sm opacity-90">
            <TrendingUp className="w-4 h-4" />
            Welcome back, {session?.name ?? "Admin"}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-2">Dashboard</h1>
          <p className="text-sm opacity-90 mt-1">Overview of your email marketing activity</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <Tile icon={Users} label="Clients" value={stats.clients} iconBg="bg-primary/10 text-primary" />
        <Tile icon={Mail} label="Templates" value={stats.templates} iconBg="bg-purple-500/10 text-purple-600" />
        <Tile icon={Send} label="Campaigns" value={stats.campaigns} iconBg="bg-amber-500/10 text-amber-600" />
        <Tile icon={CheckCircle2} label="Sent" value={stats.success} iconBg="bg-success/10 text-success" />
        <Tile icon={XCircle} label="Failed" value={stats.fail} iconBg="bg-destructive/10 text-destructive" />
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Recent Campaigns</h2>
          <Link to="/app/campaigns" className="text-xs text-primary hover:underline">View all →</Link>
        </div>
        {recent.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            <Send className="w-10 h-10 mx-auto mb-2 opacity-30" />
            No campaigns yet. <Link to="/app/campaigns" className="text-primary underline">Start one</Link>.
          </div>
        ) : (
          <div className="divide-y">
            {recent.map((c) => (
              <Link key={c.id} to="/app/campaigns/$id" params={{ id: c.id }} className="flex justify-between items-center py-3 hover:bg-muted/40 px-2 -mx-2 rounded-lg transition-colors">
                <div className="min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.country} • {new Date(c.created_at).toLocaleString()}</div>
                </div>
                <div className="text-sm text-right shrink-0 ml-3">
                  <span className="text-success font-semibold">{c.success_count}</span>
                  <span className="text-muted-foreground"> / </span>
                  <span className="text-destructive font-semibold">{c.fail_count}</span>
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{c.status}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
