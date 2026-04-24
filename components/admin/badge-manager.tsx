"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Plus, Trash2, ArrowLeft } from "lucide-react";

type Tone = "neutral" | "green" | "gold" | "lilac" | "blue";
type Visibility = "public" | "staff_only";

interface BadgeRecord {
  _id: string;
  key: string;
  slug: string;
  label: string;
  iconUrl: string | null;
  description: string | null;
  tone: Tone;
  active: boolean;
  sortOrder: number;
  visibility: Visibility;
  category: string | null;
  createdAt?: string;
  updatedAt?: string;
}

type View = { kind: "list" } | { kind: "edit"; badge: BadgeRecord } | { kind: "new" };

interface FormState {
  key: string;
  slug: string;
  label: string;
  iconUrl: string;
  description: string;
  tone: Tone;
  active: boolean;
  sortOrder: number;
  visibility: Visibility;
  category: string;
}

const EMPTY_FORM: FormState = {
  key: "",
  slug: "",
  label: "",
  iconUrl: "",
  description: "",
  tone: "neutral",
  active: true,
  sortOrder: 0,
  visibility: "public",
  category: "",
};

function fromRecord(b: BadgeRecord): FormState {
  return {
    key: b.key,
    slug: b.slug,
    label: b.label,
    iconUrl: b.iconUrl ?? "",
    description: b.description ?? "",
    tone: b.tone,
    active: b.active,
    sortOrder: b.sortOrder,
    visibility: b.visibility,
    category: b.category ?? "",
  };
}

const TONE_LABEL: Record<Tone, string> = {
  neutral: "Neutral",
  green: "Grün",
  gold: "Gold",
  lilac: "Lila",
  blue: "Blau",
};

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-surface text-text-secondary border border-border",
  green: "bg-pa-green/15 text-pa-green border border-pa-green/30",
  gold: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  lilac: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
  blue: "bg-pa-blue/20 text-pa-blue border border-pa-blue/30",
};

