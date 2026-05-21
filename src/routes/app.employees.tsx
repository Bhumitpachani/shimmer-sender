import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db } from "@/lib/db";
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
  const [employees, setEmployees] = useState(db.employees.getAll());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", username: "", password: "" });

  useEffect(() => {
    if (session && session.role !== "admin") navigate({ to: "/app/clients" });
  }, [session, navigate]);

  const load = () => setEmployees(db.employees.getAll());

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = db.employees.insert({
      name: form.name.trim(),
      username: form.username.trim(),
      password: form.password,
      role: "employee",
    });
    if (error === "23505") {
      toast.error("Username already exists");
      return;
    }
    if (error) { toast.error(error); return; }
    toast.success("Employee added");
    setForm({ name: "", username: "", password: "" });
    setOpen(false);
    load();
  };

  const handleDelete = (id: string, role: string) => {
    if (role === "admin") return toast.error("Cannot delete admin");
    if (!confirm("Delete this employee?")) return;
    db.employees.delete(id);
    toast.success("Deleted");
    load();
  };

  if (!session || session.role !== "admin") return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Employees</h1>
          <p className="text-sm text-muted-foreground">Manage who can add clients and send emails</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1.5" />Add Employee</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Employee</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-3">
              <div><Label>Full Name *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></div>
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
            <thead className="bg-muted/60 border-b">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Name</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Username</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Password</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Role</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {employees.map((e) => (
                <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{e.name}</td>
                  <td className="px-4 py-2.5 font-mono text-sm">{e.username}</td>
                  <td className="px-4 py-2.5 font-mono text-muted-foreground">{e.password}</td>
                  <td className="px-4 py-2.5">
                    {e.role === "admin" ? (
                      <span className="inline-flex items-center gap-1 text-primary text-xs font-medium">
                        <ShieldCheck className="w-3.5 h-3.5" /> Admin
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Employee</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 hidden sm:table-cell text-muted-foreground text-xs">
                    {new Date(e.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {e.role !== "admin" && (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDelete(e.id, e.role)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
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
