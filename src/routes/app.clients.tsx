import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Plus, Search, FileSpreadsheet, Trash2 } from "lucide-react";
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
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", mobile: "", country: "", company: "" });
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
        !(c.company ?? "").toLowerCase().includes(s)
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
      company: form.company.trim() || null,
      added_by: session?.username ?? "admin",
    });
    if (error) {
      if (error.code === "23505") toast.error("This email or mobile already exists");
      else toast.error(error.message);
      return;
    }
    toast.success("Client added");
    setForm({ name: "", email: "", mobile: "", country: "", company: "" });
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
        const company = String(row.company ?? row.Company ?? "").trim() || null;
        if (!name || !email || !mobile || !ctry) { bad++; continue; }
        const { error } = await supabase.from("clients").insert({
          name, email, mobile, country: ctry, company,
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

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} of {clients.length} clients</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <label>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcel} disabled={uploading} />
            <Button asChild variant="outline" disabled={uploading}>
              <span><FileSpreadsheet className="w-4 h-4 mr-2" />{uploading ? "Uploading..." : "Upload Excel"}</span>
            </Button>
          </label>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Add Client</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add New Client</DialogTitle></DialogHeader>
              <form onSubmit={handleAdd} className="space-y-3">
                <div><Label>Name *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Email *</Label><Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Mobile Number *</Label><Input required value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></div>
                <div><Label>Country *</Label><Input required value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
                <div><Label>Company (optional)</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
                <Button type="submit" className="w-full">Add Client</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input placeholder="Search name, email, mobile, company..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger><SelectValue placeholder="Country" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All countries</SelectItem>
              {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={addedBy} onValueChange={setAddedBy}>
            <SelectTrigger><SelectValue placeholder="Added by" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Anyone</SelectItem>
              {addedByList.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="From" />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="To" />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr className="text-left">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Mobile</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Added By</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No clients found</td></tr>
              ) : filtered.map((c) => (
                <tr key={c.id} className="hover:bg-muted/40">
                  <td className="px-4 py-2"><Link to="/app/clients/$id" params={{ id: c.id }} className="text-primary hover:underline font-medium">{c.name}</Link></td>
                  <td className="px-4 py-2">{c.email}</td>
                  <td className="px-4 py-2">{c.mobile}</td>
                  <td className="px-4 py-2">{c.country}</td>
                  <td className="px-4 py-2">{c.company ?? "—"}</td>
                  <td className="px-4 py-2">{c.added_by}</td>
                  <td className="px-4 py-2 text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4 bg-accent/40">
        <div className="flex items-start gap-3">
          <Upload className="w-5 h-5 text-primary mt-0.5" />
          <div className="text-sm">
            <div className="font-medium">Excel import format</div>
            <p className="text-muted-foreground">Columns required: <span className="font-mono">name, email, mobile, country</span>. Optional: <span className="font-mono">company</span>. Duplicate emails or mobile numbers are skipped automatically.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
