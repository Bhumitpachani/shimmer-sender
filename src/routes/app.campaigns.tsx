import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Send, Plus, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { getSession } from "@/lib/session";
import { sendMail } from "@/lib/mailApi";

export const Route = createFileRoute("/app/campaigns")({
  component: CampaignsPage,
});

function CampaignsPage() {
  const session = getSession();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, success: 0, fail: 0 });

  const load = async () => {
    const [cms, cls, tps] = await Promise.all([
      supabase.from("campaigns").select("*, templates(name)").order("created_at", { ascending: false }),
      supabase.from("clients").select("*"),
      supabase.from("templates").select("*"),
    ]);
    setCampaigns(cms.data ?? []);
    setClients(cls.data ?? []);
    setTemplates(tps.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const countries = useMemo(
    () => Array.from(new Set(clients.map((c) => c.country))).filter(Boolean).sort(),
    [clients]
  );

  const targets = useMemo(() => {
    return clients.filter((c) => {
      if (country && c.country !== country) return false;
      if (dateFrom && new Date(c.created_at) < new Date(dateFrom)) return false;
      if (dateTo && new Date(c.created_at) > new Date(dateTo + "T23:59:59")) return false;
      return true;
    });
  }, [clients, country, dateFrom, dateTo]);

  const startCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return toast.error("Pick a template");
    if (targets.length === 0) return toast.error("No clients match these filters");
    if (!confirm(`Send "${tpl.name}" to ${targets.length} client(s) in ${country}?`)) return;

    setSending(true);
    setProgress({ done: 0, total: targets.length, success: 0, fail: 0 });

    const { data: campaign, error: cErr } = await supabase.from("campaigns").insert({
      name,
      country,
      template_id: tpl.id,
      date_from: dateFrom || null,
      date_to: dateTo || null,
      total_recipients: targets.length,
      status: "running",
      started_by: session?.username ?? "admin",
    }).select().single();
    if (cErr || !campaign) { setSending(false); return toast.error(cErr?.message ?? "Failed"); }

    let success = 0, fail = 0;
    for (let i = 0; i < targets.length; i++) {
      const c = targets[i];
      const res = await sendMail({ to: c.email, subject: tpl.subject, html: tpl.html });
      if (res.ok) success++; else fail++;
      await supabase.from("send_history").insert({
        campaign_id: campaign.id,
        client_id: c.id,
        client_email: c.email,
        template_id: tpl.id,
        template_name: tpl.name,
        status: res.ok ? "success" : "fail",
        error: res.error ?? null,
        sent_by: session?.username ?? "admin",
      });
      setProgress({ done: i + 1, total: targets.length, success, fail });
    }

    await supabase.from("campaigns").update({
      success_count: success,
      fail_count: fail,
      status: fail === targets.length ? "failed" : "completed",
    }).eq("id", campaign.id);

    setSending(false);
    toast.success(`Done: ${success} sent, ${fail} failed`);
    setOpen(false);
    setName(""); setCountry(""); setTemplateId(""); setDateFrom(""); setDateTo("");
    load();
    navigate({ to: "/app/campaigns/$id", params: { id: campaign.id } });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground">Send email blasts and track results</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { if (!sending) setOpen(v); }}>
          <DialogTrigger asChild>
            <Button disabled={templates.length === 0 || clients.length === 0}><Plus className="w-4 h-4 mr-2" />New Campaign</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Start a Campaign</DialogTitle></DialogHeader>
            <form onSubmit={startCampaign} className="space-y-3">
              <div><Label>Campaign Name *</Label><Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Diwali Promo Oct" /></div>
              <div><Label>Country *</Label>
                <Select value={country} onValueChange={setCountry} required>
                  <SelectTrigger><SelectValue placeholder="Choose country" /></SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Clients added from</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
                <div><Label>To</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
              </div>
              <div><Label>Template *</Label>
                <Select value={templateId} onValueChange={setTemplateId} required>
                  <SelectTrigger><SelectValue placeholder="Choose template" /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Card className="p-3 bg-accent/40 text-sm">
                <div><strong>{targets.length}</strong> client(s) will receive this email.</div>
              </Card>
              {sending && (
                <div className="space-y-2">
                  <Progress value={(progress.done / Math.max(progress.total, 1)) * 100} />
                  <div className="text-xs text-muted-foreground flex justify-between">
                    <span>{progress.done} / {progress.total}</span>
                    <span><span className="text-success">{progress.success} sent</span> • <span className="text-destructive">{progress.fail} failed</span></span>
                  </div>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={sending}>
                <Send className="w-4 h-4 mr-2" />{sending ? "Sending..." : `Start Campaign (${targets.length})`}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {(templates.length === 0 || clients.length === 0) && (
        <Card className="p-4 bg-warning/10 border-warning/30 text-sm">
          You need at least one <Link to="/app/templates" className="text-primary underline">template</Link> and one <Link to="/app/clients" className="text-primary underline">client</Link> to start a campaign.
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr className="text-left">
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">Template</th>
                <th className="px-4 py-3">Recipients</th>
                <th className="px-4 py-3">Result</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Started By</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {campaigns.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No campaigns yet</td></tr>
              ) : campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-muted/40">
                  <td className="px-4 py-2"><Link to="/app/campaigns/$id" params={{ id: c.id }} className="text-primary hover:underline font-medium">{c.name}</Link></td>
                  <td className="px-4 py-2">{c.country}</td>
                  <td className="px-4 py-2">{c.templates?.name ?? "—"}</td>
                  <td className="px-4 py-2">{c.total_recipients}</td>
                  <td className="px-4 py-2 text-xs">
                    <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="w-3 h-3" />{c.success_count}</span>
                    {" / "}
                    <span className="inline-flex items-center gap-1 text-destructive"><XCircle className="w-3 h-3" />{c.fail_count}</span>
                  </td>
                  <td className="px-4 py-2"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-2">{c.started_by}</td>
                  <td className="px-4 py-2 text-muted-foreground">{new Date(c.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: "bg-success/10 text-success",
    running: "bg-warning/20 text-warning-foreground",
    failed: "bg-destructive/10 text-destructive",
    pending: "bg-muted text-muted-foreground",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${colors[status] ?? colors.pending}`}>{status}</span>;
}
