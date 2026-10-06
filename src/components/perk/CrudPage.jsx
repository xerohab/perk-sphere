import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import PageHeader from "@/components/perk/PageHeader";
import EmptyState from "@/components/perk/EmptyState";
import ConfirmDialog from "@/components/perk/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose
} from "@/components/ui/dialog";

// Generic CRUD page for admin configuration entities. All writes go through the
// permission-checked adminWrite backend function; the entities themselves are
// write-locked for app users via RLS, so this can't be bypassed from the browser.
export default function CrudPage({ title, description, entity, columns, fields, sortBy = "-created_date", limit = 200 }) {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const load = async (silent) => {
    if (!silent) setLoading(true);
    try {
      const data = await base44.entities[entity].list(sortBy, limit);
      setItems(data || []);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing({}); setForm({}); };
  const openEdit = (item) => { setEditing(item); setForm({ ...item }); };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {};
      fields.forEach((f) => {
        let v = form[f.key];
        if (f.type === "number") v = v === "" || v == null ? 0 : Number(v);
        if (f.type === "boolean") v = !!v;
        payload[f.key] = v;
      });
      await base44.functions.invoke("adminWrite", {
        entity, op: editing?.id ? "update" : "create", id: editing?.id, data: payload
      });
      toast({ title: editing?.id ? "Updated" : "Created" });
      setEditing(null);
      load(true);
    } catch (e) {
      toast({ title: "Save failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    try {
      await base44.functions.invoke("adminWrite", { entity, op: "delete", id: item.id });
      toast({ title: "Deleted" });
      load(true);
    } catch (e) {
      toast({ title: "Delete failed", description: e?.response?.data?.error || e.message, variant: "destructive" });
    }
  };

  const renderField = (f) => {
    const value = form[f.key] ?? (f.type === "boolean" ? false : f.type === "number" ? "" : "");
    if (f.type === "boolean") {
      return (
        <div key={f.key} className="flex items-center justify-between rounded-lg border border-border p-3">
          <Label>{f.label}</Label>
          <Switch checked={value} onCheckedChange={(c) => setForm({ ...form, [f.key]: c })} />
        </div>
      );
    }
    if (f.type === "select") {
      return (
        <div key={f.key}>
          <Label>{f.label}</Label>
          <Select value={String(value)} onValueChange={(v) => setForm({ ...form, [f.key]: f.options.find((o) => String(o.value) === v)?.value ?? v })}>
            <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {f.options.map((o) => <SelectItem key={String(o.value)} value={String(o.value)}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      );
    }
    if (f.type === "textarea") {
      return (
        <div key={f.key}>
          <Label>{f.label}</Label>
          <Textarea value={value} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} className="mt-1.5" />
        </div>
      );
    }
    return (
      <div key={f.key}>
        <Label>{f.label}</Label>
        <Input type={f.type === "number" ? "number" : "text"} value={value} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} className="mt-1.5" />
      </div>
    );
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  return (
    <div>
      <PageHeader title={title} description={description} actions={<Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" /> New</Button>} />
      {items.length === 0 ? (
        <EmptyState title="Nothing here yet" description="Create your first item to get started." />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card shadow-sm sm:block">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {columns.map((c) => (<th key={c.key} className={`px-4 py-3 font-medium ${c.align === "right" ? "text-right" : ""}`}>{c.label}</th>))}
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-secondary/30">
                    {columns.map((c) => (
                      <td key={c.key} className={`px-4 py-3 ${c.align === "right" ? "text-right" : ""} ${c.mono ? "font-mono text-xs" : ""}`}>{c.render ? c.render(item) : (item[c.key] ?? "—")}</td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                        <ConfirmDialog trigger={<Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-red-500" /></Button>} title="Delete this item?" description="This action cannot be undone." confirmLabel="Delete" destructive onConfirm={() => remove(item)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 sm:hidden">
            {items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                {columns.map((c) => (
                  <div key={c.key} className="flex items-start justify-between gap-3 border-b border-border py-2 last:border-0">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{c.label}</span>
                    <span className={`text-right text-sm ${c.mono ? "font-mono text-xs" : ""}`}>{c.render ? c.render(item) : (item[c.key] ?? "—")}</span>
                  </div>
                ))}
                <div className="mt-3 flex justify-end gap-1">
                  <Button variant="outline" size="sm" onClick={() => openEdit(item)}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
                  <ConfirmDialog trigger={<Button variant="outline" size="sm"><Trash2 className="mr-1 h-3.5 w-3.5 text-red-500" /> Delete</Button>} title="Delete this item?" description="This action cannot be undone." confirmLabel="Delete" destructive onConfirm={() => remove(item)} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "New"} {title}</DialogTitle></DialogHeader>
          <div className="space-y-4">{fields.map(renderField)}</div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}