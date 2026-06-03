import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { db, type Campaign, type Client, type Template } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Send, Plus, Globe, Calendar, Repeat2, Eye, RefreshCw, Play, Pause, Hash } from "lucide-react";
import { toast } from "sonner";
import { getSession } from "@/lib/session";
import { sendMail } from "@/lib/mailApi";

export const Route = createFileRoute("/app/campaigns")({
  component: CampaignsPage,
});

function cn(...cls: (string | boolean | undefined | null)[]) { return cls.filter(Boolean).join(" "); }

interface Progress { done: number; total: number; success: number; fail: number; }

function CampaignsPage() {
  const session = getSession();
  const navigate = useNavigate();
  const isEmployee = session?.role === "employee";

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [repeatIds, setRepeatIds] = useState<Set<string>>(new Set());
  const [useBatch, setUseBatch] = useState(false);
  const [batchFrom, setBatchFrom] = useState("");
  const [batchTo, setBatchTo] = useState("");

  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<Progress>({ done: 0, total: 0, success: 0, fail: 0 });
  const [isPausing, setIsPausing] = useState(false);
  const pauseRef = useRef(false);

  const [resumeOpen, setResumeOpen] = useState(false);
  const [resumeTarget, setResumeTarget] = useState<Campaign | null>(null);
  const [resumeRemaining, setResumeRemaining] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const [allCampaigns, allClients, allTemplates] = await Promise.all([
        db.campaigns.getAll(),
        db.clients.getAll(),
        db.templates.getAll(),
      ]);
      setCampaigns(isEmployee ? allCampaigns.filter((c) => c.started_by === session?.username) : allCampaigns);
      setClients(allClients);
      setTemplates(allTemplates);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!useRepeat || !repeatCampaignId) { setRepeatIds(new Set()); return; }
    db.sendHistory.getClientIdsByCampaignId(repeatCampaignId).then(setRepeatIds);
  }, [useRepeat, repeatCampaignId]);

  const countries = useMemo(() => Array.from(new Set(clients.map((c) => c.country))).filter(Boolean).sort(), [clients]);

  const filteredBase = useMemo(() => clients.filter((c) => {
    if (useCountry && country && c.country !== country) return false;
    if (useDate && dateFrom && new Date(c.created_at) < new Date(dateFrom)) return false;
    if (useDate && dateTo && new Date(c.created_at) > new Date(dateTo + "T23:59:59")) return false;
    if (useRepeat && repeatCampaignId && repeatIds.size > 0 && !repeatIds.has(c.id)) return false;
    return true;
  }), [clients, useCountry, country, useDate, dateFrom, dateTo, useRepeat, repeatCampaignId, repeatIds]);

  const targets = useMemo(() => {
    if (!useBatch) return filteredBase;
    const from = Math.max(1, parseInt(batchFrom) || 1);
    const to = parseInt(batchTo) || filteredBase.length;
    return filteredBase.slice(from - 1, to);
  }, [filteredBase, useBatch, batchFrom, batchTo]);

  const reset = () => {
    setName(""); setTemplateId(""); setUseCountry(false); setCountry("");
    setUseDate(false); setDateFrom(""); setDateTo("");
    setUseRepeat(false); setRepeatCampaignId(""); setRepeatIds(new Set());
    setUseBatch(false); setBatchFrom(""); setBatchTo("");
  };

  const runSendLoop = async (
    cid: string,
    sendTargets: Client[],
    tpl: Template,
    initSuccess: number,
    initFail: number,
    totalRecipients: number,
    onDone: () => void,
  ) => {
    let success = initSuccess, fail = initFail;
    for (let i = 0; i < sendTargets.length; i++) {
      if (pauseRef.current) {
        await db.campaigns.update(cid, { status: "paused", success_count: success, fail_count: fail });
        setSending(false); setIsPausing(false); pauseRef.current = false;
        toast.info(`Campaign paused — ${success + fail} of ${totalRecipients} done`);
        onDone();
        await load();
        return;
      }
      const c = sendTargets[i];
      const res = await sendMail({ to: c.email, subject: tpl.subject, html: tpl.html });
      if (res.ok) success++; else fail++;
      await db.sendHistory.insert({
        campaign_id: cid, client_id: c.id, client_email: c.email,
        template_id: tpl.id, template_name: tpl.name,
        status: res.ok ? "success" : "fail", error: res.error ?? null,
        sent_by: session?.username ?? "admin",
      });
      await db.campaigns.update(cid, { success_count: success, fail_count: fail });
      setProgress({ done: success + fail, total: totalRecipients, success, fail });
    }
    await db.campaigns.update(cid, {
      success_count: success, fail_count: fail,
      status: fail === totalRecipients ? "failed" : "completed",
    });
    setSending(false);
    toast.success(`Done! ${success} sent · ${fail} failed`);
    onDone();
    await load();
  };

  const startCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return toast.error("Pick a template");
    if (targets.length === 0) return toast.error("No clients match your filters");
    if (!confirm(`Send "${tpl.name}" to ${targets.length} client(s)?`)) return;

    setSending(true);
    pauseRef.current = false;
    setProgress({ done: 0, total: targets.length, success: 0, fail: 0 });

    const { id: cid } = await db.campaigns.insert({
      name, country: useCountry && country ? country : null,
      template_id: tpl.id,
      date_from: useDate && dateFrom ? dateFrom : null,
      date_to: useDate && dateTo ? dateTo : null,
      batch_from: useBatch && batchFrom ? parseInt(batchFrom) : null,
      batch_to: useBatch && batchTo ? parseInt(batchTo) : null,
      total_recipients: targets.length, success_count: 0, fail_count: 0,
      status: "running", started_by: session?.username ?? "admin",
    });

    await runSendLoop(cid, targets, tpl, 0, 0, targets.length, () => {
      setOpen(false);
      reset();
    });
  };

  const openResume = async (campaign: Campaign) => {
    const alreadySentIds = await db.sendHistory.getClientIdsByCampaignId(campaign.id);
    const remaining = campaign.total_recipients - alreadySentIds.size;
    setResumeTarget(campaign);
    setResumeRemaining(remaining);
    setResumeOpen(true);
  };

  const resumeCampaign = async () => {
    const campaign = resumeTarget;
    if (!campaign) return;
    const tpl = templates.find((t) => t.id === campaign.template_id);
    if (!tpl) return toast.error("Template not found");

    const allClients = await db.clients.getAll();
    let targetClients = allClients;
    if (campaign.country) targetClients = targetClients.filter((c) => c.country === campaign.country);
    if (campaign.date_from) targetClients = targetClients.filter((c) => new Date(c.created_at) >= new Date(campaign.date_from!));
    if (campaign.date_to) targetClients = targetClients.filter((c) => new Date(c.created_at) <= new Date(campaign.date_to! + "T23:59:59"));
    if (campaign.batch_from || campaign.batch_to) {
      const from = campaign.batch_from ? campaign.batch_from - 1 : 0;
      const to = campaign.batch_to ?? targetClients.length;
      targetClients = targetClients.slice(from, to);
    }

    const alreadySentIds = await db.sendHistory.getClientIdsByCampaignId(campaign.id);
    const remaining = targetClients.filter((c) => !alreadySentIds.has(c.id));

    if (remaining.length === 0) {
      await db.campaigns.update(campaign.id, { status: "completed" });
      toast.success("Campaign is already fully sent — marked as completed");
      setResumeOpen(false); setResumeTarget(null);
      await load();
      return;
    }

    setResumeOpen(false);
    setSending(true);
    pauseRef.current = false;
    setProgress({ done: campaign.success_count + campaign.fail_count, total: campaign.total_recipients, success: campaign.success_count, fail: campaign.fail_count });
    await db.campaigns.update(campaign.id, { status: "running" });

    await runSendLoop(campaign.id, remaining, tpl, campaign.success_count, campaign.fail_count, campaign.total_recipients, () => {
      setResumeTarget(null);
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Campaigns</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">{campaigns.length}</span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            {isEmployee ? "Your launched campaigns" : "Send email blasts and track delivery results"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => load()} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />Refresh
          </Button>
          <Dialog open={open} onOpenChange={(v) => { if (!sending) { setOpen(v); if (!v) reset(); } }}>
            <DialogTrigger asChild>
              <Button className="gap-1.5 shadow-sm shadow-primary/20" disabled={templates.length === 0 || clients.length === 0}>
                <Plus className="w-4 h-4" />New Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Launch New Campaign</DialogTitle></DialogHeader>
              <form onSubmit={startCampaign} className="space-y-4 pt-1">
                <div>
                  <Label>Campaign Name *</Label>
                  <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Diwali Sale — USA Batch 1" className="mt-1" />
                </div>
                <div>
                  <Label>Email Template *</Label>
                  <Select value={templateId} onValueChange={setTemplateId} required>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Choose a template" /></SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => <SelectItem key={t.id} value={t.id}><div className="font-medium">{t.name}</div></SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-500 text-xs uppercase tracking-wider">Optional Filters</Label>
                  <FilterBlock icon={Globe} label="Filter by Country" active={useCountry} onToggle={(v) => { setUseCountry(v); if (!v) setCountry(""); }}>
                    <Select value={country} onValueChange={setCountry}>
                      <SelectTrigger className="h-8 text-sm mt-2"><SelectValue placeholder="Select country" /></SelectTrigger>
                      <SelectContent>{countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </FilterBlock>
                  <FilterBlock icon={Calendar} label="Filter by Date Added" active={useDate} onToggle={(v) => { setUseDate(v); if (!v) { setDateFrom(""); setDateTo(""); } }}>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div><Label className="text-xs text-slate-500">From</Label><Input type="date" className="h-8 text-sm mt-0.5" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
                      <div><Label className="text-xs text-slate-500">To</Label><Input type="date" className="h-8 text-sm mt-0.5" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
                    </div>
                  </FilterBlock>
                  <FilterBlock icon={Repeat2} label="Repeat from Previous Campaign" active={useRepeat} onToggle={(v) => { setUseRepeat(v); if (!v) setRepeatCampaignId(""); }}>
                    <Select value={repeatCampaignId} onValueChange={setRepeatCampaignId}>
                      <SelectTrigger className="h-8 text-sm mt-2"><SelectValue placeholder="Select previous campaign" /></SelectTrigger>
                      <SelectContent>{campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </FilterBlock>
                  <FilterBlock icon={Hash} label="Send Batch by Row Range" active={useBatch} onToggle={(v) => { setUseBatch(v); if (!v) { setBatchFrom(""); setBatchTo(""); } }}>
                    <div className="mt-2 space-y-1.5">
                      <p className="text-[11px] text-slate-500 leading-snug">
                        Splits the filtered client list into a batch. Row numbers match the <strong>Clients</strong> page (oldest at top, newest at bottom).
                        Example: send rows 1–300 now, rows 301–900 next week.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-slate-500">From row #</Label>
                          <Input type="number" min={1} className="h-8 text-sm mt-0.5" placeholder={`1`} value={batchFrom} onChange={(e) => setBatchFrom(e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">To row #</Label>
                          <Input type="number" min={1} className="h-8 text-sm mt-0.5" placeholder={`${filteredBase.length}`} value={batchTo} onChange={(e) => setBatchTo(e.target.value)} />
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Filtered list has <strong>{filteredBase.length}</strong> clients. Leave blank to use full range.
                      </p>
                    </div>
                  </FilterBlock>
                </div>

                <div className={cn("rounded-xl border-2 p-4 text-sm text-center font-medium transition-colors",
                  targets.length === 0 ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>
                  <span className="text-2xl font-bold">{targets.length}</span>
                  <span className="ml-1.5">client(s) will receive this email</span>
                  {useBatch && filteredBase.length > 0 && (
                    <div className="text-xs mt-1 opacity-70">
                      Rows {batchFrom || 1}–{batchTo || filteredBase.length} of {filteredBase.length} filtered
                    </div>
                  )}
                </div>

                {sending && (
                  <div className="space-y-2">
                    <Progress value={(progress.done / Math.max(progress.total, 1)) * 100} className="h-2" />
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>{progress.done}/{progress.total} processed</span>
                      <span>
                        <span className="text-emerald-600 font-semibold">{progress.success} sent</span>
                        {" · "}
                        <span className="text-red-600 font-semibold">{progress.fail} failed</span>
                      </span>
                    </div>
                    <Button type="button" variant="outline" className="w-full gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                      onClick={() => { setIsPausing(true); pauseRef.current = true; }} disabled={isPausing}>
                      <Pause className="w-4 h-4" />
                      {isPausing ? "Pausing after current email…" : "Pause Campaign"}
                    </Button>
                  </div>
                )}

                {!sending && (
                  <Button type="submit" className="w-full h-10" disabled={targets.length === 0}>
                    <Send className="w-4 h-4 mr-2" />
                    Launch Campaign · {targets.length} recipients
                  </Button>
                )}
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!loading && (templates.length === 0 || clients.length === 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          You need at least one template and one client before you can start a campaign.
        </div>
      )}

      {sending && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-amber-800">Sending in progress…</div>
            <div className="mt-1.5">
              <Progress value={(progress.done / Math.max(progress.total, 1)) * 100} className="h-1.5" />
            </div>
            <div className="text-xs text-amber-700 mt-1">{progress.done}/{progress.total} · ✓ {progress.success} · ✗ {progress.fail}</div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Campaign</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Template</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Filter</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Delivery</th>
                {!isEmployee && <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Started By</th>}
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Date</th>
                <th className="px-4 py-3 text-right w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={!isEmployee ? 8 : 7} className="px-4 py-14 text-center">
                    <div className="flex justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
                  </td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan={!isEmployee ? 8 : 7} className="px-4 py-14 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                        <Send className="w-4 h-4 text-slate-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-600">No campaigns yet</p>
                      <p className="text-xs text-slate-400">Launch your first campaign to start reaching clients</p>
                    </div>
                  </td>
                </tr>
              ) : campaigns.map((c) => {
                const tpl = templates.find((t) => t.id === c.template_id);
                const total = c.total_recipients || 1;
                const rate = Math.round((c.success_count / total) * 100);
                return (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                    onClick={() => navigate({ to: "/app/campaigns/$id", params: { id: c.id } })}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800 dark:text-white hover:text-primary transition-colors">{c.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-400">{c.total_recipients} recipients</span>
                        {(c.batch_from || c.batch_to) && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 font-medium border border-violet-100">
                            Rows {c.batch_from ?? 1}–{c.batch_to ?? "end"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-slate-600 dark:text-slate-400 text-xs">{tpl?.name ?? "—"}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {c.country
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700"><Globe className="w-2.5 h-2.5 mr-1" />{c.country}</span>
                        : <span className="text-xs text-slate-400">All clients</span>}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden w-16">
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${rate}%` }} />
                        </div>
                        <div className="flex items-center gap-1.5 text-xs shrink-0">
                          <span className="text-emerald-600 font-medium">{c.success_count}</span>
                          <span className="text-slate-300">/</span>
                          <span className="text-red-500 font-medium">{c.fail_count}</span>
                        </div>
                      </div>
                    </td>
                    {!isEmployee && (
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{c.started_by}</span>
                      </td>
                    )}
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 hidden lg:table-cell text-slate-400 text-xs">{new Date(c.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {c.status === "paused" && (
                          <button
                            onClick={() => openResume(c)}
                            className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors text-amber-600"
                            title="Resume campaign"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => navigate({ to: "/app/campaigns/$id", params: { id: c.id } })}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-primary"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={resumeOpen} onOpenChange={(v) => { if (!sending) { setResumeOpen(v); if (!v) setResumeTarget(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Resume Campaign</DialogTitle></DialogHeader>
          {resumeTarget && (
            <div className="space-y-4 pt-1">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm space-y-1.5">
                <div className="font-semibold text-slate-800">{resumeTarget.name}</div>
                <div className="text-slate-500 text-xs">
                  Progress: <span className="font-medium text-slate-700">{resumeTarget.success_count + resumeTarget.fail_count}</span> of <span className="font-medium text-slate-700">{resumeTarget.total_recipients}</span> sent
                </div>
                <Progress value={((resumeTarget.success_count + resumeTarget.fail_count) / Math.max(resumeTarget.total_recipients, 1)) * 100} className="h-1.5 mt-2" />
                <div className="flex justify-between text-xs pt-1">
                  <span className="text-emerald-600 font-medium">✓ {resumeTarget.success_count} delivered</span>
                  <span className="text-red-500 font-medium">✗ {resumeTarget.fail_count} failed</span>
                </div>
              </div>
              <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-3.5 text-center">
                <div className="text-2xl font-bold text-amber-700">{resumeRemaining}</div>
                <div className="text-xs text-amber-600 mt-0.5">emails still pending — will resume from here</div>
              </div>
              {sending ? (
                <div className="space-y-2">
                  <Progress value={(progress.done / Math.max(progress.total, 1)) * 100} className="h-2" />
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{progress.done}/{progress.total} processed</span>
                    <span className="text-emerald-600 font-semibold">{progress.success} sent · {progress.fail} failed</span>
                  </div>
                  <Button type="button" variant="outline" className="w-full gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                    onClick={() => { setIsPausing(true); pauseRef.current = true; }} disabled={isPausing}>
                    <Pause className="w-4 h-4" />
                    {isPausing ? "Pausing after current email…" : "Pause Again"}
                  </Button>
                </div>
              ) : (
                <Button className="w-full gap-2" onClick={resumeCampaign} disabled={resumeRemaining === 0}>
                  <Play className="w-4 h-4" />
                  Resume — send {resumeRemaining} remaining emails
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterBlock({ icon: Icon, label, active, onToggle, children }: { icon: any; label: string; active: boolean; onToggle: (v: boolean) => void; children?: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border p-3 transition-all", active ? "border-primary/40 bg-primary/5" : "border-slate-200 bg-slate-50")}>
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input type="checkbox" checked={active} onChange={(e) => onToggle(e.target.checked)} className="rounded accent-primary w-4 h-4" />
        <Icon className={cn("w-4 h-4", active ? "text-primary" : "text-slate-400")} />
        <span className={cn("text-sm font-medium", active ? "text-slate-800" : "text-slate-500")}>{label}</span>
      </label>
      {active && children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-emerald-100 text-emerald-700",
    running:   "bg-blue-100 text-blue-700",
    paused:    "bg-amber-100 text-amber-700",
    failed:    "bg-red-100 text-red-600",
    pending:   "bg-slate-100 text-slate-500",
  };
  return <span className={cn("text-[11px] px-2.5 py-0.5 rounded-full font-semibold capitalize", map[status] ?? map.pending)}>{status}</span>;
}
