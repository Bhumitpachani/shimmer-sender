import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Eye, Pencil } from "lucide-react";
import { toast } from "sonner";
import { getSession } from "@/lib/session";

export const Route = createFileRoute("/app/templates")({
  component: TemplatesPage,
});

const SAMPLE_HTML = `<div style="font-family: Arial, sans-serif; max-width:600px; margin:0 auto; padding:20px;">
  <h1 style="color:#1e40af;">Welcome ✨</h1>
  <p>Dear customer,</p>
  <p>Thanks for being with Starlink Jewels.</p>
  <a href="#" style="display:inline-block;background:#1e40af;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Visit our store</a>
</div>`;

function TemplatesPage() {
  const session = getSession();
  const [templates, setTemplates] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", subject: "", html: SAMPLE_HTML });

  const load = async () => {
    const { data } = await supabase.from("templates").select("*").order("created_at", { ascending: false });
    setTemplates(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const startEdit = (t: any) => {
    setEditing(t);
    setForm({ name: t.name, subject: t.subject, html: t.html });
    setOpen(true);
  };
  const startNew = () => {
    setEditing(null);
    setForm({ name: "", subject: "", html: SAMPLE_HTML });
    setOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      const { error } = await supabase.from("templates").update({
        name: form.name, subject: form.subject, html: form.html,
      }).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Template updated");
    } else {
      const { error } = await supabase.from("templates").insert({
        name: form.name, subject: form.subject, html: form.html,
        created_by: session?.username ?? "admin",
      });
      if (error) return toast.error(error.message);
      toast.success("Template created");
    }
    setOpen(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    const { error } = await supabase.from("templates").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); load(); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Email Templates</h1>
          <p className="text-sm text-muted-foreground">{templates.length} template(s)</p>
        </div>
        <Button onClick={startNew}><Plus className="w-4 h-4 mr-2" />New Template</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.length === 0 ? (
          <Card className="p-8 text-center col-span-full">
            <p className="text-muted-foreground">No templates yet. Create your first one to start sending campaigns.</p>
          </Card>
        ) : templates.map((t) => (
          <Card key={t.id} className="p-4 flex flex-col">
            <div className="font-semibold">{t.name}</div>
            <div className="text-sm text-muted-foreground mb-2">{t.subject}</div>
            <div className="border rounded bg-white overflow-hidden flex-1 min-h-32 max-h-48">
              <iframe srcDoc={t.html} className="w-full h-48" sandbox="" title={t.name} />
            </div>
            <div className="text-xs text-muted-foreground mt-2">By {t.created_by} • {new Date(t.created_at).toLocaleDateString()}</div>
            <div className="flex gap-2 mt-3">
              <Button variant="outline" size="sm" onClick={() => startEdit(t)}><Pencil className="w-3 h-3 mr-1" /> Edit</Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>{editing ? "Edit Template" : "New Template"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Template Name *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Welcome Email" /></div>
              <div><Label>Email Subject *</Label><Input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Welcome to Starlink Jewels ✨" /></div>
            </div>
            <Tabs defaultValue="html">
              <TabsList>
                <TabsTrigger value="html"><Pencil className="w-3 h-3 mr-1" /> HTML</TabsTrigger>
                <TabsTrigger value="preview"><Eye className="w-3 h-3 mr-1" /> Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="html">
                <Textarea required value={form.html} onChange={(e) => setForm({ ...form, html: e.target.value })} rows={16} className="font-mono text-xs" />
              </TabsContent>
              <TabsContent value="preview">
                <div className="border rounded bg-white">
                  <iframe srcDoc={form.html} className="w-full h-96" sandbox="" title="preview" />
                </div>
              </TabsContent>
            </Tabs>
            <Button type="submit" className="w-full">{editing ? "Save Changes" : "Create Template"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
