import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db, type Template } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Copy, Code2, Eye, Mail } from "lucide-react";
import { toast } from "sonner";
import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/app/templates")({
  component: TemplatesPage,
});

const SAMPLE = `<div style="font-family: -apple-system, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
  <div style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 40px 32px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">✨ Starlink Jewels</h1>
    <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 15px;">Special Offer Inside</p>
  </div>
  <div style="padding: 32px; background: #f8fafc;">
    <h2 style="color: #1e293b; font-size: 22px; margin: 0 0 12px;">Dear Valued Customer,</h2>
    <p style="color: #475569; line-height: 1.6; margin: 0 0 20px;">Thank you for being a cherished part of the Starlink Jewels family. We have an exclusive offer just for you.</p>
    <div style="background: #ffffff; border-radius: 10px; padding: 20px; border: 1px solid #e2e8f0; margin-bottom: 24px;">
      <p style="color: #64748b; font-size: 13px; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Your Exclusive Discount</p>
      <p style="color: #3b82f6; font-size: 36px; font-weight: 800; margin: 0;">20% OFF</p>
      <p style="color: #94a3b8; font-size: 13px; margin: 4px 0 0;">Valid for this week only</p>
    </div>
    <div style="text-align: center;">
      <a href="#" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Shop Now →</a>
    </div>
  </div>
  <div style="padding: 20px 32px; text-align: center; background: #f1f5f9; border-radius: 0 0 12px 12px;">
    <p style="color: #94a3b8; font-size: 12px; margin: 0;">© 2025 Starlink Jewels · Unsubscribe</p>
  </div>
</div>`;

function TemplatesPage() {
  const session = getSession();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState({ name: "", subject: "", html: SAMPLE });
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);

  useEffect(() => {
    if (session && session.role !== "admin") navigate({ to: "/app/clients" });
  }, [session, navigate]);

  const load = async () => {
    setLoading(true);
    try {
      setTemplates(await db.templates.getAll());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ name: "", subject: "", html: SAMPLE }); setOpen(true); };
  const openEdit = (t: Template) => { setEditing(t); setForm({ name: t.name, subject: t.subject, html: t.html }); setOpen(true); };
  const openDuplicate = (t: Template) => { setEditing(null); setForm({ name: `${t.name} (Copy)`, subject: t.subject, html: t.html }); setOpen(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await db.templates.update(editing.id, { name: form.name, subject: form.subject, html: form.html });
        toast.success("Template updated");
      } else {
        await db.templates.insert({ name: form.name, subject: form.subject, html: form.html, created_by: session?.username ?? "admin" });
        toast.success("Template created");
      }
      setOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await db.templates.delete(deleteTarget.id);
    toast.success("Template deleted");
    setDeleteTarget(null);
    await load();
  };

  if (!session || session.role !== "admin") return null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Email Templates"
        count={templates.length}
        subtitle="Design and manage your reusable email templates"
        actions={
          <Button onClick={openNew} className="gap-1.5 shadow-sm shadow-primary/20">
            <Plus className="w-4 h-4" />New Template
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-14 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-700">No templates yet</h3>
          <p className="text-sm text-slate-400 mt-1 mb-5">Create your first email template to start running campaigns.</p>
          <Button onClick={openNew} size="sm" variant="outline"><Plus className="w-3.5 h-3.5 mr-1.5" />Create Template</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {templates.map((t) => (
            <div key={t.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
              <div className="px-5 pt-4 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 dark:text-white truncate">{t.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5 truncate">{t.subject}</div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 shadow-md shadow-violet-500/30 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-white" />
                  </div>
                </div>
              </div>
              <div className="mx-4 mb-3 rounded-xl overflow-hidden border border-slate-100 bg-white" style={{ height: 160 }}>
                <div style={{ width: "300%", height: 480, transform: "scale(0.3333)", transformOrigin: "top left" }}>
                  <iframe
                    srcDoc={t.html}
                    scrolling="no"
                    sandbox=""
                    title={t.name}
                    className="w-full h-full border-0"
                    style={{ pointerEvents: "none" }}
                  />
                </div>
              </div>
              <div className="px-4 pb-4 mt-auto flex items-center justify-between gap-2">
                <div className="text-[11px] text-slate-400">by {t.created_by} · {new Date(t.created_at).toLocaleDateString()}</div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => openEdit(t)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors"
                  >
                    <Pencil className="w-3 h-3" />Edit
                  </button>
                  <button
                    onClick={() => openDuplicate(t)}
                    title="Duplicate"
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(t)}
                    title="Delete"
                    className="p-1.5 rounded-lg border border-slate-200 hover:border-red-200 hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
            <DialogTitle>{editing ? "Edit Template" : "New Email Template"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 px-6 pb-6 pt-4 gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 shrink-0">
              <div>
                <Label className="text-sm font-medium">Template Name *</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Welcome Email" className="mt-1.5" />
              </div>
              <div>
                <Label className="text-sm font-medium">Email Subject *</Label>
                <Input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Welcome to Starlink Jewels ✨" className="mt-1.5" />
              </div>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="flex flex-col min-h-0">
                <Label className="text-sm font-medium flex items-center gap-1.5 mb-1.5"><Code2 className="w-3.5 h-3.5" />HTML</Label>
                <Textarea
                  value={form.html}
                  onChange={(e) => setForm({ ...form, html: e.target.value })}
                  className="font-mono text-xs flex-1 min-h-[240px] resize-none bg-slate-950 text-slate-300 border-slate-800 rounded-xl"
                  placeholder="<html>…"
                />
              </div>
              <div className="flex flex-col min-h-0">
                <Label className="text-sm font-medium flex items-center gap-1.5 mb-1.5"><Eye className="w-3.5 h-3.5" />Live Preview</Label>
                <div className="flex-1 min-h-[240px] border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <iframe srcDoc={form.html} className="w-full h-full" sandbox="" title="preview" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 shrink-0">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</span> : (editing ? "Save Changes" : "Create Template")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        title={`Delete template "${deleteTarget?.name}"?`}
        description="Campaigns that already used this template keep their send history, but you won't be able to select it for new campaigns. This cannot be undone."
        onConfirm={confirmDelete}
      />
    </div>
  );
}
