import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db, ALL_PERMISSIONS, type Permission, type Employee } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, ShieldCheck, User, Trash2, MoreHorizontal, Users, LayoutDashboard, Users as UsersIcon, Send, Mail } from "lucide-react";
import { toast } from "sonner";
import { getSession } from "@/lib/session";

export const Route = createFileRoute("/app/employees")({
  component: EmployeesPage,
});

const PERMISSION_META: { key: Permission; label: string; icon: any; desc: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, desc: "View stats & overview" },
  { key: "clients", label: "Clients", icon: UsersIcon, desc: "Manage client contacts" },
  { key: "campaigns", label: "Campaigns", icon: Send, desc: "Launch & view campaigns" },
  { key: "templates", label: "Templates", icon: Mail, desc: "Create & edit templates" },
];

const AVATAR_COLORS = ["bg-red-400","bg-orange-400","bg-amber-400","bg-lime-500","bg-green-500","bg-teal-500","bg-cyan-500","bg-sky-500","bg-blue-500","bg-indigo-500","bg-violet-500","bg-purple-500","bg-pink-500","bg-rose-400"];
function getAvatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]; }
function cn(...cls: (string | boolean | undefined | null)[]) { return cls.filter(Boolean).join(" "); }

function EmployeesPage() {
  const session = getSession();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", username: "", password: "" });
  const [permissions, setPermissions] = useState<Permission[]>(["clients", "campaigns"]);

  useEffect(() => {
    if (session && session.role !== "admin") navigate({ to: "/app/clients" });
  }, [session, navigate]);

  const load = async () => {
    setLoading(true);
    try {
      setEmployees(await db.employees.getAll());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const togglePerm = (p: Permission) => {
    setPermissions((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (permissions.length === 0) { toast.error("Grant at least one permission"); return; }
    setSaving(true);
    try {
      const { error } = await db.employees.insert({
        name: form.name.trim(),
        username: form.username.trim(),
        password: form.password,
        role: "employee",
        permissions,
      });
      if (error === "23505") { toast.error("Username already taken"); return; }
      if (error) { toast.error(error); return; }
      toast.success("Employee added");
      setForm({ name: "", username: "", password: "" });
      setPermissions(["clients", "campaigns"]);
      setOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string, role: string) => {
    if (role === "admin") { toast.error("Cannot delete the admin account"); return; }
    if (!confirm(`Remove "${name}" from the team?`)) return;
    await db.employees.delete(id);
    toast.success("Employee removed");
    await load();
  };

  if (!session || session.role !== "admin") return null;

  const admins = employees.filter((e) => e.role === "admin");
  const staff = employees.filter((e) => e.role !== "admin");

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Employees</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">{employees.length}</span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">Manage team access and credentials</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm({ name: "", username: "", password: "" }); setPermissions(["clients", "campaigns"]); } }}>
          <DialogTrigger asChild>
            <Button className="gap-1.5 shadow-sm shadow-primary/20"><Plus className="w-4 h-4" />Add Employee</Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Add New Employee</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-3 pt-1">
              <div><Label>Full Name *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus className="mt-1.5" placeholder="e.g. Rahul Sharma" /></div>
              <div><Label>Username *</Label><Input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="mt-1.5" placeholder="unique username" /></div>
              <div><Label>Password *</Label><Input required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1.5" placeholder="set a password" /></div>

              <div>
                <Label className="block mb-2">Sidebar Access *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {PERMISSION_META.map(({ key, label, icon: Icon, desc }) => {
                    const checked = permissions.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => togglePerm(key)}
                        className={cn(
                          "flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all",
                          checked ? "border-primary/50 bg-primary/5 text-primary" : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300"
                        )}
                      >
                        <div className={cn("w-6 h-6 rounded flex items-center justify-center shrink-0 mt-0.5", checked ? "bg-primary/15" : "bg-slate-200")}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className={cn("text-xs font-semibold", checked ? "text-primary" : "text-slate-700")}>{label}</div>
                          <div className="text-[10px] text-slate-400 leading-tight">{desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {permissions.length === 0 && <p className="text-xs text-red-500 mt-1.5">Select at least one section.</p>}
              </div>

              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating…</span> : "Create Employee"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{employees.length}</div>
          <div className="text-sm text-slate-500 mt-0.5">Total Members</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
          <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center mb-3">
            <ShieldCheck className="w-5 h-5 text-violet-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{admins.length}</div>
          <div className="text-sm text-slate-500 mt-0.5">Administrators</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
            <User className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{staff.length}</div>
          <div className="text-sm text-slate-500 mt-0.5">Employees</div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-white">Team Members</h2>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {loading ? (
            <div className="flex justify-center py-14">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : employees.map((e) => (
            <div key={e.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
              <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0", getAvatarColor(e.name))}>
                {e.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800 dark:text-white text-sm">{e.name}</span>
                  <RoleBadge role={e.role} />
                  {e.role !== "admin" && e.permissions.map((p) => {
                    const meta = PERMISSION_META.find((m) => m.key === p);
                    return meta ? (
                      <span key={p} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                        <meta.icon className="w-2.5 h-2.5" />{meta.label}
                      </span>
                    ) : null;
                  })}
                </div>
                <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-3">
                  <span>@{e.username}</span>
                  <span className="hidden sm:inline">·</span>
                  <span className="hidden sm:inline font-mono">{e.password}</span>
                  <span className="hidden lg:inline">·</span>
                  <span className="hidden lg:inline">Joined {new Date(e.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="shrink-0">
                {e.role !== "admin" ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-600">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem className="text-destructive focus:text-destructive gap-2 cursor-pointer" onClick={() => handleDelete(e.id, e.name, e.role)}>
                        <Trash2 className="w-3.5 h-3.5" />Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <div className="w-8 h-8" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  if (role === "admin") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-700">
        <ShieldCheck className="w-2.5 h-2.5" />Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
      <User className="w-2.5 h-2.5" />Employee
    </span>
  );
}
