import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db, type Client, type SendHistory } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, CheckCircle2, XCircle, Mail, Phone, Globe, Building2, MapPin, AlertCircle, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/clients/$id")({
  component: ClientDetail,
});

function cn(...cls: (string | boolean | undefined | null)[]) {
  return cls.filter(Boolean).join(" ");
}

const AVATAR_COLORS = ["bg-red-400","bg-orange-400","bg-amber-400","bg-lime-500","bg-green-500","bg-teal-500","bg-cyan-500","bg-sky-500","bg-blue-500","bg-indigo-500","bg-violet-500","bg-purple-500","bg-pink-500","bg-rose-400"];
function getAvatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]; }

function ClientDetail() {
  const { id } = Route.useParams();
  const [client, setClient] = useState<Client | null>(null);
  const [history, setHistory] = useState<SendHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", mobile: "", country: "", state: "", website: "", company: "" });

  const loadData = () => {
    Promise.all([
      db.clients.getById(id),
      db.sendHistory.getByClientId(id),
    ]).then(([c, h]) => {
      setClient(c);
      setHistory(h);
      if (c) setForm({ name: c.name, email: c.email, mobile: c.mobile, country: c.country, state: c.state ?? "", website: c.website ?? "", company: c.company ?? "" });
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [id]);

  const openEdit = () => {
    if (!client) return;
    setForm({ name: client.name, email: client.email, mobile: client.mobile, country: client.country, state: client.state ?? "", website: client.website ?? "", company: client.company ?? "" });
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    setSaving(true);
    try {
      const { error } = await db.clients.update(client.id, {
        name: form.name.trim(), email: form.email.trim().toLowerCase(),
        mobile: form.mobile.trim(), country: form.country.trim(),
        state: form.state.trim() || null, website: form.website.trim() || null,
        company: form.company.trim() || null,
      });
      if (error === "23505_email") { toast.error("This email is used by another client"); return; }
      if (error === "23505_mobile") { toast.error("This mobile is used by another client"); return; }
      if (error) { toast.error(error); return; }
      toast.success("Client updated — Excel export will reflect this change");
      setEditOpen(false);
      setLoading(true);
      loadData();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="space-y-4">
        <Link to="/app/clients" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Clients
        </Link>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-14 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600">Client not found</p>
          <p className="text-xs text-slate-400 mt-1">This client may have been deleted.</p>
        </div>
      </div>
    );
  }

  const successCount = history.filter((h) => h.status === "success").length;
  const failCount = history.filter((h) => h.status === "fail").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link to="/app/clients" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Clients
        </Link>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={openEdit}>
          <Pencil className="w-3.5 h-3.5" /> Edit Client
        </Button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shrink-0", getAvatarColor(client.name))}>
            {client.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{client.name}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{client.email}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">{client.country}</span>
              {client.state && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{client.state}</span>}
              {client.company && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-100">{client.company}</span>}
            </div>
          </div>
          <div className="text-right text-xs text-slate-400 shrink-0">
            <div>Added by <span className="font-medium text-slate-600">{client.added_by}</span></div>
            <div className="mt-0.5">{new Date(client.created_at).toLocaleDateString()}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
          <ContactField icon={Mail} label="Email" value={client.email} href={`mailto:${client.email}`} />
          <ContactField icon={Phone} label="Mobile" value={client.mobile} href={`tel:${client.mobile}`} />
          <ContactField icon={Globe} label="Country" value={client.country} />
          <ContactField icon={MapPin} label="State / City" value={client.state ?? "—"} />
          <ContactField icon={Building2} label="Company" value={client.company ?? "—"} />
          <ContactField icon={Globe} label="Website" value={client.website ? client.website.replace(/^https?:\/\//, "") : "—"} href={client.website ?? undefined} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 text-center">
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{history.length}</div>
          <div className="text-xs text-slate-400 mt-0.5">Total Emails</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{successCount}</div>
          <div className="text-xs text-slate-400 mt-0.5">Delivered</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 text-center">
          <div className="text-2xl font-bold text-red-500">{failCount}</div>
          <div className="text-xs text-slate-400 mt-0.5">Failed</div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 dark:text-white">Email History</h2>
          <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full font-medium">{history.length} emails</span>
        </div>
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-3"><Mail className="w-4 h-4 text-slate-400" /></div>
            <p className="text-sm font-medium text-slate-600">No emails sent yet</p>
            <p className="text-xs text-slate-400 mt-1">This client hasn't received any emails from a campaign.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Campaign / Template</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Sent by</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {history.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{new Date(h.sent_at).toLocaleString()}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="font-medium text-slate-700 dark:text-slate-300 text-sm">{h.template_name ?? "—"}</div>
                      {h.campaign_id && (
                        <Link to="/app/campaigns/$id" params={{ id: h.campaign_id }} className="text-xs text-primary hover:underline">View campaign →</Link>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {h.status === "success"
                        ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Delivered</span>
                        : <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" /> Failed</span>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-slate-400">{h.sent_by}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-slate-400 max-w-[180px] truncate" title={h.error ?? ""}>{h.error ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Client</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-3">
            <div><Label>Full Name *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" /></div>
            <div><Label>Email Address *</Label><Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" /></div>
            <div><Label>Mobile Number *</Label><Input required value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Country *</Label><Input required value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="mt-1" /></div>
              <div><Label>State / City</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="mt-1" /></div>
            </div>
            <div><Label>Website</Label><Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://…" className="mt-1" /></div>
            <div><Label>Company</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="mt-1" /></div>
            <Button type="submit" className="w-full mt-1" disabled={saving}>
              {saving ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</span> : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContactField({ icon: Icon, label, value, href }: { icon: any; label: string; value: string; href?: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-1">
        <Icon className="w-3 h-3 text-slate-400" />
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      {href && value !== "—" ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline break-all">{value}</a>
      ) : (
        <div className="text-sm font-medium text-slate-700 dark:text-slate-300 break-all">{value}</div>
      )}
    </div>
  );
}
