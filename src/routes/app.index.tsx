import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Users, Mail, Send, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

function Dashboard() {
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

  const Tile = ({ icon: Icon, label, value, color }: any) => (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="text-3xl font-bold mt-1">{value}</div>
        </div>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your email marketing activity</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Tile icon={Users} label="Clients" value={stats.clients} color="bg-primary/10 text-primary" />
        <Tile icon={Mail} label="Templates" value={stats.templates} color="bg-accent text-accent-foreground" />
        <Tile icon={Send} label="Campaigns" value={stats.campaigns} color="bg-warning/20 text-warning-foreground" />
        <Tile icon={CheckCircle2} label="Emails Sent" value={stats.success} color="bg-success/10 text-success" />
        <Tile icon={XCircle} label="Failed" value={stats.fail} color="bg-destructive/10 text-destructive" />
      </div>
      <Card className="p-5">
        <h2 className="font-semibold mb-3">Recent Campaigns</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No campaigns yet. <Link to="/app/campaigns" className="text-primary underline">Start one</Link>.</p>
        ) : (
          <div className="divide-y">
            {recent.map((c) => (
              <Link key={c.id} to="/app/campaigns/$id" params={{ id: c.id }} className="flex justify-between py-3 hover:bg-muted/40 px-2 rounded">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.country} • {new Date(c.created_at).toLocaleString()}</div>
                </div>
                <div className="text-sm">
                  <span className="text-success">{c.success_count}</span> / <span className="text-destructive">{c.fail_count}</span>
                  <div className="text-xs text-muted-foreground text-right">{c.status}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
