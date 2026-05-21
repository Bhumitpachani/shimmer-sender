import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { getSession } from "@/lib/session";

export const Route = createFileRoute("/app/employees")({
  component: EmployeesPage,
});

function EmployeesPage() {
  const session = getSession();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", username: "", password: "" });

  useEffect(() => {
    if (session && session.role !== "admin") navigate({ to: "/app" });
  }, [session, navigate]);

  const load = async () => {
    const { data } = await supabase.from("employees").select("*").order("created_at");
    setEmployees(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("employees").insert({
      name: form.name.trim(),
      username: form.username.trim(),
      password: form.password,
      role: "employee",
    });
    if (error) {
      if (error.code === "23505") toast.error("Username already exists");
      else toast.error(error.message);
      return;
    }
    toast.success("Employee added");
    setForm({ name: "", username: "", password: "" });
    setOpen(false);
    load();
  };

  const handleDelete = async (id: string, role: string) => {
    if (role === "admin") return toast.error("Cannot delete admin");
    if (!confirm("Delete this employee?")) return;
    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); load(); }
  };

  if (!session || session.role !== "admin") return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Employees</h1>
          <p className="text-sm text-muted-foreground">Manage who can add clients</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Add Employee</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Employee</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-3">
              <div><Label>Full Name *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Username *</Label><Input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
              <div><Label>Password *</Label><Input required type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
              <Button type="submit" className="w-full">Create Employee</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr className="text-left">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Password</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {employees.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-2 font-medium">{e.name}</td>
                <td className="px-4 py-2 font-mono">{e.username}</td>
                <td className="px-4 py-2 font-mono text-muted-foreground">{e.password}</td>
                <td className="px-4 py-2">
                  {e.role === "admin" ? (
                    <span className="inline-flex items-center gap-1 text-primary text-xs"><ShieldCheck className="w-3 h-3" /> Admin</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Employee</span>
                  )}
                </td>
                <td className="px-4 py-2 text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-right">
                  {e.role !== "admin" && (
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(e.id, e.role)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}
