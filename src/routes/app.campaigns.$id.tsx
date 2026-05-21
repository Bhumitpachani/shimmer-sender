import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ArrowLeft, CheckCircle2, XCircle, Send, Users, TrendingUp, AlertCircle, User } from "lucide-react";

export const Route = createFileRoute("/app/campaigns/$id")({
  component: CampaignDetail,
});

function cn(...cls: (string | boolean | undefined | null)[]) {
  return cls.filter(Boolean).join(" ");
}

function CampaignDetail() {
  const { id } = Route.useParams();
  const session = getSession();
  const isAdmin = session?.role === "admin";

  const [campaign] = useState(() => db.campaigns.getById(id));
  const [allHistory] = useState(() => db.sendHistory.getByCampaignId(id));
  const [templates] = useState(() => db.templates.getAll());
  const [clients] = useState(() => db.clients.getAll());

  if (!campaign) {
    return (
      <div className="space-y-4">
        <Link
          to="/app/campaigns"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Campaigns
        </Link>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-14 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600">Campaign not found</p>
          <p className="text-xs text-slate-400 mt-1">This campaign may have been deleted.</p>
        </div>
      </div>
    );
  }

  const tpl = templates.find((t) => t.id === campaign.template_id);
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]));
  const total = campaign.total_recipients || 1;
  const successRate = Math.round((campaign.success_count / total) * 100);

  const history = isAdmin
    ? allHistory
    : allHistory.filter((h) => h.sent_by === session?.username);

  const statusColors: Record<string, string> = {
    completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
    running: "bg-amber-100 text-amber-700 border-amber-200",
    failed: "bg-red-100 text-red-600 border-red-200",
    pending: "bg-slate-100 text-slate-500 border-slate-200",
  };

  const sentByList = isAdmin
    ? Array.from(new Set(allHistory.map((h) => h.sent_by))).filter(Boolean)
    : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link
          to="/app/campaigns"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Campaigns
        </Link>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Send className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">{campaign.name}</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Started by <span className="font-medium text-slate-700">{campaign.started_by}</span>
                  {" · "}{new Date(campaign.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          <span className={cn("px-3 py-1 rounded-full text-xs font-semibold capitalize border self-start", statusColors[campaign.status] ?? statusColors.pending)}>
            {campaign.status}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <InfoField label="Template" value={tpl?.name ?? "—"} />
          <InfoField label="Subject" value={tpl?.subject ?? "—"} />
          <InfoField label="Country Filter" value={campaign.country ?? "All clients"} />
          <InfoField label="Date Range" value={campaign.date_from ? `${campaign.date_from} → ${campaign.date_to ?? "…"}` : "No filter"} />
        </div>

        {isAdmin && sentByList.length > 1 && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-2 items-center">
            <span className="text-xs text-slate-400 font-medium">Sent by:</span>
            {sentByList.map((u) => (
              <span key={u} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                <User className="w-3 h-3" />{u}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatTile icon={Users} label="Recipients" value={campaign.total_recipients} color="bg-slate-50 text-slate-600" />
        <StatTile icon={CheckCircle2} label="Delivered" value={campaign.success_count} color="bg-emerald-50 text-emerald-600" />
        <StatTile icon={XCircle} label="Failed" value={campaign.fail_count} color="bg-red-50 text-red-500" />
        <StatTile icon={TrendingUp} label="Success Rate" value={`${successRate}%`} color="bg-blue-50 text-blue-600" raw />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 dark:text-white">Send Log</h2>
          <div className="flex items-center gap-2">
            {!isAdmin && allHistory.length !== history.length && (
              <span className="text-xs text-slate-400">Showing your {history.length} of {allHistory.length} entries</span>
            )}
            <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full font-medium">{history.length} entries</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Client</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                {isAdmin && <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Sent By</th>}
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-4 py-14 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                        <Send className="w-4 h-4 text-slate-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-600">No send history</p>
                      <p className="text-xs text-slate-400">Emails haven't been sent for this campaign yet</p>
                    </div>
                  </td>
                </tr>
              ) : history.map((h) => {
                const client = h.client_id ? clientMap[h.client_id] : null;
                return (
                  <tr key={h.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{new Date(h.sent_at).toLocaleString()}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {client ? (
                        <Link to="/app/clients/$id" params={{ id: client.id }} className="font-medium text-slate-700 hover:text-primary transition-colors">
                          {client.name}
                        </Link>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">{h.client_email}</td>
                    <td className="px-4 py-3">
                      {h.status === "success" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Delivered
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                          <XCircle className="w-3 h-3" /> Failed
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                          <User className="w-2.5 h-2.5" />{h.sent_by}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-slate-400 max-w-[200px] truncate" title={h.error ?? ""}>
                      {h.error ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-sm font-medium text-slate-800 dark:text-white">{value}</div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, color, raw }: { icon: any; label: string; value: number | string; color: string; raw?: boolean }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center mb-3", color)}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-white">{raw ? value : Number(value).toLocaleString()}</div>
      <div className="text-xs text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}
