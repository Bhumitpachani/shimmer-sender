import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { db, type Client } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, FileSpreadsheet, Filter, MoreHorizontal, Trash2, Eye, X, ChevronDown, Download, RefreshCw, Pencil } from "lucide-react";
import { toast } from "sonner";
import { getSession } from "@/lib/session";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/app/clients")({
  component: ClientsPage,
});

const AVATAR_COLORS = ["bg-red-400","bg-orange-400","bg-amber-400","bg-lime-500","bg-green-500","bg-teal-500","bg-cyan-500","bg-sky-500","bg-blue-500","bg-indigo-500","bg-violet-500","bg-purple-500","bg-pink-500","bg-rose-400"];
function getAvatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]; }
function cn(...cls: (string | boolean | undefined | null)[]) { return cls.filter(Boolean).join(" "); }

const EMPTY_FORM = { name: "", email: "", mobile: "", country: "", state: "", website: "", company: "" };

function ClientsPage() {
  const session = getSession();
  const navigate = useNavigate();
  const isEmployee = session?.role === "employee";

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("all");
  const [addedBy, setAddedBy] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Client | null>(null);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const load = async () => {
    setLoading(true);
    try {
      const all = await db.clients.getAll();
      setClients(isEmployee ? all.filter((c) => c.added_by === session?.username) : all);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const countries = useMemo(() => Array.from(new Set(clients.map((c) => c.country))).filter(Boolean).sort(), [clients]);
  const addedBys = useMemo(() => Array.from(new Set(clients.map((c) => c.added_by))).filter(Boolean).sort(), [clients]);

  const filtered = useMemo(() => clients.filter((c) => {
    if (country !== "all" && c.country !== country) return false;
    if (!isEmployee && addedBy !== "all" && c.added_by !== addedBy) return false;
    if (dateFrom && new Date(c.created_at) < new Date(dateFrom)) return false;
    if (dateTo && new Date(c.created_at) > new Date(dateTo + "T23:59:59")) return false;
    if (search) {
      const s = search.toLowerCase();
      return [c.name, c.email, c.mobile, c.company ?? "", c.state ?? "", c.country, c.added_by].some((v) => v.toLowerCase().includes(s));
    }
    return true;
  }), [clients, search, country, addedBy, dateFrom, dateTo, isEmployee]);

  const hasFilters = country !== "all" || (!isEmployee && addedBy !== "all") || !!dateFrom || !!dateTo;
  const filterCount = [country !== "all", !isEmployee && addedBy !== "all", !!dateFrom, !!dateTo].filter(Boolean).length;
  const clearFilters = () => { setCountry("all"); setAddedBy("all"); setDateFrom(""); setDateTo(""); };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await db.clients.insert({
        name: form.name.trim(), email: form.email.trim().toLowerCase(),
        mobile: form.mobile.trim(), country: form.country.trim(),
        state: form.state.trim() || null, website: form.website.trim() || null,
        company: form.company.trim() || null, added_by: session?.username ?? "admin",
      });
      if (error === "23505_email") { toast.error("This email address already exists"); return; }
      if (error === "23505_mobile") { toast.error("This mobile number already exists"); return; }
      if (error) { toast.error(error); return; }
      toast.success("Client added successfully");
      setForm(EMPTY_FORM);
      setAddOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (c: Client) => {
    setEditTarget(c);
    setEditForm({ name: c.name, email: c.email, mobile: c.mobile, country: c.country, state: c.state ?? "", website: c.website ?? "", company: c.company ?? "" });
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setSaving(true);
    try {
      const { error } = await db.clients.update(editTarget.id, {
        name: editForm.name.trim(), email: editForm.email.trim().toLowerCase(),
        mobile: editForm.mobile.trim(), country: editForm.country.trim(),
        state: editForm.state.trim() || null, website: editForm.website.trim() || null,
        company: editForm.company.trim() || null,
      });
      if (error === "23505_email") { toast.error("This email is used by another client"); return; }
      if (error === "23505_mobile") { toast.error("This mobile is used by another client"); return; }
      if (error) { toast.error(error); return; }
      toast.success("Client updated — Excel export will reflect this change");
      setEditOpen(false);
      setEditTarget(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await db.clients.delete(id);
    toast.success("Client deleted");
    await load();
  };

  const handleExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const rawRows = XLSX.utils.sheet_to_json<any>(wb.Sheets[wb.SheetNames[0]]);

      const validRows: Array<Parameters<typeof db.clients.upsertByEmailOrMobile>[0]> = [];
      let invalid = 0;

      for (const row of rawRows) {
        const name = String(row.name ?? row.Name ?? "").trim();
        const email = String(row.email ?? row.Email ?? "").trim().toLowerCase();
        const mobile = String(row.mobile ?? row.Mobile ?? row.number ?? row.Number ?? row.Phone ?? row.phone ?? "").trim();
        const ctry = String(row.country ?? row.Country ?? "").trim();
        if (!name || !email || !mobile || !ctry) { invalid++; continue; }
        validRows.push({
          name, email, mobile, country: ctry,
          state: String(row.state ?? row.State ?? row.city ?? row.City ?? "").trim() || null,
          website: String(row.website ?? row.Website ?? "").trim() || null,
          company: String(row.company ?? row.Company ?? "").trim() || null,
          added_by: session?.username ?? "admin",
        });
      }

      if (validRows.length === 0) {
        toast.error(`No valid rows found. ${invalid} rows were missing required fields.`);
        return;
      }

      setImportProgress({ done: 0, total: validRows.length });

      let added = 0, updated = 0, conflicts = 0, errors = 0;
      const CHUNK = 20;

      for (let i = 0; i < validRows.length; i += CHUNK) {
        const chunk = validRows.slice(i, i + CHUNK);
        const results = await Promise.allSettled(chunk.map((row) => db.clients.upsertByEmailOrMobile(row)));
        for (const r of results) {
          if (r.status === "fulfilled") {
            if (r.value.error === "mobile_conflict") conflicts++;
            else if (r.value.action === "inserted") added++;
            else updated++;
          } else {
            errors++;
          }
        }
        setImportProgress({ done: Math.min(i + CHUNK, validRows.length), total: validRows.length });
      }

      const parts = [`${added} added`, `${updated} updated`];
      if (invalid > 0) parts.push(`${invalid} missing fields`);
      if (conflicts > 0) parts.push(`${conflicts} mobile conflicts`);
      if (errors > 0) parts.push(`${errors} errors`);
      toast.success(`Import complete: ${parts.join(" · ")}`);
      await load();
    } catch {
      toast.error("Failed to read file — check the format");
    } finally {
      setUploading(false);
      setImportProgress(null);
      e.target.value = "";
    }
  };

  const handleExport = () => {
    if (filtered.length === 0) { toast.error("No clients to export"); return; }
    const rows = filtered.map((c) => ({
      Name: c.name,
      Email: c.email,
      Mobile: c.mobile,
      Country: c.country,
      State: c.state ?? "",
      Company: c.company ?? "",
      Website: c.website ?? "",
      "Added By": c.added_by,
      "Date Added": new Date(c.created_at).toLocaleDateString(),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 22 }, { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 24 }, { wch: 14 }, { wch: 14 }];
    const wbOut = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbOut, ws, "Clients");
    const label = [
      country !== "all" ? country : "",
      !isEmployee && addedBy !== "all" ? addedBy : "",
      dateFrom ? `from-${dateFrom}` : "",
      dateTo ? `to-${dateTo}` : "",
    ].filter(Boolean).join("_") || "all";
    XLSX.writeFile(wbOut, `starlink_jewels_clients_${label}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`Exported ${filtered.length} clients`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Clients</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">{clients.length}</span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            {isEmployee ? "Your added clients" : "Manage and organize all your contacts"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5 shadow-sm" onClick={() => load()} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />Refresh
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 shadow-sm" onClick={handleExport}>
            <Download className="w-4 h-4" />Export
          </Button>
          <label className="cursor-pointer">
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcel} disabled={uploading} />
            <span className={cn("inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-700 transition-colors shadow-sm cursor-pointer", uploading && "opacity-60 pointer-events-none")}>
              <FileSpreadsheet className="w-4 h-4" />
              {uploading && importProgress
                ? `${importProgress.done}/${importProgress.total}…`
                : uploading ? "Reading…" : "Import Excel"}
            </span>
          </label>

          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-1.5 shadow-sm shadow-primary/20"><Plus className="w-4 h-4" />Add Client</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Add New Client</DialogTitle></DialogHeader>
              <form onSubmit={handleAdd} className="space-y-3">
                <ClientFormFields form={form} setForm={setForm} autoFocus />
                <Button type="submit" className="w-full mt-1" disabled={saving}>
                  {saving ? <Spinner label="Saving…" /> : "Add Client"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {uploading && importProgress && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-blue-800">Importing {importProgress.total} rows in parallel…</div>
            <div className="mt-1.5 h-1.5 bg-blue-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${(importProgress.done / importProgress.total) * 100}%` }} />
            </div>
          </div>
          <span className="text-sm font-semibold text-blue-700 shrink-0">{importProgress.done}/{importProgress.total}</span>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-3 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Search name, email, mobile, company…" className="pl-9 h-9 bg-slate-50 border-slate-200" value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Button variant={hasFilters ? "default" : "outline"} size="sm" className="gap-1.5 shrink-0" onClick={() => setFiltersOpen(!filtersOpen)}>
            <Filter className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Filters</span>
            {filterCount > 0 && <span className="w-4 h-4 rounded-full bg-white/25 text-[10px] font-bold flex items-center justify-center">{filterCount}</span>}
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", filtersOpen && "rotate-180")} />
          </Button>
        </div>
        {filtersOpen && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="h-8 text-sm bg-slate-50"><SelectValue placeholder="All Countries" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            {!isEmployee && (
              <Select value={addedBy} onValueChange={setAddedBy}>
                <SelectTrigger className="h-8 text-sm bg-slate-50"><SelectValue placeholder="Added by anyone" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Added by anyone</SelectItem>
                  {addedBys.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <div className="flex gap-2">
              <div className="flex-1"><Label className="text-xs text-slate-500 mb-1 block">From</Label><Input type="date" className="h-8 text-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
              <div className="flex-1"><Label className="text-xs text-slate-500 mb-1 block">To</Label><Input type="date" className="h-8 text-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
            </div>
            {hasFilters && (
              <div className="flex items-end">
                <button onClick={clearFilters} className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors">
                  <X className="w-3.5 h-3.5" /> Clear all filters
                </button>
              </div>
            )}
          </div>
        )}
        {(search || hasFilters) && !loading && (
          <div className="text-xs text-slate-500 pt-1 border-t border-slate-100">
            Showing <span className="font-semibold text-slate-700">{filtered.length}</span> of {clients.length} clients
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Client</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Country</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Mobile</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden xl:table-cell">State / City</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden xl:table-cell">Company</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Added By</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Date</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-14 text-center">
                  <div className="flex justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-14 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"><Search className="w-4 h-4 text-slate-400" /></div>
                    <p className="text-sm font-medium text-slate-600">No clients found</p>
                    <p className="text-xs text-slate-400">Try adjusting your search or filters</p>
                  </div>
                </td></tr>
              ) : filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0", getAvatarColor(c.name))}>
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <button onClick={() => navigate({ to: "/app/clients/$id", params: { id: c.id } })} className="font-semibold text-slate-800 dark:text-white hover:text-primary transition-colors truncate block text-left">
                          {c.name}
                        </button>
                        <div className="text-xs text-slate-400 truncate md:hidden">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-slate-600 dark:text-slate-400">{c.email}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">{c.country}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-slate-500 text-xs">{c.mobile}</td>
                  <td className="px-4 py-3 hidden xl:table-cell text-slate-500 text-xs">{c.state ?? "—"}</td>
                  <td className="px-4 py-3 hidden xl:table-cell text-slate-500 text-xs">{c.company ?? "—"}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{c.added_by}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-slate-400 text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => navigate({ to: "/app/clients/$id", params: { id: c.id } })} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-primary" title="View">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-amber-600" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => navigate({ to: "/app/clients/$id", params: { id: c.id } })} className="gap-2 cursor-pointer">
                            <Eye className="w-3.5 h-3.5" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(c)} className="gap-2 cursor-pointer">
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive gap-2 cursor-pointer" onClick={() => handleDelete(c.id, c.name)}>
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-800">
        <span className="font-semibold">Excel import columns:</span>{" "}
        <span className="font-mono">name, email, mobile, country</span> (required) ·{" "}
        <span className="font-mono">state, website, company</span> (optional) ·{" "}
        <span className="font-semibold">All rows imported in parallel. Email &amp; mobile both unique — duplicates are updated, never re-added.</span>
      </div>

      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Client — {editTarget?.name}</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-3">
            <ClientFormFields form={editForm} setForm={setEditForm} />
            <Button type="submit" className="w-full mt-1" disabled={saving}>
              {saving ? <Spinner label="Saving…" /> : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClientFormFields({ form, setForm, autoFocus }: { form: typeof EMPTY_FORM; setForm: (f: typeof EMPTY_FORM) => void; autoFocus?: boolean }) {
  return (
    <>
      <div><Label>Full Name *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus={autoFocus} className="mt-1" /></div>
      <div><Label>Email Address *</Label><Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" /></div>
      <div><Label>Mobile Number *</Label><Input required value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} className="mt-1" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Country *</Label><Input required value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="mt-1" /></div>
        <div><Label>State / City</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="optional" className="mt-1" /></div>
      </div>
      <div><Label>Website</Label><Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://… (optional)" className="mt-1" /></div>
      <div><Label>Company</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="optional" className="mt-1" /></div>
    </>
  );
}

function Spinner({ label }: { label: string }) {
  return <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{label}</span>;
}
