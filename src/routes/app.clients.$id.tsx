import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/app/clients/$id")({
  component: ClientDetail,
});

function ClientDetail() {
  const { id } = Route.useParams();
  const [client, setClient] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: c } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
      setClient(c);
      const { data: h } = await supabase
        .from("send_history")
        .select("*")
        .eq("client_id", id)
        .order("sent_at", { ascending: false });
      setHistory(h ?? []);
    })();
  }, [id]);

  if (!client) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-5">
      <Link to="/app/clients" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to clients
      </Link>
      <Card className="p-6">
        <h1 className="text-2xl font-bold">{client.name}</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
          <Field label="Email" value={client.email} />
          <Field label="Mobile" value={client.mobile} />
          <Field label="Country" value={client.country} />
          <Field label="Company" value={client.company ?? "—"} />
          <Field label="Added by" value={client.added_by} />
          <Field label="Created" value={new Date(client.created_at).toLocaleString()} />
        </div>
      </Card>
      <Card className="p-5">
        <h2 className="font-semibold mb-3">Email History ({history.length})</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No emails sent to this client yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr className="text-left">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Template</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Sent by</th>
                  <th className="px-3 py-2">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="px-3 py-2">{new Date(h.sent_at).toLocaleString()}</td>
                    <td className="px-3 py-2">{h.template_name ?? "—"}</td>
                    <td className="px-3 py-2">
                      {h.status === "success" ? (
                        <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="w-3 h-3" /> Success</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-destructive"><XCircle className="w-3 h-3" /> Failed</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{h.sent_by}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground max-w-xs truncate" title={h.error ?? ""}>{h.error ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
