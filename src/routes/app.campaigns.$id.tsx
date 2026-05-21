import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/app/campaigns/$id")({
  component: CampaignDetail,
});

function CampaignDetail() {
  const { id } = Route.useParams();
  const [campaign] = useState(() => db.campaigns.getById(id));
  const [history] = useState(() => db.sendHistory.getByCampaignId(id));
  const [templates] = useState(() => db.templates.getAll());
  const [clients] = useState(() => db.clients.getAll());

  if (!campaign) return (
    <div className="space-y-4">
      <Link to="/app/campaigns" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground gap-1">
        <ArrowLeft className="w-4 h-4" /> Back to campaigns
      </Link>
      <p className="text-sm text-muted-foreground">Campaign not found.</p>
    </div>
  );

  const tpl = templates.find((t) => t.id === campaign.template_id);
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]));

  return (
    <div className="space-y-5">
      <Link to="/app/campaigns" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground gap-1">
        <ArrowLeft className="w-4 h-4" /> Back to campaigns
      </Link>

      <Card className="p-6">
        <h1 className="text-2xl font-bold">{campaign.name}</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
          <Field label="Country" value={campaign.country ?? "All"} />
          <Field label="Template" value={tpl?.name ?? "—"} />
          <Field label="Subject" value={tpl?.subject ?? "—"} />
          <Field label="Status" value={campaign.status} />
          <Field label="Recipients" value={String(campaign.total_recipients)} />
          <Field label="Success" value={String(campaign.success_count)} />
          <Field label="Failed" value={String(campaign.fail_count)} />
          <Field label="Started by" value={campaign.started_by} />
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold mb-3">Send Log ({history.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 border-b">
              <tr className="text-left">
                <th className="px-3 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Time</th>
                <th className="px-3 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Client</th>
                <th className="px-3 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Email</th>
                <th className="px-3 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-3 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {history.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground text-sm">No send history yet.</td></tr>
              ) : history.map((h) => (
                <tr key={h.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 text-muted-foreground text-xs">{new Date(h.sent_at).toLocaleString()}</td>
                  <td className="px-3 py-2 hidden sm:table-cell">{h.client_id ? (clientMap[h.client_id]?.name ?? "—") : "—"}</td>
                  <td className="px-3 py-2">{h.client_email}</td>
                  <td className="px-3 py-2">
                    {h.status === "success" ? (
                      <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium"><CheckCircle2 className="w-3 h-3" /> Success</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-destructive text-xs font-medium"><XCircle className="w-3 h-3" /> Failed</span>
                    )}
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell text-xs text-muted-foreground max-w-xs truncate" title={h.error ?? ""}>{h.error ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">{label}</div>
      <div className="font-medium capitalize">{value}</div>
    </div>
  );
}
