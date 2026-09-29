import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { db, type Campaign, type Client, type Template } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Send, Plus, Globe, Eye, RefreshCw, Play, Pause, Search, X } from "lucide-react";
import { toast } from "sonner";
import { getSession } from "@/lib/session";
import { sendMail } from "@/lib/mailApi";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/app/campaigns")({
  component: CampaignsPage,
});

interface SendProgress { done: number; total: number; success: number; fail: number; }

const STATUS_OPTIONS = ["all", "pending", "running", "paused", "completed", "failed"] as const;

function CampaignsPage() {
  const session = getSession();
  const navigate = useNavigate();
  const isEmployee = session?.role === "employee";

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("all");

  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<SendProgress>({ done: 0, total: 0, success: 0, fail: 0 });
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

      const interrupted = allCampaigns.filter((c) => c.status === "running");
      if (interrupted.length > 0) {
        await Promise.all(
          interrupted.map(async (c) => {
            const hist = await db.sendHistory.getByCampaignId(c.id);
            const s = hist.filter((h) => h.status === "success").length;
            const f = hist.filter((h) => h.status === "fail").length;
            await db.campaigns.update(c.id, { status: "paused", success_count: s, fail_count: f });
            c.status = "paused";
            c.success_count = s;
            c.fail_count = f;
          })
        );
      }

      setCampaigns(isEmployee ? allCampaigns.filter((c) => c.started_by === session?.username) : allCampaigns);
      setClients(allClients);
      setTemplates(allTemplates);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => campaigns.filter((c) => {
    if (status !== "all" && c.status !== status) return false;
    if (search) {
      const s = search.toLowerCase();
      const tpl = templates.find((t) => t.id === c.template_id);
      return [c.name, tpl?.name ?? "", c.started_by, c.country ?? ""].some((v) => v.toLowerCase().includes(s));
    }
    return true;
  }), [campaigns, search, status, templates]);

  const hasFilters = search !== "" || status !== "all";

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const openResume = async (campaign: Campaign) => {
    const history = await db.sendHistory.getByCampaignId(campaign.id);
    const actualSuccess = history.filter((h) => h.status === "success").length;
    const actualFail = history.filter((h) => h.status === "fail").length;
    const alreadySentIds = new Set(history.filter((h) => h.client_id).map((h) => h.client_id!));
    const remaining = campaign.total_recipients - alreadySentIds.size;

    if (campaign.status === "running" || campaign.success_count !== actualSuccess || campaign.fail_count !== actualFail) {
      await db.campaigns.update(campaign.id, {
        status: "paused",
        success_count: actualSuccess,
        fail_count: actualFail,
      });
      campaign = { ...campaign, status: "paused", success_count: actualSuccess, fail_count: actualFail };
    }

    setResumeTarget(campaign);
    setResumeRemaining(remaining);
    setResumeOpen(true);
    await load();
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

    let success = campaign.success_count, fail = campaign.fail_count;
    let paused = false;
    for (let i = 0; i < remaining.length; i++) {
      if (pauseRef.current) {
        paused = true;
        await db.campaigns.update(campaign.id, { status: "paused", success_count: success, fail_count: fail });
        toast.info(`Campaign paused — ${success + fail} of ${campaign.total_recipients} done`);
        break;
      }
      const c = remaining[i];
      const res = await sendMail({ to: c.email, subject: tpl.subject, html: tpl.html });
      if (res.ok) success++; else fail++;
      await db.sendHistory.insert({
        campaign_id: campaign.id, client_id: c.id, client_email: c.email,
        template_id: tpl.id, template_name: tpl.name,
        status: res.ok ? "success" : "fail", error: res.error ?? null,
        sent_by: session?.username ?? "admin",
      });
      await db.campaigns.update(campaign.id, { success_count: success, fail_count: fail });
      setProgress({ done: success + fail, total: campaign.total_recipients, success, fail });
      if (i < remaining.length - 1) await sleep(1500);
    }
    if (!paused) {
      await db.campaigns.update(campaign.id, {
        success_count: success, fail_count: fail,
        status: fail === campaign.total_recipients ? "failed" : "completed",
      });
      toast.success(`Done! ${success} sent · ${fail} failed`);
    }
    setSending(false);
    setIsPausing(false);
    pauseRef.current = false;
    setResumeTarget(null);
    await load();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Campaigns"
        count={campaigns.length}
        subtitle={isEmployee ? "Your launched campaigns" : "Send email blasts and track delivery results"}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => load()} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />Refresh
            </Button>
            <Link to="/app/campaigns/new">
              <Button className="gap-1.5 shadow-sm shadow-primary/20" disabled={templates.length === 0 || clients.length === 0}>
                <Plus className="w-4 h-4" />New Campaign
              </Button>
            </Link>
          </>
        }
      />

      {!loading && (templates.length === 0 || clients.length === 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          You need at least one template and one client before you can start a campaign.
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-3 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search campaigns, templates, sender…" className="pl-9 h-9 bg-slate-50 border-slate-200" value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="h-9 text-sm bg-slate-50 sm:w-44 shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s === "all" ? "All statuses" : s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

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
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={!isEmployee ? 8 : 7} className="px-4 py-14 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                        <Send className="w-4 h-4 text-slate-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-600">{hasFilters ? "No campaigns match your search" : "No campaigns yet"}</p>
                      <p className="text-xs text-slate-400">{hasFilters ? "Try a different search or status filter" : "Launch your first campaign to start reaching clients"}</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map((c) => {
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
                        {(c.status === "paused" || c.status === "running") && (
                          <button
                            onClick={() => openResume(c)}
                            className={cn(
                              "p-1.5 rounded-lg transition-colors",
                              c.status === "running"
                                ? "bg-red-50 hover:bg-red-100 text-red-500"
                                : "bg-amber-50 hover:bg-amber-100 text-amber-600"
                            )}
                            title={c.status === "running" ? "Interrupted — click to recover & resume" : "Resume campaign"}
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
