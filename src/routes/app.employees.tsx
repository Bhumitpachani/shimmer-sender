import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db, ALL_PERMISSIONS, type Permission, type Employee } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Plus, ShieldCheck, User, Trash2, MoreHorizontal, Users, LayoutDashboard,
  Users as UsersIcon, Send, Mail, Pencil, Eye, EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { getSession } from "@/lib/session";
import { getAvatarColor } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/app/employees")({
  component: EmployeesPage,
});

const PERMISSION_META: { key: Permission; label: string; icon: any; desc: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, desc: "View stats & overview" },
  { key: "clients", label: "Clients", icon: UsersIcon, desc: "Manage client contacts" },
  { key: "campaigns", label: "Campaigns", icon: Send, desc: "Launch & view campaigns" },
  { key: "templates", label: "Templates", icon: Mail, desc: "Create & edit templates" },
];

function PermissionGrid({ value, onChange }: { value: Permission[]; onChange: (p: Permission[]) => void }) {
  const toggle = (p: Permission) =>
    onChange(value.includes(p) ? value.filter((x) => x !== p) : [...value, p]);
  return (
    <div className="grid grid-cols-2 gap-2">
      {PERMISSION_META.map(({ key, label, icon: Icon, desc }) => {
        const checked = value.includes(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
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
  );
}

function EmployeesPage() {
  const session = getSession();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", username: "", password: "" });
  const [addPerms, setAddPerms] = useState<Permission[]>(["clients", "campaigns"]);

  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", username: "", password: "" });
  const [editPerms, setEditPerms] = useState<Permission[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (session && session.role !== "admin") navigate({ to: "/app/clients" });
  }, [session, navigate]);

  const load = async () => {
    setLoading(true);
    try { setEmployees(await db.employees.getAll()); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openEdit = (e: Employee) => {
    setEditTarget(e);
    setEditForm({ name: e.name, username: e.username, password: e.password });
    setEditPerms([...e.permissions]);
  };

  const handleAdd = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (addPerms.length === 0) { toast.error("Grant at least one permission"); return; }
    setAddSaving(true);
    try {
      const { error } = await db.employees.insert({
        name: addForm.name.trim(),
        username: addForm.username.trim(),
        password: addForm.password,
        role: "employee",
        permissions: addPerms,
      });
      if (error === "23505") { toast.error("Username already taken"); return; }
      if (error) { toast.error(error); return; }
      toast.success("Employee added");
      setAddForm({ name: "", username: "", password: "" });
      setAddPerms(["clients", "campaigns"]);
      setAddOpen(false);
      await load();
    } finally { setAddSaving(false); }
  };

  const handleEdit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!editTarget) return;
    if (editPerms.length === 0) { toast.error("Grant at least one permission"); return; }
    setEditSaving(true);
    try {
      const { error } = await db.employees.update(editTarget.id, {
        name: editForm.name.trim(),
        username: editForm.username.trim(),
        password: editForm.password,
        permissions: editPerms,
      });
      if (error === "23505") { toast.error("Username already taken"); return; }
      if (error) { toast.error(error); return; }
      toast.success("Employee updated");
      setEditTarget(null);
      await load();
    } finally { setEditSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await db.employees.delete(deleteTarget.id);
    toast.success("Employee removed");
    setDeleteTarget(null);
    await load();
  };

  const toggleReveal = (id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (!session || session.role !== "admin") return null;

  const admins = employees.filter((e) => e.role === "admin");
  const staff = employees.filter((e) => e.role !== "admin");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Employees"
        count={employees.length}
        subtitle="Manage team access and credentials"
        actions={
          <Dialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) { setAddForm({ name: "", username: "", password: "" }); setAddPerms(["clients", "campaigns"]); } }}>
            <DialogTrigger asChild>
              <Button className="gap-1.5 shadow-sm shadow-primary/20"><Plus className="w-4 h-4" />Add Employee</Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Add New Employee</DialogTitle></DialogHeader>
              <form onSubmit={handleAdd} className="space-y-3 pt-1">
                <div><Label>Full Name *</Label><Input required value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} autoFocus className="mt-1.5" placeholder="e.g. Rahul Sharma" /></div>
                <div><Label>Username *</Label><Input required value={addForm.username} onChange={(e) => setAddForm({ ...addForm, username: e.target.value })} className="mt-1.5" placeholder="unique username" /></div>
                <div><Label>Password *</Label><Input required value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} className="mt-1.5" placeholder="set a password" /></div>
                <div>
                  <Label className="block mb-2">Sidebar Access *</Label>
                  <PermissionGrid value={addPerms} onChange={setAddPerms} />
                  {addPerms.length === 0 && <p className="text-xs text-red-500 mt-1.5">Select at least one section.</p>}
                </div>
                <Button type="submit" className="w-full" disabled={addSaving}>
                  {addSaving ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating…</span> : "Create Employee"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Dialog open={!!editTarget} onOpenChange={(v) => { if (!v) setEditTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Employee</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-3 pt-1">
            <div><Label>Full Name *</Label><Input required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} autoFocus className="mt-1.5" placeholder="Full name" /></div>
            <div><Label>Username *</Label><Input required value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} className="mt-1.5" placeholder="Username" /></div>
            <div><Label>Password *</Label><Input required value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} className="mt-1.5" placeholder="Password" /></div>
            <div>
              <Label className="block mb-2">Sidebar Access *</Label>
              <PermissionGrid value={editPerms} onChange={setEditPerms} />
              {editPerms.length === 0 && <p className="text-xs text-red-500 mt-1.5">Select at least one section.</p>}
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={editSaving}>
                {editSaving ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</span> : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
                  <button
                    onClick={() => toggleReveal(e.id)}
                    className="hidden sm:inline-flex items-center gap-1 font-mono hover:text-slate-600 transition-colors"
                    title={revealed.has(e.id) ? "Hide password" : "Show password"}
                  >
                    {revealed.has(e.id) ? e.password : "••••••••"}
                    {revealed.has(e.id) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
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
                      <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => openEdit(e)}>
                        <Pencil className="w-3.5 h-3.5" />Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:text-destructive gap-2 cursor-pointer" onClick={() => setDeleteTarget(e)}>
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

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        title={`Remove "${deleteTarget?.name}" from the team?`}
        description="They will immediately lose access to the dashboard. This cannot be undone."
        confirmLabel="Remove"
        onConfirm={confirmDelete}
      />
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
