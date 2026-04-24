"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LevelChip } from "@/components/user/level-chip";
import { Trophy, Sparkles, ArrowRight, Target } from "lucide-react";
import { useMe } from "@/components/layout/me-provider";

interface SummaryAchievement {
  _id: string;
  key: string;
  titles: Record<string, string>;
  descriptions: Record<string, string>;
  iconImageId: string | null;
  progress: number;
  target: number | null;
  unlockedAt: string | null;
}

interface SummaryData {
  level: number;
  maxLevel: number;
  xp: number;
  xpIntoLevel: number;
  xpForLevelUp: number;
  xpToNextLevel: number;
  progress: number;
  recent: SummaryAchievement[];
  next: SummaryAchievement | null;
  unlockedCount: number;
  totalCount: number;
}

function pickText(map: Record<string, string>, lang: string, fallback: string): string {
  return map[lang] ?? map.de ?? map.en ?? fallback;
}

export function DashboardProgressionCard({ lang }: { lang: string }) {
  const me = useMe();
  const active = me?.levelSystemActive === true;
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!active) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me/achievements/summary", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as SummaryData;
        if (!cancelled) setData(json);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active]);

  // Solange das Level-System nicht scharf geschaltet ist (kein Achievement
  // existiert), bleibt die Kachel komplett unsichtbar.
  if (!active) return null;

  if (loading) {
    return (
      <Card className="p-5">
        <div className="h-40 animate-pulse rounded bg-surface" />
      </Card>
    );
  }

  if (!data) return null;

  const progressPct = Math.round(Math.min(1, Math.max(0, data.progress)) * 100);
  const isMax = data.level >= data.maxLevel;
  const nextProgressPct =
    data.next?.target && data.next.target > 0
      ? Math.min(100, Math.round((data.next.progress / data.next.target) * 100))
      : 0;

  return (
    <Card className="p-5 space-y-5">
      {/* Header: Level + XP-Bar */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-pa-green/20 grid place-items-center">
            <Trophy className="h-6 w-6 text-pa-green" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-text-primary">Dein Fortschritt</h3>
              <LevelChip level={data.level} />
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              {data.unlockedCount} / {data.totalCount} Achievements freigeschaltet
            </p>
          </div>
        </div>
        <Link href={`/${lang}/profile/achievements`}>
          <Button variant="secondary" size="sm">
            Alle Achievements
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </Link>
      </div>

      {/* XP-Bar */}
      <div>
        <div className="flex justify-between text-xs text-text-muted mb-1.5">
          <span>Level {data.level}</span>
          <span>
            {isMax
              ? "Max erreicht"
              : `${data.xpToNextLevel.toLocaleString("de-DE")} XP bis Level ${data.level + 1}`}
          </span>
        </div>
        <div className="relative h-2 w-full rounded-full bg-surface overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-pa-green transition-all duration-500"
            style={{ width: `${isMax ? 100 : progressPct}%` }}
          />
        </div>
      </div>

      {/* Zuletzt freigeschaltet */}
      {data.recent.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-pa-green" />
            <span className="text-sm font-semibold text-text-primary">Zuletzt freigeschaltet</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.recent.map((a) => (
              <AchievementMiniCard key={a._id} achievement={a} lang={lang} unlocked />
            ))}
          </div>
        </div>
      )}

      {/* Nächstes */}
      {data.next && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-text-muted" />
            <span className="text-sm font-semibold text-text-primary">Nächstes Ziel</span>
          </div>
          <div className="rounded border border-border p-3 flex items-start gap-3">
            <div className="flex-none w-10 h-10 rounded grid place-items-center bg-surface overflow-hidden">
              {data.next.iconImageId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/achievements/images/${data.next.iconImageId}`}
                  alt=""
                  className="w-full h-full object-contain grayscale"
                />
              ) : (
                <Target className="h-5 w-5 text-text-muted" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {pickText(data.next.titles, lang, data.next.key)}
              </p>
              <p className="text-xs text-text-muted mt-0.5 line-clamp-2">
                {pickText(data.next.descriptions, lang, "")}
              </p>
              {data.next.target && data.next.target > 0 && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-text-muted mb-1">
                    <span>
                      {data.next.progress} / {data.next.target}
                    </span>
                    <span>{nextProgressPct} %</span>
                  </div>
                  <div className="relative h-1.5 w-full rounded-full bg-surface overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-pa-green/70"
                      style={{ width: `${nextProgressPct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function AchievementMiniCard({
  achievement,
  lang,
  unlocked,
}: {
  achievement: SummaryAchievement;
  lang: string;
  unlocked?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded border border-border p-2">
      <div
        className={`flex-none w-8 h-8 rounded grid place-items-center overflow-hidden ${
          unlocked ? "bg-pa-green/10" : "bg-surface"
        }`}
      >
        {achievement.iconImageId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/achievements/images/${achievement.iconImageId}`}
            alt=""
            className="w-full h-full object-contain"
          />
        ) : (
          <Trophy className={`h-4 w-4 ${unlocked ? "text-pa-green" : "text-text-muted"}`} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-text-primary truncate">
          {pickText(achievement.titles, lang, achievement.key)}
        </p>
        {achievement.unlockedAt && (
          <p className="text-[10px] text-text-muted">
            {new Date(achievement.unlockedAt).toLocaleDateString("de-DE")}
          </p>
        )}
      </div>
    </div>
  );
}
