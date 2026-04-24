"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Plus, Trash2, ArrowLeft, UserPlus } from "lucide-react";

type TriggerType = "level" | "counter" | "once" | "manual";
type CounterMetric = "boxesOpened" | "cardsConverted" | "battlesPlayed" | "battlesWon" | "coinsSpent" | "loginDays";
type OnceEvent = "tour_completed" | "first_pack_opened" | "first_battle" | "first_purchase";
type RewardType = "coins" | "convert_multiplier" | "unlock_box" | "cosmetic" | "grant_badge";
type Category = "level" | "progression" | "battle" | "economy" | "social" | "event";

interface Achievement {
  _id: string;
  key: string;
  titleKey: string;
  descriptionKey: string;
  iconImageId: string | null;
  category: Category;
  hidden: boolean;
  active: boolean;
  sortOrder: number;
  trigger: { type: TriggerType; params: Record<string, unknown> };
  rewards: Array<{ type: RewardType; params: Record<string, unknown> }>;
  createdAt: string;
  updatedAt: string;
}

type View = { kind: "list" } | { kind: "edit"; achievement: Achievement } | { kind: "new" };

interface FormState {
  key: string;
  category: Category;
  hidden: boolean;
  active: boolean;
  sortOrder: number;
  titles: Record<string, string>;
  descriptions: Record<string, string>;
  trigger: { type: TriggerType; params: Record<string, unknown> };
  rewards: Array<{ type: RewardType; params: Record<string, unknown> }>;
  iconFile: File | null;
  existingIconId: string | null;
}

const EMPTY_FORM: FormState = {
  key: "",
  category: "progression",
  hidden: false,
  active: true,
  sortOrder: 0,
  titles: { de: "", en: "" },
  descriptions: { de: "", en: "" },
  trigger: { type: "manual", params: {} },
  rewards: [],
  iconFile: null,
  existingIconId: null,
};

const CATEGORY_LABEL: Record<Category, string> = {
  level: "Level",
  progression: "Fortschritt",
  battle: "Battle",
  economy: "Ökonomie",
  social: "Social",
  event: "Event",
};

const METRIC_LABEL: Record<CounterMetric, string> = {
  boxesOpened: "Boxen geöffnet",
  cardsConverted: "Karten konvertiert",
  battlesPlayed: "Battles gespielt",
  battlesWon: "Battles gewonnen",
  coinsSpent: "Coins ausgegeben",
  loginDays: "Login-Tage",
};

const ONCE_LABEL: Record<OnceEvent, string> = {
  tour_completed: "Tour abgeschlossen",
  first_pack_opened: "Erste Box geöffnet",
  first_battle: "Erstes Battle",
  first_purchase: "Erster Münzkauf",
};

const REWARD_LABEL: Record<RewardType, string> = {
  coins: "Coins",
  convert_multiplier: "Convert-Multiplikator",
  unlock_box: "Box freischalten",
  cosmetic: "Kosmetik",
  grant_badge: "Badge verleihen",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return value;
  }
}