export function BadgeManager() {
  const [records, setRecords] = useState<BadgeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>({ kind: "list" });
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/badges");
      if (!res.ok) throw new Error("load_failed");
      const data = await res.json();
      setRecords(Array.isArray(data.badges) ? data.badges : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const startNew = () => {
    setForm(EMPTY_FORM);
    setError(null);
    setView({ kind: "new" });
  };

  const startEdit = (badge: BadgeRecord) => {
    setForm(fromRecord(badge));
    setError(null);
    setView({ kind: "edit", badge });
  };

  const cancelEdit = () => {
    setForm(EMPTY_FORM);
    setError(null);
    setView({ kind: "list" });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const isNew = view.kind === "new";
      const url = isNew
        ? "/api/admin/badges"
        : `/api/admin/badges/${(view as { badge: BadgeRecord }).badge._id}`;
      const method = isNew ? "POST" : "PATCH";
      const payload: Record<string, unknown> = {
        slug: form.slug,
        label: form.label,
        iconUrl: form.iconUrl || null,
        description: form.description || null,
        tone: form.tone,
        sortOrder: form.sortOrder,
        visibility: form.visibility,
        category: form.category || null,
        active: form.active,
      };
      if (isNew) payload.key = form.key;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "save_failed");
        return;
      }
      await fetchList();
      cancelEdit();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (b: BadgeRecord) => {
    if (!window.confirm(`Badge "${b.key}" deaktivieren? Bestehende UserBadges bleiben erhalten.`))
      return;
    const res = await fetch(`/api/admin/badges/${b._id}`, { method: "DELETE" });
    if (res.ok) await fetchList();
  };

  if (view.kind === "list") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">Badges</h1>
            <p className="text-sm text-text-secondary">
              Definitionen für Abzeichen, die manuell oder über Achievement-Rewards verliehen werden.
            </p>
          </div>
          <Button onClick={startNew}>
            <Plus className="h-4 w-4 mr-1" /> Neues Badge
          </Button>
        </div>
        {loading ? (
          <Card className="p-6 text-center text-text-muted">Lädt…</Card>
        ) : records.length === 0 ? (
          <Card className="p-6 text-center text-text-muted">Noch keine Badges definiert.</Card>
        ) : (
          <div className="space-y-2">
            {records.map((b) => (
              <Card key={b._id} className="p-4 flex items-center gap-4">
                <div className="flex-none w-12 h-12 rounded grid place-items-center overflow-hidden bg-surface border border-border">
                  {b.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.iconUrl} alt={b.label} className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-text-muted">kein Icon</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-text-primary truncate">{b.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TONE_CLASS[b.tone]}`}>
                      {TONE_LABEL[b.tone]}
                    </span>
                    {!b.active && <Badge variant="warning">inaktiv</Badge>}
                    {b.visibility === "staff_only" && <Badge variant="info">staff only</Badge>}
                    {b.category && <Badge variant="info">{b.category}</Badge>}
                  </div>
                  <div className="text-xs text-text-muted mt-1 font-mono truncate">{b.key} · {b.slug}</div>
                </div>
                <div className="flex-none flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => startEdit(b)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Bearbeiten
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => remove(b)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  const isNew = view.kind === "new";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={cancelEdit}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold text-text-primary">
            {isNew ? "Neues Badge" : `Badge bearbeiten: ${form.key}`}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={cancelEdit} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Speichert…" : "Speichern"}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="p-3 border-red-500 text-red-500 text-sm">{error}</Card>
      )}

      <Card className="p-4 space-y-4">
        <h2 className="font-semibold text-text-primary">Identifikation</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="text-sm space-y-1">
            <span className="text-text-secondary">Key (lowercase_mit_underscore)</span>
            <Input
              value={form.key}
              disabled={!isNew}
              onChange={(e) => setForm((f) => ({ ...f, key: e.target.value.toLowerCase() }))}
              placeholder="z.B. champion_2026"
            />
            <span className="text-xs text-text-muted">Wird in Achievement-Rewards referenziert. Nach Erstellung unveränderlich.</span>
          </label>
          <label className="text-sm space-y-1">
            <span className="text-text-secondary">Slug (URL-fähig)</span>
            <Input
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))}
              placeholder="champion-2026"
            />
          </label>
          <label className="text-sm space-y-1 md:col-span-2">
            <span className="text-text-secondary">Label (Anzeigename)</span>
            <Input
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="z.B. Champion 2026"
            />
          </label>
          <label className="text-sm space-y-1 md:col-span-2">
            <span className="text-text-secondary">Beschreibung (optional)</span>
            <textarea
              className="w-full rounded border border-border bg-surface p-2 text-text-primary text-sm"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <h2 className="font-semibold text-text-primary">Darstellung</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="text-sm space-y-1">
            <span className="text-text-secondary">Icon-URL (z.B. /badges/foo.webp)</span>
            <Input
              value={form.iconUrl}
              onChange={(e) => setForm((f) => ({ ...f, iconUrl: e.target.value }))}
              placeholder="/badges/champion.webp"
            />
          </label>
          {form.iconUrl && (
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded bg-surface border border-border grid place-items-center overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.iconUrl} alt="" className="w-full h-full object-contain" />
              </div>
              <span className="text-xs text-text-muted">Vorschau</span>
            </div>
          )}
          <label className="text-sm space-y-1">
            <span className="text-text-secondary">Tonalität</span>
            <select
              className="w-full rounded border border-border bg-surface p-2 text-text-primary"
              value={form.tone}
              onChange={(e) => setForm((f) => ({ ...f, tone: e.target.value as Tone }))}
            >
              {(Object.keys(TONE_LABEL) as Tone[]).map((t) => (
                <option key={t} value={t}>{TONE_LABEL[t]}</option>
              ))}
            </select>
          </label>
          <label className="text-sm space-y-1">
            <span className="text-text-secondary">Sichtbarkeit</span>
            <select
              className="w-full rounded border border-border bg-surface p-2 text-text-primary"
              value={form.visibility}
              onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value as Visibility }))}
            >
              <option value="public">Öffentlich</option>
              <option value="staff_only">Nur Staff</option>
            </select>
          </label>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <h2 className="font-semibold text-text-primary">Verwaltung</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="text-sm space-y-1">
            <span className="text-text-secondary">Sortierung</span>
            <Input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
            />
          </label>
          <label className="text-sm space-y-1">
            <span className="text-text-secondary">Kategorie (optional)</span>
            <Input
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="z.B. event, quiz, season"
            />
          </label>
          <label className="flex items-center gap-2 text-sm pt-6">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            <span className="text-text-primary">Aktiv (für Verleihung verfügbar)</span>
          </label>
        </div>
      </Card>
    </div>
  );
}
