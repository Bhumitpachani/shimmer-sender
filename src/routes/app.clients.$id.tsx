import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/app/clients/$id")({
  component: ClientDetail,
});

function ClientDetail() {
  const { id } = Route.useParams();
  const [client] = useState(() => db.clients.getById(id));
  const [history] = useState(() => db.sendHistory.getByClientId(id));

  if (!client) return (
    <div className="space-y-4">
      <Link to="/app/clients" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to clients
      </Link>
      <p className="text-sm text-muted-foreground">Client not found.</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <Link to="/app/clients" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground gap-1">
        <ArrowLeft className="w-4 h-4" /> Back to clients
      </Link>
      <Card className="p-6">
        <h1 className="text-2xl font-bold">{client.name}</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
          <Field label="Email" value={client.email} />
          <Field label="Mobile" value={client.mobile} />
          <Field label="Country" value={client.country} />
          <Field label="State / City" value={client.state ?? "—"} />
          <Field label="Website" value={client.website ?? "—"} />
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
              <thead className="bg-muted/60 border-b">
                <tr className="text-left">
                  <th className="px-3 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="px-3 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Template</th>
                  <th className="px-3 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-3 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Sent by</th>
                  <th className="px-3 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {history.map((h) => (
                  <tr key={h.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 text-muted-foreground text-xs">{new Date(h.sent_at).toLocaleString()}</td>
                    <td className="px-3 py-2">{h.template_name ?? "—"}</td>
                    <td className="px-3 py-2">
                      {h.status === "success" ? (
                        <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium"><CheckCircle2 className="w-3 h-3" /> Success</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-destructive text-xs font-medium"><XCircle className="w-3 h-3" /> Failed</span>
                      )}
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell text-muted-foreground text-xs">{h.sent_by}</td>
                    <td className="px-3 py-2 hidden md:table-cell text-xs text-muted-foreground max-w-xs truncate" title={h.error ?? ""}>{h.error ?? "—"}</td>
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
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
