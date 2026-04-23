"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

interface KnowledgeEntry {
  id: string;
  topic: string;
  correction: string;
  priority: number;
  active: boolean;
  language: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DraftState {
  topic: string;
  correction: string;
  priority: number;
  active: boolean;
  language: string | null;
}

const EMPTY_DRAFT: DraftState = {
  topic: "",
  correction: "",
  priority: 50,
  active: true,
  language: null,
};

export function PackiKnowledgeManager() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/packi/knowledge");
      if (!res.ok) {
        toast({ type: "error", title: "Einträge konnten nicht geladen werden" });
        return;
      }
      const data = (await res.json()) as { entries: KnowledgeEntry[] };
      setEntries(data.entries ?? []);
    } catch {
      toast({ type: "error", title: "Netzwerkfehler" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  function openCreate() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setModalOpen(true);
  }

  function openEdit(entry: KnowledgeEntry) {
    setEditingId(entry.id);
    setDraft({
      topic: entry.topic,
      correction: entry.correction,
      priority: entry.priority,
      active: entry.active,
      language: entry.language,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!draft.topic.trim() || !draft.correction.trim()) {
      toast({ type: "error", title: "Topic und Correction sind Pflicht" });
      return;
    }
    setSaving(true);
    try {
      const url = editingId
        ? `/api/admin/packi/knowledge/${editingId}`
        : "/api/admin/packi/knowledge";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast({ type: "error", title: data.error ?? "Speichern fehlgeschlagen" });
        return;
      }
      toast({
        type: "success",
        title: editingId ? "Korrektur aktualisiert" : "Korrektur gespeichert",
      });
      setModalOpen(false);
      setDraft(EMPTY_DRAFT);
      setEditingId(null);
      await fetchEntries();
    } catch {
      toast({ type: "error", title: "Netzwerkfehler" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(entry: KnowledgeEntry) {
    if (!confirm(`"${entry.topic}" wirklich löschen?`)) return;
    try {
      const res = await fetch(`/api/admin/packi/knowledge/${entry.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast({ type: "error", title: "Löschen fehlgeschlagen" });
        return;
      }
      toast({ type: "success", title: "Korrektur gelöscht" });
      await fetchEntries();
    } catch {
      toast({ type: "error", title: "Netzwerkfehler" });
    }
  }

  async function toggleActive(entry: KnowledgeEntry) {
    try {
      const res = await fetch(`/api/admin/packi/knowledge/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !entry.active }),
      });
      if (!res.ok) {
        toast({ type: "error", title: "Aktualisierung fehlgeschlagen" });
        return;
      }
      await fetchEntries();
    } catch {
      toast({ type: "error", title: "Netzwerkfehler" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-text-secondary text-sm max-w-2xl">
          Einträge hier werden verbindlich in Packis System-Prompt injiziert und
          haben Vorrang vor der Persona. Änderungen wirken beim nächsten Chat-Turn
          — kein Redeploy nötig.
        </p>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4" /> Neue Korrektur
        </Button>
      </div>

      {loading ? (
        <p className="text-text-muted text-sm">Lade…</p>
      ) : entries.length === 0 ? (
        <div className="rounded-md border border-border bg-surface-elevated p-6 text-center text-text-muted text-sm">
          Noch keine Korrekturen. Leg die erste an, sobald Packi etwas falsch
          beantwortet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-surface-elevated">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-muted">
                <th className="px-3 py-2 font-medium">Topic</th>
                <th className="px-3 py-2 font-medium">Correction</th>
                <th className="px-3 py-2 font-medium">Prio</th>
                <th className="px-3 py-2 font-medium">Lang</th>
                <th className="px-3 py-2 font-medium">Aktiv</th>
                <th className="px-3 py-2 font-medium text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-border/40 last:border-b-0">
                  <td className="px-3 py-2 text-text-primary font-medium">
                    {e.topic}
                  </td>
                  <td className="px-3 py-2 text-text-secondary max-w-lg">
                    <div className="line-clamp-2">{e.correction}</div>
                  </td>
                  <td className="px-3 py-2 text-text-muted">{e.priority}</td>
                  <td className="px-3 py-2 text-text-muted">
                    {e.language ?? "alle"}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleActive(e)}
                      className={[
                        "inline-flex h-5 w-9 rounded-full transition-colors relative",
                        e.active ? "bg-pa-green" : "bg-white/10",
                      ].join(" ")}
                      aria-label={e.active ? "Deaktivieren" : "Aktivieren"}
                    >
                      <span
                        className={[
                          "h-4 w-4 rounded-full bg-white absolute top-0.5 transition-transform",
                          e.active ? "translate-x-4" : "translate-x-0.5",
                        ].join(" ")}
                      />
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(e)}
                        className="p-1.5 text-text-muted hover:text-text-primary rounded-md"
                        aria-label="Bearbeiten"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(e)}
                        className="p-1.5 text-text-muted hover:text-error rounded-md"
                        aria-label="Löschen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          if (saving) return;
          setModalOpen(false);
          setDraft(EMPTY_DRAFT);
          setEditingId(null);
        }}
        title={editingId ? "Korrektur bearbeiten" : "Neue Korrektur"}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Topic (kurzes Label, max 120)"
            value={draft.topic}
            maxLength={120}
            onChange={(e) => setDraft({ ...draft, topic: e.target.value })}
            placeholder="z.B. Coin-Signupbonus"
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-text-secondary text-sm font-medium">
              Correction (max 2000)
            </label>
            <textarea
              value={draft.correction}
              onChange={(e) =>
                setDraft({ ...draft, correction: e.target.value })
              }
              maxLength={2000}
              rows={5}
              placeholder="Konkrete Anweisung an Packi. Beispiel: 'User bekommen beim Signup 50 Coins, nicht 100.'"
              className="bg-white/3 border border-white/8 text-text-primary rounded-[10px] px-4 py-3 outline-none focus:border-pa-green/35 focus:ring-2 focus:ring-pa-green/6 text-sm"
            />
            <p className="text-text-muted text-xs">
              {draft.correction.length} / 2000 Zeichen
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-text-secondary text-sm font-medium">
                Priorität (0-100)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={draft.priority}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    priority: Math.max(
                      0,
                      Math.min(100, Number(e.target.value) || 0),
                    ),
                  })
                }
                className="bg-white/3 border border-white/8 text-text-primary rounded-[10px] px-4 py-3 outline-none focus:border-pa-green/35 focus:ring-2 focus:ring-pa-green/6"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-text-secondary text-sm font-medium">
                Sprache
              </label>
              <select
                value={draft.language ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    language: e.target.value === "" ? null : e.target.value,
                  })
                }
                className="bg-white/3 border border-white/8 text-text-primary rounded-[10px] px-4 py-3 outline-none focus:border-pa-green/35 focus:ring-2 focus:ring-pa-green/6"
              >
                <option value="">Alle Sprachen</option>
                <option value="de">Nur Deutsch (de)</option>
                <option value="en">Nur English (en)</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) =>
                setDraft({ ...draft, active: e.target.checked })
              }
            />
            Aktiv (sofort wirksam)
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                setModalOpen(false);
                setDraft(EMPTY_DRAFT);
                setEditingId(null);
              }}
              disabled={saving}
            >
              Abbrechen
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingId ? "Speichern" : "Anlegen"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
