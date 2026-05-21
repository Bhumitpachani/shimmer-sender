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
import { Badge } from "@/components/ui/badge";
import { Send, Plus, CheckCircle2, XCircle, Globe, Calendar, Repeat2, ChevronDown, ChevronUp } from "lucide-react";
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
  const [templateId, setTemplateId] = useState("");

  const [useCountry, setUseCountry] = useState(false);
  const [country, setCountry] = useState("");
  const [useDate, setUseDate] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [useRepeat, setUseRepeat] = useState(false);
  const [repeatCampaignId, setRepeatCampaignId] = useState("");
  const [repeatClientIds, setRepeatClientIds] = useState<Set<string>>(new Set());

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

  useEffect(() => {
    if (!useRepeat || !repeatCampaignId) {
      setRepeatClientIds(new Set());
      return;
    }
    supabase
      .from("send_history")
      .select("client_id")
      .eq("campaign_id", repeatCampaignId)
      .then(({ data }) => {
        const ids = new Set((data ?? []).map((r: any) => r.client_id).filter(Boolean) as string[]);
        setRepeatClientIds(ids);
      });
  }, [useRepeat, repeatCampaignId]);

  const targets = useMemo(() => {
    return clients.filter((c) => {
      if (useCountry && country && c.country !== country) return false;
      if (useDate && dateFrom && new Date(c.created_at) < new Date(dateFrom)) return false;
      if (useDate && dateTo && new Date(c.created_at) > new Date(dateTo + "T23:59:59")) return false;
      if (useRepeat && repeatCampaignId && repeatClientIds.size > 0 && !repeatClientIds.has(c.id)) return false;
      return true;
    });
  }, [clients, useCountry, country, useDate, dateFrom, dateTo, useRepeat, repeatCampaignId, repeatClientIds]);

  const resetForm = () => {
    setName(""); setTemplateId("");
    setUseCountry(false); setCountry("");
    setUseDate(false); setDateFrom(""); setDateTo("");
    setUseRepeat(false); setRepeatCampaignId(""); setRepeatClientIds(new Set());
  };

  const startCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return toast.error("Pick a template");
    if (targets.length === 0) return toast.error("No clients match these filters");

    const filterDesc = [
      useCountry && country ? `Country: ${country}` : null,
      useDate && (dateFrom || dateTo) ? `Date range applied` : null,
      useRepeat && repeatCampaignId ? `Repeat from previous campaign` : null,
    ].filter(Boolean).join(" • ") || "All clients";

    if (!confirm(`Send "${tpl.name}" to ${targets.length} client(s)?\n${filterDesc}`)) return;

    setSending(true);
    setProgress({ done: 0, total: targets.length, success: 0, fail: 0 });

    const { data: campaign, error: cErr } = await supabase.from("campaigns").insert({
      name,
      country: useCountry && country ? country : null,
      template_id: tpl.id,
      date_from: useDate && dateFrom ? dateFrom : null,
      date_to: useDate && dateTo ? dateTo : null,
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
    resetForm();
    load();
    navigate({ to: "/app/campaigns/$id", params: { id: campaign.id } });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground">Send email blasts and track results</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { if (!sending) { setOpen(v); if (!v) resetForm(); } }}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={templates.length === 0 || clients.length === 0}>
              <Plus className="w-4 h-4 mr-1.5" />New Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Start a Campaign</DialogTitle></DialogHeader>
            <form onSubmit={startCampaign} className="space-y-4">
              <div>
                <Label>Campaign Name *</Label>
                <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Diwali Promo Oct" />
              </div>
              <div>
                <Label>Template *</Label>
                <Select value={templateId} onValueChange={setTemplateId} required>
                  <SelectTrigger><SelectValue placeholder="Choose template" /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Optional Filters */}
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Optional Filters</div>

                {/* Country Filter */}
                <div className={`rounded-lg border p-3 transition-colors ${useCountry ? "bg-primary/5 border-primary/30" : "bg-muted/30"}`}>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useCountry}
                      onChange={(e) => { setUseCountry(e.target.checked); if (!e.target.checked) setCountry(""); }}
                      className="rounded accent-primary w-4 h-4"
                    />
                    <Globe className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Filter by Country</span>
                  </label>
                  {useCountry && (
                    <div className="mt-2.5">
                      <Select value={country} onValueChange={setCountry}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Choose country" /></SelectTrigger>
                        <SelectContent>
                          {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Date Filter */}
                <div className={`rounded-lg border p-3 transition-colors ${useDate ? "bg-primary/5 border-primary/30" : "bg-muted/30"}`}>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useDate}
                      onChange={(e) => { setUseDate(e.target.checked); if (!e.target.checked) { setDateFrom(""); setDateTo(""); } }}
                      className="rounded accent-primary w-4 h-4"
                    />
                    <Calendar className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Filter by Date Added</span>
                  </label>
                  {useDate && (
                    <div className="mt-2.5 grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">From</Label>
                        <Input type="date" className="h-8 text-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">To</Label>
                        <Input type="date" className="h-8 text-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Repeat Campaign Filter */}
                <div className={`rounded-lg border p-3 transition-colors ${useRepeat ? "bg-primary/5 border-primary/30" : "bg-muted/30"}`}>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useRepeat}
                      onChange={(e) => { setUseRepeat(e.target.checked); if (!e.target.checked) { setRepeatCampaignId(""); setRepeatClientIds(new Set()); } }}
                      className="rounded accent-primary w-4 h-4"
                    />
                    <Repeat2 className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Repeat from Previous Campaign</span>
                  </label>
                  {useRepeat && (
                    <div className="mt-2.5">
                      <Select value={repeatCampaignId} onValueChange={setRepeatCampaignId}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Choose previous campaign" /></SelectTrigger>
                        <SelectContent>
                          {campaigns.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name} ({new Date(c.created_at).toLocaleDateString()})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1.5">Only sends to clients from the selected campaign.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Target count */}
              <Card className={`p-3 text-sm font-medium ${targets.length === 0 ? "bg-destructive/10 text-destructive" : "bg-primary/8 text-primary"}`}>
                <span className="text-lg font-bold">{targets.length}</span> client(s) will receive this email.
              </Card>

              {/* Progress */}
              {sending && (
                <div className="space-y-2">
                  <Progress value={(progress.done / Math.max(progress.total, 1)) * 100} />
                  <div className="text-xs text-muted-foreground flex justify-between">
                    <span>{progress.done} / {progress.total}</span>
                    <span>
                      <span className="text-green-600 font-medium">{progress.success} sent</span>
                      {" · "}
                      <span className="text-destructive font-medium">{progress.fail} failed</span>
                    </span>
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={sending || targets.length === 0}>
                <Send className="w-4 h-4 mr-2" />
                {sending ? "Sending…" : `Start Campaign (${targets.length})`}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {(templates.length === 0 || clients.length === 0) && (
        <Card className="p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300">
          You need at least one{" "}
          <Link to="/app/templates" className="underline font-medium">template</Link>{" "}
          and one{" "}
          <Link to="/app/clients" className="underline font-medium">client</Link>{" "}
          to start a campaign.
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 border-b">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Campaign</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Country</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">Template</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Recipients</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Result</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Started By</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {campaigns.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No campaigns yet</td></tr>
              ) : campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5">
                    <Link to="/app/campaigns/$id" params={{ id: c.id }} className="text-primary hover:underline font-medium">{c.name}</Link>
                  </td>
                  <td className="px-4 py-2.5 hidden sm:table-cell">
                    {c.country ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-primary/8 text-primary font-medium">{c.country}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">All</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell text-muted-foreground">{c.templates?.name ?? "—"}</td>
                  <td className="px-4 py-2.5 hidden sm:table-cell font-medium">{c.total_recipients}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="inline-flex items-center gap-0.5 text-green-600 font-semibold"><CheckCircle2 className="w-3 h-3" />{c.success_count}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="inline-flex items-center gap-0.5 text-destructive font-semibold"><XCircle className="w-3 h-3" />{c.fail_count}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-2.5 hidden lg:table-cell text-muted-foreground text-xs">{c.started_by}</td>
                  <td className="px-4 py-2.5 hidden md:table-cell text-muted-foreground text-xs">{new Date(c.created_at).toLocaleString()}</td>
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
  const map: Record<string, string> = {
    completed: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
    running: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
    pending: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${map[status] ?? map.pending}`}>
      {status}
    </span>
  );
}