async function loadTranslations(id: string): Promise<{ titles: Record<string, string>; descriptions: Record<string, string> } | null> {
  try {
    const res = await fetch(`/api/admin/achievements/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    return { titles: data.titles ?? {}, descriptions: data.descriptions ?? {} };
  } catch {
    return null;
  }
}

export function AchievementManager() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>({ kind: "list" });
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [grantOpen, setGrantOpen] = useState<Achievement | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/achievements");
      if (!res.ok) throw new Error("load_failed");
      const data = await res.json();
      setAchievements(data.achievements ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const startEdit = useCallback(async (achievement: Achievement) => {
    const copy = await loadTranslations(achievement._id);
    setForm({
      key: achievement.key,
      category: achievement.category,
      hidden: achievement.hidden,
      active: achievement.active,
      sortOrder: achievement.sortOrder,
      titles: copy?.titles ?? { de: "", en: "" },
      descriptions: copy?.descriptions ?? { de: "", en: "" },
      trigger: achievement.trigger,
      rewards: achievement.rewards,
      iconFile: null,
      existingIconId: achievement.iconImageId,
    });
    setErrors({});
    setView({ kind: "edit", achievement });
  }, []);

  const startNew = useCallback(() => {
    setForm(EMPTY_FORM);
    setErrors({});
    setView({ kind: "new" });
  }, []);

  const cancelEdit = useCallback(() => {
    setForm(EMPTY_FORM);
    setErrors({});
    setView({ kind: "list" });
  }, []);

  const validate = useCallback((state: FormState, isNew: boolean): Record<string, string> => {
    const e: Record<string, string> = {};
    if (isNew) {
      if (!state.key) e.key = "Schlüssel ist erforderlich.";
      else if (!/^[a-z0-9_]{2,64}$/.test(state.key)) e.key = "Nur Kleinbuchstaben, Zahlen, Unterstrich (2-64).";
    }
    if (!state.titles.de && !state.titles.en) e.titles = "Mindestens ein Titel (DE oder EN).";
    if (state.trigger.type === "level") {
      const lvl = Number(state.trigger.params.level);
      if (!Number.isFinite(lvl) || lvl < 1 || lvl > 100) e.trigger = "Level muss 1-100 sein.";
    } else if (state.trigger.type === "counter") {
      const target = Number(state.trigger.params.target);
      if (!state.trigger.params.metric) e.trigger = "Metrik wählen.";
      else if (!Number.isFinite(target) || target < 1) e.trigger = "Zielwert muss ≥1 sein.";
    } else if (state.trigger.type === "once") {
      if (!state.trigger.params.event) e.trigger = "Event wählen.";
    }
    state.rewards.forEach((r, i) => {
      if (r.type === "coins") {
        const a = Number(r.params.amount);
        if (!Number.isFinite(a) || a <= 0) e[`reward${i}`] = "Coin-Betrag > 0";
      } else if (r.type === "convert_multiplier") {
        const m = Number(r.params.multiplier);
        if (!Number.isFinite(m) || m <= 0 || m > 10) e[`reward${i}`] = "Multiplikator 0-10";
      } else if (r.type === "unlock_box") {
        if (!String(r.params.boxSlug ?? "").trim()) e[`reward${i}`] = "Box-Slug fehlt";
      } else if (r.type === "cosmetic") {
        if (!r.params.slot || !String(r.params.value ?? "").trim()) e[`reward${i}`] = "Slot + Wert nötig";
      } else if (r.type === "grant_badge") {
        if (!String(r.params.badgeKey ?? "").trim()) e[`reward${i}`] = "Badge-Key fehlt";
      }
    });
    return e;
  }, []);

  const save = useCallback(async () => {
    const isNew = view.kind === "new";
    const ve = validate(form, isNew);
    if (Object.keys(ve).length > 0) {
      setErrors(ve);
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      const body = new FormData();
      if (isNew) body.append("key", form.key);
      body.append("category", form.category);
      body.append("hidden", String(form.hidden));
      body.append("active", String(form.active));
      body.append("sortOrder", String(form.sortOrder));
      body.append("trigger", JSON.stringify(form.trigger));
      body.append("rewards", JSON.stringify(form.rewards));
      body.append("titles", JSON.stringify(form.titles));
      body.append("descriptions", JSON.stringify(form.descriptions));
      if (form.iconFile) body.append("icon", form.iconFile);

      const url = isNew
        ? "/api/admin/achievements"
        : `/api/admin/achievements/${(view as { achievement: Achievement }).achievement._id}`;
      const method = isNew ? "POST" : "PATCH";
      const res = await fetch(url, { method, body });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrors({ form: data.error ?? "save_failed" });
        return;
      }
      await fetchList();
      cancelEdit();
    } finally {
      setSaving(false);
    }
  }, [form, view, validate, fetchList, cancelEdit]);

  const remove = useCallback(async (a: Achievement) => {
    if (!window.confirm(`Achievement "${a.key}" wirklich deaktivieren? UserAchievements bleiben als Audit-Trail erhalten.`)) return;
    const res = await fetch(`/api/admin/achievements/${a._id}`, { method: "DELETE" });
    if (res.ok) await fetchList();
  }, [fetchList]);

  const rows = useMemo(() => achievements, [achievements]);

  if (view.kind === "list") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-primary">Achievements</h1>
            <p className="text-sm text-secondary">Erfolge und Belohnungen konfigurieren.</p>
          </div>
          <Button onClick={startNew}>
            <Plus className="h-4 w-4 mr-1" /> Neues Achievement
          </Button>
        </div>
        {loading ? (
          <div className="text-sm text-secondary">Laden…</div>
        ) : rows.length === 0 ? (
          <Card className="p-6 text-center text-secondary">
            Keine Achievements. Starte mit einem neuen.
          </Card>
        ) : (
          <div className="space-y-2">
            {rows.map((a) => (
              <Card key={a._id} className="p-4 flex items-center gap-4">
                <div className="flex-none w-16 h-16 rounded bg-surface border border-border grid place-items-center overflow-hidden">
                  {a.iconImageId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/achievements/images/${a.iconImageId}`} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-xs text-secondary">kein Icon</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm">{a.key}</span>
                    <Badge variant={a.active ? "success" : "info"}>{a.active ? "aktiv" : "inaktiv"}</Badge>
                    {a.hidden && <Badge variant="info">versteckt</Badge>}
                    <Badge variant="info">{CATEGORY_LABEL[a.category]}</Badge>
                    <Badge variant="info">{a.trigger.type}</Badge>
                    {a.rewards.length > 0 && (
                      <Badge variant="info">{a.rewards.length} Reward{a.rewards.length > 1 ? "s" : ""}</Badge>
                    )}
                  </div>
                  <div className="text-xs text-secondary mt-1">
                    Sortierung: {a.sortOrder} · erstellt {formatDate(a.createdAt)}
                  </div>
                </div>
                <div className="flex-none flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setGrantOpen(a)}>
                    <UserPlus className="h-3.5 w-3.5 mr-1" /> Verleihen
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => startEdit(a)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Bearbeiten
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => remove(a)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
        {grantOpen && (
          <ManualGrantDialog
            achievement={grantOpen}
            onClose={() => setGrantOpen(null)}
          />
        )}
      </div>
    );
  }

  const isNew = view.kind === "new";
  return (
    <AchievementForm
      form={form}
      setForm={setForm}
      errors={errors}
      saving={saving}
      isNew={isNew}
      onCancel={cancelEdit}
      onSave={save}
    />
  );
}

