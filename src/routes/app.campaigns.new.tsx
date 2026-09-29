import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { db, type Campaign, type Client, type Template } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, ArrowRight, Send, Globe, Calendar, Repeat2, Pause, Hash,
  Check, Users, Mail, Clock, ClipboardCheck,
} from "lucide-react";
import { toast } from "sonner";
import { getSession } from "@/lib/session";
import { sendMail } from "@/lib/mailApi";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/campaigns/new")({
  component: NewCampaignWizard,
});

interface SendProgress { done: number; total: number; success: number; fail: number; }

const STEPS = [
  { key: 1, label: "Audience", icon: Users },
  { key: 2, label: "Content", icon: Mail },
  { key: 3, label: "Delivery", icon: Clock },
  { key: 4, label: "Review & Send", icon: ClipboardCheck },
] as const;

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `~${totalSeconds}s`;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m < 60) return s > 0 ? `~${m}m ${s}s` : `~${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `~${h}h ${rm}m` : `~${h}h`;
}

function NewCampaignWizard() {
  const session = getSession();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [clients, setClients] = useState<Client[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

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
  const [delaySeconds, setDelaySeconds] = useState(3);

  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<SendProgress>({ done: 0, total: 0, success: 0, fail: 0 });
  const [isPausing, setIsPausing] = useState(false);
  const pauseRef = useRef(false);

  useEffect(() => {
    Promise.all([db.clients.getAll(), db.templates.getAll(), db.campaigns.getAll()])
      .then(([c, t, cp]) => { setClients(c); setTemplates(t); setCampaigns(cp); })
      .finally(() => setLoading(false));
  }, []);

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

  const selectedTemplate = templates.find((t) => t.id === templateId) ?? null;

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const runSendLoop = async (
    cid: string,
    sendTargets: Client[],
    tpl: Template,
    totalRecipients: number,
    delaySec: number,
  ) => {
    let success = 0, fail = 0;
    for (let i = 0; i < sendTargets.length; i++) {
      if (pauseRef.current) {
        await db.campaigns.update(cid, { status: "paused", success_count: success, fail_count: fail });
        toast.info(`Campaign paused — ${success + fail} of ${totalRecipients} done`);
        navigate({ to: "/app/campaigns/$id", params: { id: cid } });
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
      if (i < sendTargets.length - 1 && delaySec > 0) await sleep(delaySec * 1000);
    }
    await db.campaigns.update(cid, {
      success_count: success, fail_count: fail,
      status: fail === totalRecipients ? "failed" : "completed",
    });
    toast.success(`Done! ${success} sent · ${fail} failed`);
    navigate({ to: "/app/campaigns/$id", params: { id: cid } });
  };

  const launchCampaign = async () => {
    if (!selectedTemplate) return toast.error("Pick a template");
    if (targets.length === 0) return toast.error("No clients match your filters");

    setSending(true);
    pauseRef.current = false;
    setProgress({ done: 0, total: targets.length, success: 0, fail: 0 });

    const { id: cid } = await db.campaigns.insert({
      name, country: useCountry && country ? country : null,
      template_id: selectedTemplate.id,
      date_from: useDate && dateFrom ? dateFrom : null,
      date_to: useDate && dateTo ? dateTo : null,
      batch_from: useBatch && batchFrom ? parseInt(batchFrom) : null,
      batch_to: useBatch && batchTo ? parseInt(batchTo) : null,
      total_recipients: targets.length, success_count: 0, fail_count: 0,
      status: "running", started_by: session?.username ?? "admin",
    });

    await runSendLoop(cid, targets, selectedTemplate, targets.length, delaySeconds);
  };

  const canContinue =
    step === 1 ? name.trim().length > 0 && targets.length > 0 :
    step === 2 ? !!templateId :
    true;

  const goNext = () => {
    if (!canContinue) {
      if (step === 1 && !name.trim()) toast.error("Give this campaign a name");
      else if (step === 1) toast.error("No clients match your audience filters");
      else if (step === 2) toast.error("Pick a template");
      return;
    }
    setStep((s) => Math.min(4, s + 1));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!loading && (templates.length === 0 || clients.length === 0)) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Link to="/app/campaigns" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Campaigns
        </Link>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          You need at least one template and one client before you can start a campaign.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        {sending ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-slate-300 cursor-not-allowed">
            <ArrowLeft className="w-4 h-4" /> Back to Campaigns
          </span>
        ) : (
          <Link to="/app/campaigns" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Campaigns
          </Link>
        )}
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">New Campaign</h1>
        <p className="text-sm text-slate-500 mt-0.5">Send a targeted email blast to your clients in a few guided steps.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        {/* Step rail */}
        <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-1 md:pb-0">
          {STEPS.map((s) => {
            const done = step > s.key || sending;
            const active = step === s.key && !sending;
            return (
              <button
                key={s.key}
                type="button"
                disabled={sending}
                onClick={() => !sending && s.key < step && setStep(s.key)}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-3 rounded-xl text-left shrink-0 transition-colors",
                  active ? "bg-primary/10 border border-primary/30" : "border border-transparent",
                  s.key < step && !sending && "cursor-pointer hover:bg-slate-50",
                )}
              >
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold",
                  done ? "bg-emerald-500 text-white" : active ? "bg-primary text-white" : "bg-slate-100 text-slate-400"
                )}>
                  {done ? <Check className="w-3.5 h-3.5" /> : s.key}
                </div>
                <div className="min-w-0">
                  <div className={cn("text-sm font-medium truncate", active ? "text-primary" : done ? "text-slate-700" : "text-slate-400")}>{s.label}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Step content */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 min-h-[420px] flex flex-col">
          {sending ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8 space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Send className="w-6 h-6 text-primary animate-pulse" />
              </div>
              <div>
                <div className="text-lg font-semibold text-slate-800 dark:text-white">Sending "{name}"…</div>
                <div className="text-sm text-slate-400 mt-1">Please keep this tab open until sending finishes.</div>
              </div>
              <div className="w-full max-w-sm space-y-2">
                <Progress value={(progress.done / Math.max(progress.total, 1)) * 100} className="h-2" />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{progress.done}/{progress.total} processed</span>
                  <span>
                    <span className="text-emerald-600 font-semibold">{progress.success} sent</span>
                    {" · "}
                    <span className="text-red-600 font-semibold">{progress.fail} failed</span>
                  </span>
                </div>
              </div>
              <Button
                type="button" variant="outline" className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                onClick={() => { setIsPausing(true); pauseRef.current = true; }} disabled={isPausing}
              >
                <Pause className="w-4 h-4" />
                {isPausing ? "Pausing after current email…" : "Pause Campaign"}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex-1">
                {step === 1 && (
                  <AudienceStep
                    name={name} setName={setName}
                    useCountry={useCountry} setUseCountry={setUseCountry} country={country} setCountry={setCountry} countries={countries}
                    useDate={useDate} setUseDate={setUseDate} dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo}
                    useRepeat={useRepeat} setUseRepeat={setUseRepeat} repeatCampaignId={repeatCampaignId} setRepeatCampaignId={setRepeatCampaignId} campaigns={campaigns}
                    useBatch={useBatch} setUseBatch={setUseBatch} batchFrom={batchFrom} setBatchFrom={setBatchFrom} batchTo={batchTo} setBatchTo={setBatchTo}
                    filteredCount={filteredBase.length} targetCount={targets.length}
                  />
                )}
                {step === 2 && (
                  <ContentStep templates={templates} templateId={templateId} setTemplateId={setTemplateId} selectedTemplate={selectedTemplate} />
                )}
                {step === 3 && (
                  <DeliveryStep delaySeconds={delaySeconds} setDelaySeconds={setDelaySeconds} targetCount={targets.length} />
                )}
                {step === 4 && (
                  <ReviewStep
                    name={name} targetCount={targets.length} template={selectedTemplate}
                    country={useCountry ? country : null}
                    dateFrom={useDate ? dateFrom : null} dateTo={useDate ? dateTo : null}
                    batchFrom={useBatch ? batchFrom : null} batchTo={useBatch ? batchTo : null}
                    delaySeconds={delaySeconds}
                  />
                )}
              </div>

              <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-100 dark:border-slate-800">
                <Button type="button" variant="outline" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))} className="gap-1.5">
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>
                {step < 4 ? (
                  <Button type="button" onClick={goNext} className="gap-1.5">
                    Continue <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button type="button" onClick={launchCampaign} className="gap-1.5">
                    <Send className="w-4 h-4" /> Launch Campaign · {targets.length} recipients
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterCard({ icon: Icon, label, active, onToggle, children }: { icon: any; label: string; active: boolean; onToggle: (v: boolean) => void; children?: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border p-3.5 transition-all", active ? "border-primary/40 bg-primary/5" : "border-slate-200 bg-slate-50")}>
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input type="checkbox" checked={active} onChange={(e) => onToggle(e.target.checked)} className="rounded accent-primary w-4 h-4" />
        <Icon className={cn("w-4 h-4", active ? "text-primary" : "text-slate-400")} />
        <span className={cn("text-sm font-medium", active ? "text-slate-800" : "text-slate-500")}>{label}</span>
      </label>
      {active && children}
    </div>
  );
}

function AudienceStep(props: {
  name: string; setName: (v: string) => void;
  useCountry: boolean; setUseCountry: (v: boolean) => void; country: string; setCountry: (v: string) => void; countries: string[];
  useDate: boolean; setUseDate: (v: boolean) => void; dateFrom: string; setDateFrom: (v: string) => void; dateTo: string; setDateTo: (v: string) => void;
  useRepeat: boolean; setUseRepeat: (v: boolean) => void; repeatCampaignId: string; setRepeatCampaignId: (v: string) => void; campaigns: Campaign[];
  useBatch: boolean; setUseBatch: (v: boolean) => void; batchFrom: string; setBatchFrom: (v: string) => void; batchTo: string; setBatchTo: (v: string) => void;
  filteredCount: number; targetCount: number;
}) {
  const p = props;
  return (
    <div className="space-y-4">
      <div>
        <Label>Campaign Name *</Label>
        <Input required value={p.name} onChange={(e) => p.setName(e.target.value)} placeholder="e.g. Diwali Sale — USA Batch 1" className="mt-1.5" autoFocus />
      </div>

      <div className="space-y-2">
        <Label className="text-slate-500 text-xs uppercase tracking-wider">Who should receive this?</Label>
        <FilterCard icon={Globe} label="Filter by Country" active={p.useCountry} onToggle={(v) => { p.setUseCountry(v); if (!v) p.setCountry(""); }}>
          <Select value={p.country} onValueChange={p.setCountry}>
            <SelectTrigger className="h-8 text-sm mt-2"><SelectValue placeholder="Select country" /></SelectTrigger>
            <SelectContent>{p.countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </FilterCard>
        <FilterCard icon={Calendar} label="Filter by Date Added" active={p.useDate} onToggle={(v) => { p.setUseDate(v); if (!v) { p.setDateFrom(""); p.setDateTo(""); } }}>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div><Label className="text-xs text-slate-500">From</Label><Input type="date" className="h-8 text-sm mt-0.5" value={p.dateFrom} onChange={(e) => p.setDateFrom(e.target.value)} /></div>
            <div><Label className="text-xs text-slate-500">To</Label><Input type="date" className="h-8 text-sm mt-0.5" value={p.dateTo} onChange={(e) => p.setDateTo(e.target.value)} /></div>
          </div>
        </FilterCard>
        <FilterCard icon={Repeat2} label="Repeat from Previous Campaign" active={p.useRepeat} onToggle={(v) => { p.setUseRepeat(v); if (!v) p.setRepeatCampaignId(""); }}>
          <Select value={p.repeatCampaignId} onValueChange={p.setRepeatCampaignId}>
            <SelectTrigger className="h-8 text-sm mt-2"><SelectValue placeholder="Select previous campaign" /></SelectTrigger>
            <SelectContent>{p.campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </FilterCard>
        <FilterCard icon={Hash} label="Send Batch by Row Range" active={p.useBatch} onToggle={(v) => { p.setUseBatch(v); if (!v) { p.setBatchFrom(""); p.setBatchTo(""); } }}>
          <div className="mt-2 space-y-1.5">
            <p className="text-[11px] text-slate-500 leading-snug">
              Splits the filtered client list into a batch. Row numbers match the <strong>Clients</strong> page (oldest at top, newest at bottom).
              Example: send rows 1–300 now, rows 301–900 next week.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-slate-500">From row #</Label>
                <Input type="number" min={1} className="h-8 text-sm mt-0.5" placeholder="1" value={p.batchFrom} onChange={(e) => p.setBatchFrom(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-slate-500">To row #</Label>
                <Input type="number" min={1} className="h-8 text-sm mt-0.5" placeholder={`${p.filteredCount}`} value={p.batchTo} onChange={(e) => p.setBatchTo(e.target.value)} />
              </div>
            </div>
            <p className="text-[11px] text-slate-400">Filtered list has <strong>{p.filteredCount}</strong> clients. Leave blank to use full range.</p>
          </div>
        </FilterCard>
      </div>

      <div className={cn("rounded-xl border-2 p-4 text-sm text-center font-medium transition-colors",
        p.targetCount === 0 ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>
        <span className="text-2xl font-bold">{p.targetCount}</span>
        <span className="ml-1.5">client(s) will receive this email</span>
        {p.useBatch && p.filteredCount > 0 && (
          <div className="text-xs mt-1 opacity-70">Rows {p.batchFrom || 1}–{p.batchTo || p.filteredCount} of {p.filteredCount} filtered</div>
        )}
      </div>
    </div>
  );
}

function ContentStep({ templates, templateId, setTemplateId, selectedTemplate }: {
  templates: Template[]; templateId: string; setTemplateId: (v: string) => void; selectedTemplate: Template | null;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Email Template *</Label>
        <Select value={templateId} onValueChange={setTemplateId}>
          <SelectTrigger className="mt-1.5"><SelectValue placeholder="Choose a template" /></SelectTrigger>
          <SelectContent>
            {templates.map((t) => <SelectItem key={t.id} value={t.id}><div className="font-medium">{t.name}</div></SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {selectedTemplate ? (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Label className="text-slate-500 text-xs uppercase tracking-wider">Preview</Label>
            <span className="text-xs text-slate-500">Subject: <span className="font-medium text-slate-700">{selectedTemplate.subject}</span></span>
          </div>
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white" style={{ height: 320 }}>
            <iframe srcDoc={selectedTemplate.html} className="w-full h-full" sandbox="" title="template-preview" />
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-400">
          Pick a template above to preview it here
        </div>
      )}
    </div>
  );
}

function DeliveryStep({ delaySeconds, setDelaySeconds, targetCount }: { delaySeconds: number; setDelaySeconds: (v: number) => void; targetCount: number }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-700">Delay between emails</div>
            <div className="text-xs text-slate-400 mt-0.5 leading-snug">Slows sending to avoid spam filters. 2–5 s recommended for large lists.</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {[0, 1, 2, 3, 5, 10].map((s) => (
              <button
                key={s} type="button" onClick={() => setDelaySeconds(s)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors",
                  delaySeconds === s ? "bg-primary text-white border-primary" : "bg-white text-slate-600 border-slate-200 hover:border-primary hover:text-primary"
                )}
              >
                {s === 0 ? "None" : `${s}s`}
              </button>
            ))}
          </div>
        </div>
        {delaySeconds > 0 && targetCount > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-500 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>Estimated time: <strong className="text-slate-700">{formatDuration(targetCount * delaySeconds)}</strong> for {targetCount} emails at {delaySeconds}s each</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewStep({ name, targetCount, template, country, dateFrom, dateTo, batchFrom, batchTo, delaySeconds }: {
  name: string; targetCount: number; template: Template | null;
  country: string | null; dateFrom: string | null; dateTo: string | null;
  batchFrom: string | null; batchTo: string | null; delaySeconds: number;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
        <ReviewRow label="Campaign name" value={name} />
        <ReviewRow label="Recipients" value={`${targetCount} client(s)`} />
        <ReviewRow label="Template" value={template?.name ?? "—"} />
        <ReviewRow label="Subject" value={template?.subject ?? "—"} />
        <ReviewRow label="Country filter" value={country || "All countries"} />
        <ReviewRow label="Date filter" value={dateFrom || dateTo ? `${dateFrom || "…"} → ${dateTo || "…"}` : "None"} />
        <ReviewRow label="Batch range" value={batchFrom || batchTo ? `Rows ${batchFrom || 1} – ${batchTo || "end"}` : "Full list"} />
        <ReviewRow label="Delay between emails" value={delaySeconds === 0 ? "None" : `${delaySeconds}s${targetCount > 0 ? ` · ${formatDuration(targetCount * delaySeconds)} total` : ""}`} />
      </div>
      <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-medium text-emerald-700">
        Ready to send. This starts immediately once you click Launch.
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800 dark:text-white text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}
