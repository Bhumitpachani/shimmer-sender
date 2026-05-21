import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Plus, Search, FileSpreadsheet, Trash2, ChevronDown, ChevronUp, Filter } from "lucide-react";
import { toast } from "sonner";
import { getSession } from "@/lib/session";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/app/clients")({
  component: ClientsPage,
});

interface Client {
  id: string;
  name: string;
  email: string;
  mobile: string;
  country: string;
  state: string | null;
  website: string | null;
  company: string | null;
  added_by: string;
  created_at: string;
}

function ClientsPage() {
  const session = getSession();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState<string>("all");
  const [addedBy, setAddedBy] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", mobile: "", country: "", state: "", website: "", company: "" });
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
    setClients((data as Client[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const countries = Array.from(new Set(clients.map((c) => c.country))).filter(Boolean).sort();
  const addedByList = Array.from(new Set(clients.map((c) => c.added_by))).filter(Boolean).sort();

  const filtered = clients.filter((c) => {
    if (country !== "all" && c.country !== country) return false;
    if (addedBy !== "all" && c.added_by !== addedBy) return false;
    if (dateFrom && new Date(c.created_at) < new Date(dateFrom)) return false;
    if (dateTo && new Date(c.created_at) > new Date(dateTo + "T23:59:59")) return false;
    if (search) {
      const s = search.toLowerCase();
      if (
        !c.name.toLowerCase().includes(s) &&
        !c.email.toLowerCase().includes(s) &&
        !c.mobile.toLowerCase().includes(s) &&
        !(c.company ?? "").toLowerCase().includes(s) &&
        !(c.state ?? "").toLowerCase().includes(s) &&
        !(c.website ?? "").toLowerCase().includes(s)
      )
        return false;
    }
    return true;
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("clients").insert({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      mobile: form.mobile.trim(),
      country: form.country.trim(),
      state: form.state.trim() || null,
      website: form.website.trim() || null,
      company: form.company.trim() || null,
      added_by: session?.username ?? "admin",
    });
    if (error) {
      if (error.code === "23505") toast.error("This email or mobile already exists");
      else toast.error(error.message);
      return;
    }
    toast.success("Client added");
    setForm({ name: "", email: "", mobile: "", country: "", state: "", website: "", company: "" });
    setOpen(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this client?")) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); load(); }
  };

  const handleExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(sheet);
      let ok = 0, dup = 0, bad = 0;
      for (const row of rows) {
        const name = String(row.name ?? row.Name ?? "").trim();
        const email = String(row.email ?? row.Email ?? "").trim().toLowerCase();
        const mobile = String(row.mobile ?? row.Mobile ?? row.number ?? row.Number ?? "").trim();
        const ctry = String(row.country ?? row.Country ?? "").trim();
        const state = String(row.state ?? row.State ?? row.city ?? row.City ?? "").trim() || null;
        const website = String(row.website ?? row.Website ?? "").trim() || null;
        const company = String(row.company ?? row.Company ?? "").trim() || null;
        if (!name || !email || !mobile || !ctry) { bad++; continue; }
        const { error } = await supabase.from("clients").insert({
          name, email, mobile, country: ctry, state, website, company,
          added_by: session?.username ?? "admin",
        });
        if (error) {
          if (error.code === "23505") dup++;
          else bad++;
        } else ok++;
      }
      toast.success(`Imported ${ok}, skipped ${dup} duplicates, ${bad} invalid`);
      load();
    } catch (err: any) {
      toast.error("Failed to read file: " + err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const hasActiveFilters = country !== "all" || addedBy !== "all" || dateFrom || dateTo;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} of {clients.length} clients</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <label>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcel} disabled={uploading} />
            <Button asChild variant="outline" disabled={uploading} size="sm">
              <span><FileSpreadsheet className="w-4 h-4 mr-1.5" />{uploading ? "Uploading…" : "Import Excel"}</span>
            </Button>
          </label>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1.5" />Add Client</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Add New Client</DialogTitle></DialogHeader>
              <form onSubmit={handleAdd} className="space-y-3">
                <div>
                  <Label>Name *</Label>
                  <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
                </div>
                <div>
                  <Label>Email *</Label>
                  <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <Label>Mobile Number *</Label>
                  <Input required value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Country *</Label>
                    <Input required value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                  </div>
                  <div>
                    <Label>State / City</Label>
                    <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="optional" />
                  </div>
                </div>
                <div>
                  <Label>Website</Label>
                  <Input type="url" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://example.com (optional)" />
                </div>
                <div>
                  <Label>Company</Label>
                  <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="optional" />
                </div>
                <Button type="submit" className="w-full">Add Client</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search + Filter toggle */}
      <Card className="p-3">
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name, email, mobile, company, state…"
              className="pl-9 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant={hasActiveFilters ? "default" : "outline"}
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            <Filter className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Filters</span>
            {hasActiveFilters && <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/20 text-[10px] font-bold">{[country !== "all", addedBy !== "all", !!dateFrom, !!dateTo].filter(Boolean).length}</span>}
            {filtersOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>
        </div>
        {filtersOpen && (
          <div className="mt-3 pt-3 border-t grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="h-9"><SelectValue placeholder="All countries" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All countries</SelectItem>
                {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={addedBy} onValueChange={setAddedBy}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Added by anyone" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Anyone</SelectItem>
                {addedByList.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1 block">From</Label>
                <Input type="date" className="h-9" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1 block">To</Label>
                <Input type="date" className="h-9" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
            {hasActiveFilters && (
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => { setCountry("all"); setAddedBy("all"); setDateFrom(""); setDateTo(""); }}
                >
                  Clear filters
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 border-b">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Name</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Email</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">Mobile</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Country</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden lg:table-cell">State / City</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden xl:table-cell">Website</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Company</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden xl:table-cell">Added By</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">No clients found</td></tr>
              ) : filtered.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5">
                    <Link to="/app/clients/$id" params={{ id: c.id }} className="text-primary hover:underline font-medium">{c.name}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-sm">{c.email}</td>
                  <td className="px-4 py-2.5 hidden md:table-cell text-muted-foreground">{c.mobile}</td>
                  <td className="px-4 py-2.5 hidden sm:table-cell">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-primary/8 text-primary font-medium">{c.country}</span>
                  </td>
                  <td className="px-4 py-2.5 hidden lg:table-cell text-muted-foreground">{c.state ?? "—"}</td>
                  <td className="px-4 py-2.5 hidden xl:table-cell">
                    {c.website ? (
                      <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs truncate max-w-[120px] block">{c.website.replace(/^https?:\/\//, "")}</a>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-2.5 hidden lg:table-cell text-muted-foreground">{c.company ?? "—"}</td>
                  <td className="px-4 py-2.5 hidden xl:table-cell text-muted-foreground text-xs">{c.added_by}</td>
                  <td className="px-4 py-2.5 hidden md:table-cell text-muted-foreground text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Import hint */}
      <Card className="p-4 bg-accent/30 border-dashed">
        <div className="flex items-start gap-3">
          <Upload className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Excel import columns: </span>
            <span className="font-mono">name, email, mobile, country</span> (required) •{" "}
            <span className="font-mono">state, website, company</span> (optional) • Duplicate emails/mobiles are skipped.
          </div>
        </div>
      </Card>
    </div>
  );
}
