"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { LevelChip } from "@/components/user/level-chip";
import { Trophy } from "lucide-react";

interface LevelData {
  level: number;
  maxLevel: number;
  xp: number;
  xpIntoLevel: number;
  xpForLevelUp: number;
  xpToNextLevel: number;
  progress: number;
}

/**
 * Kleines Dashboard-Widget, das aktuelles Level und XP-Balken zeigt.
 * Pollt nicht aktiv — holt den Stand einmal beim Mount. Nach einem
 * Level-Up blendet LevelUpModal das Ereignis prominent ein, das Widget
 * wird beim nächsten Seitenwechsel aktualisiert.
 */
export function LevelWidget() {
  const [data, setData] = useState<LevelData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me/level", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as LevelData;
        if (!cancelled) setData(json);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Card className="p-4">
        <div className="h-16 animate-pulse rounded bg-surface" />
      </Card>
    );
  }

  if (!data) return null;

  const progressPct = Math.round(Math.min(1, Math.max(0, data.progress)) * 100);
  const isMax = data.level >= data.maxLevel;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-10 w-10 rounded-full bg-pa-green/20 grid place-items-center">
          <Trophy className="h-5 w-5 text-pa-green" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-primary">Dein Level</span>
            <LevelChip level={data.level} />
          </div>
          <div className="text-xs text-secondary">
            {isMax
              ? "Maximales Level erreicht"
              : `Noch ${data.xpToNextLevel.toLocaleString("de-DE")} XP bis Level ${data.level + 1}`}
          </div>
        </div>
      </div>
      <div className="relative h-2.5 w-full rounded-full bg-surface overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-pa-green transition-all duration-500"
          style={{ width: `${isMax ? 100 : progressPct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-secondary mt-2">
        <span>{data.xpIntoLevel.toLocaleString("de-DE")} XP</span>
        <span>{isMax ? "—" : `${data.xpForLevelUp.toLocaleString("de-DE")} XP`}</span>
      </div>
    </Card>
  );
}
