"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface Season {
  _id: string;
  name: { de: string; en: string };
  number: number;
  startsAt: string;
  endsAt: string;
  status: "upcoming" | "active" | "ended";
}

interface FormState {
  nameDe: string;
  nameEn: string;
  number: string;
  startsAt: string;
  endsAt: string;
  status: "upcoming" | "active" | "ended";
}

const emptyForm: FormState = {
  nameDe: "",
  nameEn: "",
  number: "",
  startsAt: "",
  endsAt: "",
  status: "upcoming",
};

function toDateInputValue(date: string) {
  return new Date(date).toISOString().slice(0, 10);
}

function StatusBadge({ status }: { status: Season["status"] }) {
  const styles: Record<Season["status"], string> = {
    upcoming: "bg-blue-500/15 text-blue-400",
    active: "bg-green-500/15 text-green-400",
    ended: "bg-white/10 text-text-muted",
  };
  const labels: Record<Season["status"], string> = {
    upcoming: "Upcoming",
    active: "Active",
    ended: "Ended",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export function SeasonsManager({ dict }: { lang: string; dict: Record<string, string> }) {
  const { toast } = useToast();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSeasons = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/seasons");
      const data = await res.json();
      setSeasons(data.seasons || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSeasons();
  }, [fetchSeasons]);

  function startEdit(season: Season) {
    setEditingId(season._id);
    setEditForm({
      nameDe: season.name.de,
      nameEn: season.name.en,
      number: String(season.number),
      startsAt: toDateInputValue(season.startsAt),
      endsAt: toDateInputValue(season.endsAt),
      status: season.status,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(emptyForm);
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch("/api/admin/seasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: { de: form.nameDe, en: form.nameEn },
          number: parseInt(form.number, 10),
          startsAt: form.startsAt,
          endsAt: form.endsAt,
          status: form.status,
        }),
      });
      const data = await res.json();
      if (data._id) {
        toast({ type: "success", title: dict["seasons_created"] ?? "Season erstellt" });
        setShowForm(false);
        setForm(emptyForm);
        fetchSeasons();
      } else {
        toast({ type: "error", title: data.error || "Error" });
      }
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setCreating(false);
    }
  }

  async function handleSave(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/seasons/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: { de: editForm.nameDe, en: editForm.nameEn },
          number: parseInt(editForm.number, 10),
          startsAt: editForm.startsAt,
          endsAt: editForm.endsAt,
          status: editForm.status,
        }),
      });
      const data = await res.json();
      if (data._id) {
        toast({ type: "success", title: dict["seasons_updated"] ?? "Season aktualisiert" });
        cancelEdit();
        fetchSeasons();
      } else {
        toast({ type: "error", title: data.error || "Error" });
      }
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(dict["seasons_confirmDelete"] ?? "Season wirklich löschen?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/seasons/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast({ type: "success", title: dict["seasons_deleted"] ?? "Season gelöscht" });
        fetchSeasons();
      } else {
        toast({ type: "error", title: data.error || "Error" });
      }
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setDeletingId(null);
    }
  }

  const inputCls =
    "rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-pa-green";

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-white/2">
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">#</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Name (DE)</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Name (EN)</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Start</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Ende</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted"></th>
            </tr>
          </thead>
          <tbody>
            {seasons.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                  {dict["seasons_none"] ?? "Keine Seasons vorhanden"}
                </td>
              </tr>
            ) : (
              seasons.map((s) =>
                editingId === s._id ? (
                  <tr key={s._id} className="border-b border-border last:border-0 bg-white/2">
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={editForm.number}
                        onChange={(e) => setEditForm((f) => ({ ...f, number: e.target.value }))}
                        className={`${inputCls} w-16`}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={editForm.nameDe}
                        onChange={(e) => setEditForm((f) => ({ ...f, nameDe: e.target.value }))}
                        className={`${inputCls} w-32`}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={editForm.nameEn}
                        onChange={(e) => setEditForm((f) => ({ ...f, nameEn: e.target.value }))}
                        className={`${inputCls} w-32`}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={editForm.status}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            status: e.target.value as Season["status"],
                          }))
                        }
                        className={`${inputCls} w-28`}
                      >
                        <option value="upcoming">Upcoming</option>
                        <option value="active">Active</option>
                        <option value="ended">Ended</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="date"
                        value={editForm.startsAt}
                        onChange={(e) => setEditForm((f) => ({ ...f, startsAt: e.target.value }))}
                        className={inputCls}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="date"
                        value={editForm.endsAt}
                        onChange={(e) => setEditForm((f) => ({ ...f, endsAt: e.target.value }))}
                        className={inputCls}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSave(s._id)}
                          disabled={saving}
                          className="flex items-center gap-1 rounded-lg bg-pa-green px-3 py-1.5 text-xs font-medium text-black hover:bg-pa-green/90 disabled:opacity-50"
                        >
                          {saving ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                          {dict["seasons_save"] ?? "Speichern"}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-white/5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={s._id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-mono text-text-primary">{s.number}</td>
                    <td className="px-4 py-3 text-text-primary">{s.name.de}</td>
                    <td className="px-4 py-3 text-text-secondary">{s.name.en}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {new Date(s.startsAt).toLocaleDateString("de-DE")}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {new Date(s.endsAt).toLocaleDateString("de-DE")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEdit(s)}
                          className="rounded-lg p-1.5 text-text-muted hover:bg-white/5 hover:text-text-primary"
                          title={dict["seasons_edit"] ?? "Bearbeiten"}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(s._id)}
                          disabled={deletingId === s._id}
                          className="rounded-lg p-1.5 text-text-muted hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                          title={dict["seasons_delete"] ?? "Löschen"}
                        >
                          {deletingId === s._id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>
      </div>

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-pa-green/10 px-4 py-2 text-sm font-medium text-pa-green hover:bg-pa-green/20"
        >
          <Plus className="h-4 w-4" />
          {dict["seasons_addSeason"] ?? "Season hinzufügen"}
        </button>
      ) : (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">
            {dict["seasons_newSeason"] ?? "Neue Season"}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            <input
              type="text"
              placeholder={dict["seasons_nameDe"] ?? "Name (DE)"}
              value={form.nameDe}
              onChange={(e) => setForm((f) => ({ ...f, nameDe: e.target.value }))}
              className={inputCls}
            />
            <input
              type="text"
              placeholder={dict["seasons_nameEn"] ?? "Name (EN)"}
              value={form.nameEn}
              onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))}
              className={inputCls}
            />
            <input
              type="number"
              placeholder={dict["seasons_number"] ?? "Season-Nummer"}
              value={form.number}
              onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
              className={inputCls}
            />
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted">
                {dict["seasons_startsAt"] ?? "Startdatum"}
              </label>
              <input
                type="date"
                value={form.startsAt}
                onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted">
                {dict["seasons_endsAt"] ?? "Enddatum"}
              </label>
              <input
                type="date"
                value={form.endsAt}
                onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted">Status</label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value as Season["status"] }))
                }
                className={inputCls}
              >
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
                <option value="ended">Ended</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 rounded-lg bg-pa-green px-4 py-2 text-sm font-medium text-black hover:bg-pa-green/90 disabled:opacity-50"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {dict["seasons_create"] ?? "Erstellen"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setForm(emptyForm);
              }}
              className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:bg-white/5"
            >
              {dict["seasons_cancel"] ?? "Abbrechen"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