interface FormProps {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  errors: Record<string, string>;
  saving: boolean;
  isNew: boolean;
  onCancel: () => void;
  onSave: () => void;
}

function AchievementForm({ form, setForm, errors, saving, isNew, onCancel, onSave }: FormProps) {
  const iconInput = useRef<HTMLInputElement>(null);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setTitle = (lang: string, value: string) =>
    setForm((f) => ({ ...f, titles: { ...f.titles, [lang]: value } }));
  const setDescription = (lang: string, value: string) =>
    setForm((f) => ({ ...f, descriptions: { ...f.descriptions, [lang]: value } }));

  const changeTriggerType = (type: TriggerType) => {
    setForm((f) => ({ ...f, trigger: { type, params: {} } }));
  };

  const setTriggerParam = (k: string, v: unknown) => {
    setForm((f) => ({ ...f, trigger: { ...f.trigger, params: { ...f.trigger.params, [k]: v } } }));
  };

  const addReward = () =>
    setForm((f) => ({ ...f, rewards: [...f.rewards, { type: "coins", params: { amount: 100 } }] }));

  const updateReward = (i: number, next: { type: RewardType; params: Record<string, unknown> }) =>
    setForm((f) => ({ ...f, rewards: f.rewards.map((r, idx) => (idx === i ? next : r)) }));

  const removeReward = (i: number) =>
    setForm((f) => ({ ...f, rewards: f.rewards.filter((_, idx) => idx !== i) }));

  const iconPreview = form.iconFile
    ? URL.createObjectURL(form.iconFile)
    : form.existingIconId
      ? `/api/achievements/images/${form.existingIconId}`
      : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold text-primary">
            {isNew ? "Neues Achievement" : `Achievement bearbeiten: ${form.key}`}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Speichert…" : "Speichern"}
          </Button>
        </div>
      </div>

      {errors.form && (
        <Card className="p-3 border-red-500 text-red-500 text-sm">{errors.form}</Card>
      )}

      <Card className="p-4 space-y-4">
        <h2 className="font-semibold text-primary">Grunddaten</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="text-sm space-y-1">
            <span className="text-secondary">Schlüssel (lowercase_mit_underscore)</span>
            <Input
              value={form.key}
              onChange={(e) => setField("key", e.target.value.toLowerCase())}
              disabled={!isNew}
              placeholder="open_100_boxes"
            />
            {errors.key && <span className="text-red-500 text-xs">{errors.key}</span>}
          </label>
          <label className="text-sm space-y-1">
            <span className="text-secondary">Kategorie</span>
            <select
              className="w-full rounded border border-border bg-surface p-2 text-primary"
              value={form.category}
              onChange={(e) => setField("category", e.target.value as Category)}
            >
              {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
              ))}
            </select>
          </label>
          <label className="text-sm space-y-1">
            <span className="text-secondary">Sortierung</span>
            <Input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setField("sortOrder", Number(e.target.value))}
            />
          </label>
          <div className="text-sm space-y-2 pt-6">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.active} onChange={(e) => setField("active", e.target.checked)} />
              <span>Aktiv</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.hidden} onChange={(e) => setField("hidden", e.target.checked)} />
              <span>Versteckt (erst nach Unlock sichtbar)</span>
            </label>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <h2 className="font-semibold text-primary">Titel & Beschreibung</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {(["de", "en"] as const).map((lang) => (
            <div key={lang} className="space-y-2">
              <label className="text-sm space-y-1 block">
                <span className="text-secondary">Titel ({lang.toUpperCase()})</span>
                <Input
                  value={form.titles[lang] ?? ""}
                  onChange={(e) => setTitle(lang, e.target.value)}
                  placeholder={lang === "de" ? "z.B. Packöffner" : "e.g. Pack Opener"}
                />
              </label>
              <label className="text-sm space-y-1 block">
                <span className="text-secondary">Beschreibung ({lang.toUpperCase()})</span>
                <textarea
                  className="w-full rounded border border-border bg-surface p-2 text-primary text-sm"
                  rows={3}
                  value={form.descriptions[lang] ?? ""}
                  onChange={(e) => setDescription(lang, e.target.value)}
                />
              </label>
            </div>
          ))}
        </div>
        {errors.titles && <div className="text-red-500 text-xs">{errors.titles}</div>}
      </Card>

      <Card className="p-4 space-y-4">
        <h2 className="font-semibold text-primary">Icon</h2>
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 rounded bg-surface border border-border grid place-items-center overflow-hidden">
            {iconPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={iconPreview} alt="" className="w-full h-full object-contain" />
            ) : (
              <span className="text-xs text-secondary text-center px-2">kein Icon</span>
            )}
          </div>
          <input
            ref={iconInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => setField("iconFile", e.target.files?.[0] ?? null)}
          />
          <Button variant="secondary" onClick={() => iconInput.current?.click()}>
            Icon hochladen
          </Button>
          {form.iconFile && (
            <Button variant="secondary" size="sm" onClick={() => setField("iconFile", null)}>
              Auswahl löschen
            </Button>
          )}
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <h2 className="font-semibold text-primary">Trigger</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="text-sm space-y-1">
            <span className="text-secondary">Typ</span>
            <select
              className="w-full rounded border border-border bg-surface p-2 text-primary"
              value={form.trigger.type}
              onChange={(e) => changeTriggerType(e.target.value as TriggerType)}
            >
              <option value="level">Level erreicht</option>
              <option value="counter">Zähler-basiert</option>
              <option value="once">Einmal-Event</option>
              <option value="manual">Manuell (nur Admin)</option>
            </select>
          </label>
          {form.trigger.type === "level" && (
            <label className="text-sm space-y-1">
              <span className="text-secondary">Level (1-100)</span>
              <Input
                type="number"
                value={String(form.trigger.params.level ?? "")}
                onChange={(e) => setTriggerParam("level", Number(e.target.value))}
              />
            </label>
          )}
          {form.trigger.type === "counter" && (
            <>
              <label className="text-sm space-y-1">
                <span className="text-secondary">Metrik</span>
                <select
                  className="w-full rounded border border-border bg-surface p-2 text-primary"
                  value={String(form.trigger.params.metric ?? "")}
                  onChange={(e) => setTriggerParam("metric", e.target.value)}
                >
                  <option value="">— auswählen —</option>
                  {(Object.keys(METRIC_LABEL) as CounterMetric[]).map((m) => (
                    <option key={m} value={m}>{METRIC_LABEL[m]}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm space-y-1">
                <span className="text-secondary">Ziel (≥1)</span>
                <Input
                  type="number"
                  value={String(form.trigger.params.target ?? "")}
                  onChange={(e) => setTriggerParam("target", Number(e.target.value))}
                />
              </label>
            </>
          )}
          {form.trigger.type === "once" && (
            <label className="text-sm space-y-1">
              <span className="text-secondary">Event</span>
              <select
                className="w-full rounded border border-border bg-surface p-2 text-primary"
                value={String(form.trigger.params.event ?? "")}
                onChange={(e) => setTriggerParam("event", e.target.value)}
              >
                <option value="">— auswählen —</option>
                {(Object.keys(ONCE_LABEL) as OnceEvent[]).map((e) => (
                  <option key={e} value={e}>{ONCE_LABEL[e]}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        {errors.trigger && <div className="text-red-500 text-xs">{errors.trigger}</div>}
      </Card>

      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-primary">Belohnungen</h2>
          <Button variant="secondary" size="sm" onClick={addReward}>
            <Plus className="h-4 w-4 mr-1" /> Reward hinzufügen
          </Button>
        </div>
        {form.rewards.length === 0 ? (
          <div className="text-sm text-secondary">Noch keine Belohnungen. Achievements ohne Reward sind reiner Prestige-Bonus.</div>
        ) : (
          <div className="space-y-3">
            {form.rewards.map((r, i) => (
              <div key={i} className="rounded border border-border p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <select
                    className="rounded border border-border bg-surface p-2 text-primary text-sm"
                    value={r.type}
                    onChange={(e) =>
                      updateReward(i, { type: e.target.value as RewardType, params: {} })
                    }
                  >
                    {(Object.keys(REWARD_LABEL) as RewardType[]).map((rt) => (
                      <option key={rt} value={rt}>{REWARD_LABEL[rt]}</option>
                    ))}
                  </select>
                  <Button variant="secondary" size="sm" onClick={() => removeReward(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <RewardFields
                  reward={r}
                  onChange={(params) => updateReward(i, { ...r, params })}
                />
                {errors[`reward${i}`] && (
                  <div className="text-red-500 text-xs">{errors[`reward${i}`]}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function RewardFields({
  reward,
  onChange,
}: {
  reward: { type: RewardType; params: Record<string, unknown> };
  onChange: (params: Record<string, unknown>) => void;
}) {
  const p = reward.params;
  const set = (k: string, v: unknown) => onChange({ ...p, [k]: v });

  if (reward.type === "coins") {
    return (
      <label className="text-sm space-y-1 block">
        <span className="text-secondary">Coin-Betrag</span>
        <Input type="number" value={String(p.amount ?? "")} onChange={(e) => set("amount", Number(e.target.value))} />
      </label>
    );
  }
  if (reward.type === "convert_multiplier") {
    return (
      <label className="text-sm space-y-1 block">
        <span className="text-secondary">Multiplikator (z.B. 1.1 für +10%)</span>
        <Input type="number" step="0.01" value={String(p.multiplier ?? "")} onChange={(e) => set("multiplier", Number(e.target.value))} />
      </label>
    );
  }
  if (reward.type === "unlock_box") {
    return (
      <label className="text-sm space-y-1 block">
        <span className="text-secondary">Box-Slug</span>
        <Input value={String(p.boxSlug ?? "")} onChange={(e) => set("boxSlug", e.target.value)} placeholder="z.B. premium-ancient" />
      </label>
    );
  }
  if (reward.type === "cosmetic") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm space-y-1">
          <span className="text-secondary">Slot</span>
          <select
            className="w-full rounded border border-border bg-surface p-2 text-primary"
            value={String(p.slot ?? "")}
            onChange={(e) => set("slot", e.target.value)}
          >
            <option value="">— auswählen —</option>
            <option value="title">Titel</option>
            <option value="frame">Avatar-Rahmen</option>
            <option value="chat_color">Chat-Farbe</option>
          </select>
        </label>
        <label className="text-sm space-y-1">
          <span className="text-secondary">Wert</span>
          <Input value={String(p.value ?? "")} onChange={(e) => set("value", e.target.value)} placeholder="z.B. PACKATTACK Veteran" />
        </label>
      </div>
    );
  }
  // grant_badge
  return (
    <label className="text-sm space-y-1 block">
      <span className="text-secondary">Badge-Schlüssel</span>
      <Input value={String(p.badgeKey ?? "")} onChange={(e) => set("badgeKey", e.target.value)} placeholder="z.B. beta_tester" />
    </label>
  );
}

interface UserSearchResult {
  _id: string;
  username: string | null;
  name: string | null;
  email: string | null;
  image: string | null;
  level: number;
}

function ManualGrantDialog({
  achievement,
  onClose,
}: {
  achievement: Achievement;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [selected, setSelected] = useState<UserSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  // Debounced search
  useEffect(() => {
    if (selected || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        setResults(Array.isArray(data.users) ? data.users : []);
      } catch {
        /* aborted or network error */
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, selected]);

  const pick = (u: UserSearchResult) => {
    setSelected(u);
    setQuery(u.username ?? u.email ?? u._id);
    setResults([]);
  };

  const clearSelection = () => {
    setSelected(null);
    setQuery("");
  };

  const submit = async () => {
    if (!selected) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/achievements/${achievement._id}/grant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selected._id, note: note.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          setResult(
            `Rate-Limit: max. ${data.limit ?? 30} Grants pro Minute. Bitte ${data.retryAfterSeconds ?? 60}s warten.`,
          );
        } else {
          setResult(`Fehler: ${data.error ?? "unbekannt"}`);
        }
      } else if (data.wasNewUnlock) {
        setResult(`Achievement an ${selected.username ?? selected.email ?? "User"} verliehen.`);
      } else {
        setResult(`${selected.username ?? "Der User"} hatte das Achievement bereits.`);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-background border border-border rounded max-w-md w-full p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-primary">Achievement manuell verleihen</h3>
        <p className="text-xs text-secondary">
          {achievement.key} · {achievement.trigger.type}
        </p>

        <div className="relative">
          <label className="text-sm space-y-1 block">
            <span className="text-secondary">User suchen (Username, Name oder E-Mail)</span>
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (selected) setSelected(null);
                }}
                placeholder="z.B. jaja"
              />
              {selected && (
                <Button variant="secondary" size="sm" onClick={clearSelection}>
                  Ändern
                </Button>
              )}
            </div>
          </label>
          {!selected && results.length > 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-background border border-border rounded shadow max-h-64 overflow-y-auto">
              {results.map((u) => (
                <button
                  key={u._id}
                  type="button"
                  className="flex items-center gap-2 w-full px-2 py-2 hover:bg-surface text-left"
                  onClick={() => pick(u)}
                >
                  {u.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.image} alt="" className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-surface" />
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="text-sm text-primary block truncate">
                      {u.username ?? u.name ?? "(ohne Name)"}
                    </span>
                    <span className="text-xs text-secondary block truncate">{u.email}</span>
                  </span>
                  <span className="text-xs text-secondary">Lvl {u.level}</span>
                </button>
              ))}
            </div>
          )}
          {!selected && !searching && query.trim().length >= 2 && results.length === 0 && (
            <div className="text-xs text-secondary mt-1">Keine Treffer.</div>
          )}
          {selected && (
            <div className="text-xs text-secondary mt-1">
              Ausgewählt: {selected.username ?? selected.email} (Lvl {selected.level})
            </div>
          )}
        </div>

        <label className="text-sm space-y-1 block">
          <span className="text-secondary">Notiz (optional)</span>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Kontext / Grund" />
        </label>
        {result && <div className="text-sm text-secondary">{result}</div>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={sending}>Schließen</Button>
          <Button onClick={submit} disabled={sending || !selected}>
            {sending ? "Sende…" : "Verleihen"}
          </Button>
        </div>
      </div>
    </div>
  );
}
