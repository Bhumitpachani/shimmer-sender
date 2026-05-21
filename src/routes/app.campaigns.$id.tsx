import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/app/campaigns/$id")({
  component: CampaignDetail,
});

function CampaignDetail() {
  const { id } = Route.useParams();
  const [campaign, setCampaign] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: c } = await supabase.from("campaigns").select("*, templates(name, subject)").eq("id", id).maybeSingle();
      setCampaign(c);
      const { data: h } = await supabase.from("send_history").select("*, clients(name, country)").eq("campaign_id", id).order("sent_at");
      setHistory(h ?? []);
    })();
  }, [id]);

  if (!campaign) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-5">
      <Link to="/app/campaigns" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to campaigns
      </Link>
      <Card className="p-6">
        <h1 className="text-2xl font-bold">{campaign.name}</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
          <Field label="Country" value={campaign.country} />
          <Field label="Template" value={campaign.templates?.name ?? "—"} />
          <Field label="Subject" value={campaign.templates?.subject ?? "—"} />
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
            <thead className="bg-muted">
              <tr className="text-left">
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="px-3 py-2 text-muted-foreground">{new Date(h.sent_at).toLocaleString()}</td>
                  <td className="px-3 py-2">{h.clients?.name ?? "—"}</td>
                  <td className="px-3 py-2">{h.client_email}</td>
                  <td className="px-3 py-2">
                    {h.status === "success" ? (
                      <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="w-3 h-3" /> Success</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-destructive"><XCircle className="w-3 h-3" /> Failed</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground max-w-xs truncate" title={h.error ?? ""}>{h.error ?? "—"}</td>
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
      <div className="text-xs text-muted-foreground uppercase">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
