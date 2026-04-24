"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LevelWidget } from "@/components/dashboard/level-widget";
import { Trophy, Lock, Sparkles } from "lucide-react";

type Category = "level" | "progression" | "battle" | "economy" | "social" | "event";

interface AchievementItem {
  _id: string;
  key: string;
  category: Category;
  iconImageId: string | null;
  titles: Record<string, string>;
  descriptions: Record<string, string>;
  trigger: { type: string; params: Record<string, unknown> };
  hasRewards: boolean;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: number;
  target: number | null;
}

const CATEGORY_LABEL: Record<Category, string> = {
  level: "Level",
  progression: "Fortschritt",
  battle: "Battle",
  economy: "Ökonomie",
  social: "Social",
  event: "Event",
};

function pickText(map: Record<string, string>, lang: string, fallback: string): string {
  return map[lang] ?? map.de ?? map.en ?? fallback;
}

export function AchievementsTab({ lang }: { lang: string }) {
  const [items, setItems] = useState<AchievementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Category | "all" | "unlocked" | "locked">("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me/achievements", { cache: "no-store" });
        if (!res.ok) throw new Error("load_failed");
        const data = await res.json();
        if (!cancelled) setItems(Array.isArray(data.achievements) ? data.achievements : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const unlocked = items.filter((i) => i.unlocked).length;
    return { unlocked, total: items.length };
  }, [items]);

  const visible = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "unlocked") return items.filter((i) => i.unlocked);
    if (filter === "locked") return items.filter((i) => !i.unlocked);
    return items.filter((i) => i.category === filter);
  }, [items, filter]);

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <LevelWidget />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Achievements</h1>
          <p className="text-sm text-secondary">
            {stats.unlocked} / {stats.total} freigeschaltet
          </p>
        </div>
        <select
          className="rounded border border-border bg-surface p-2 text-primary text-sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
        >
          <option value="all">Alle</option>
          <option value="unlocked">Freigeschaltet</option>
          <option value="locked">Gesperrt</option>
          <optgroup label="Kategorien">
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
              <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
            ))}
          </optgroup>
        </select>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-secondary">Laden…</Card>
      ) : visible.length === 0 ? (
        <Card className="p-8 text-center text-secondary">
          In dieser Kategorie gibt es noch nichts zu sehen.
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map((a) => (
            <AchievementCard key={a._id} item={a} lang={lang} />
          ))}
        </div>
      )}
    </div>
  );
}

function AchievementCard({ item, lang }: { item: AchievementItem; lang: string }) {
  const title = pickText(item.titles, lang, item.key);
  const description = pickText(item.descriptions, lang, "");
  const progressPct =
    item.target && item.target > 0
      ? Math.min(1, Math.max(0, item.progress / item.target)) * 100
      : item.unlocked
        ? 100
        : 0;

  return (
    <Card className={`p-4 space-y-3 ${item.unlocked ? "" : "opacity-80"}`}>
      <div className="flex items-start gap-3">
        <div
          className={`flex-none w-14 h-14 rounded grid place-items-center overflow-hidden ${
            item.unlocked ? "bg-pa-green/10" : "bg-surface"
          } border border-border`}
        >
          {item.iconImageId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/achievements/images/${item.iconImageId}`}
              alt=""
              className={`w-full h-full object-contain ${item.unlocked ? "" : "grayscale"}`}
            />
          ) : item.unlocked ? (
            <Trophy className="h-6 w-6 text-pa-green" />
          ) : (
            <Lock className="h-5 w-5 text-secondary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-primary truncate">{title}</span>
            {item.unlocked && <Sparkles className="h-4 w-4 text-pa-green" />}
          </div>
          {description && <p className="text-sm text-secondary mt-0.5">{description}</p>}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Badge variant="info">{CATEGORY_LABEL[item.category] ?? item.category}</Badge>
        {item.hasRewards && <Badge variant="success">Reward</Badge>}
        {item.unlocked ? (
          <span className="text-xs text-secondary ml-auto">
            {item.unlockedAt
              ? new Date(item.unlockedAt).toLocaleDateString("de-DE")
              : ""}
          </span>
        ) : (
          item.target && (
            <span className="text-xs text-secondary ml-auto">
              {item.progress} / {item.target}
            </span>
          )
        )}
      </div>

      {!item.unlocked && item.target != null && (
        <div className="relative h-1.5 rounded-full bg-surface overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-pa-green transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}
    </Card>
  );
}
