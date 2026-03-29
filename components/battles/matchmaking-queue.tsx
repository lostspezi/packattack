"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface QueueStat {
  boxId: string;
  boxName: Record<string, string>;
  boxImage?: string;
  boxSlug: string;
  counts: Record<string, number>;
}

interface MatchmakingQueueProps {
  lang: string;
  dict: Record<string, string>;
}

export function MatchmakingQueue({ lang, dict }: MatchmakingQueueProps) {
  const router = useRouter();
  const [stats, setStats] = useState<QueueStat[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedBox, setSelectedBox] = useState<string | null>(null);
  const [selectedCount, setSelectedCount] = useState<number>(2);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [joining, setJoining] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/battles/queue/stats");
      const data = await res.json();
      setStats(data.stats ?? []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const iv = setInterval(fetchStats, 10_000);
    return () => clearInterval(iv);
  }, [fetchStats]);

  useEffect(() => {
    if (!searching) {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    setWaitSeconds(0);
    timerRef.current = setInterval(() => {
      setWaitSeconds((s) => s + 1);
    }, 1000);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/battles/queue/status");
        const data = await res.json();
        if (data.matched && data.battle?.slug) {
          setSearching(false);
          router.push(`/${lang}/battles/${data.battle.slug}`);
        } else if (!data.inQueue && !data.matched) {
          setSearching(false);
        }
      } catch {
        // ignore
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [searching, lang, router]);

  async function handleJoinQueue() {
    if (!selectedBox) return;
    setJoining(true);
    try {
      const res = await fetch("/api/battles/queue/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boxId: selectedBox, playerCount: selectedCount }),
      });
      const data = await res.json();
      if (res.ok && data.queued) {
        if (data.matched) {
          const statusRes = await fetch("/api/battles/queue/status");
          const statusData = await statusRes.json();
          if (statusData.matched && statusData.battle?.slug) {
            router.push(`/${lang}/battles/${statusData.battle.slug}`);
            return;
          }
        }
        setSearching(true);
      }
    } catch {
      // ignore
    } finally {
      setJoining(false);
    }
  }

  async function handleLeaveQueue() {
    try {
      await fetch("/api/battles/queue/leave", { method: "DELETE" });
    } catch {
      // ignore
    }
    setSearching(false);
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (searching) {
    return (
      <Card variant="soft" className="flex flex-col items-center gap-6 p-8">
        <Loader2 className="h-12 w-12 animate-spin text-pa-green" />
        <div className="text-center">
          <h3 className="text-lg font-bold text-text-primary">
            {dict["searchingForBattle"] ?? "Suche Battle..."}
          </h3>
          <p className="mt-1 text-3xl font-black tabular-nums text-pa-green">
            {formatTime(waitSeconds)}
          </p>
          <p className="mt-2 text-xs text-text-secondary">
            {dict["queueExpandInfo"] ?? "Elo-Range erweitert sich über Zeit"}
          </p>
        </div>
        <Button variant="danger" size="md" onClick={handleLeaveQueue}>
          <X className="mr-2 h-4 w-4" />
          {dict["cancelSearch"] ?? "Abbrechen"}
        </Button>
      </Card>
    );
  }

  const totalWaiting = stats.reduce(
    (sum, s) => sum + Object.values(s.counts).reduce((a, b) => a + b, 0),
    0,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-text-primary">
          <Search className="mr-2 inline h-5 w-5" />
          {dict["matchmaking"] ?? "Matchmaking"}
        </h3>
        {totalWaiting > 0 && (
          <span className="text-sm text-text-secondary">
            {totalWaiting} {dict["playersSearching"] ?? "Spieler suchen"}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-text-secondary">{dict["playerCount"] ?? "Spieleranzahl"}:</span>
        {[2, 3, 4].map((count) => (
          <button
            key={count}
            onClick={() => setSelectedCount(count)}
            className={[
              "flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              selectedCount === count
                ? "bg-pa-green/20 text-pa-green border border-pa-green/30"
                : "bg-white/5 text-text-secondary border border-white/10 hover:bg-white/10",
            ].join(" ")}
          >
            <Users className="h-3.5 w-3.5" />
            {count}
          </button>
        ))}
      </div>

      {stats.length === 0 && (
        <p className="text-sm text-text-secondary">
          {dict["noBoxesAvailable"] ?? "Keine Boxen verfügbar."}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => {
          const boxName = stat.boxName[lang] ?? stat.boxName["en"] ?? stat.boxName["de"] ?? "—";
          const waitingForCount = stat.counts[String(selectedCount)] ?? 0;
          const isSelected = selectedBox === stat.boxId;

          return (
            <button
              key={stat.boxId}
              onClick={() => setSelectedBox(stat.boxId)}
              className={[
                "flex items-center gap-3 rounded-[14px] p-3 text-left transition-all",
                isSelected
                  ? "bg-pa-green/10 border-2 border-pa-green/40"
                  : "bg-white/3 border-2 border-transparent hover:bg-white/5",
              ].join(" ")}
            >
              {stat.boxImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={stat.boxImage}
                  alt={boxName}
                  className="h-12 w-12 rounded-lg object-cover shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text-primary">{boxName}</p>
                {waitingForCount > 0 ? (
                  <p className="text-xs text-pa-green font-medium">
                    {waitingForCount} {dict["waiting"] ?? "warten"}
                  </p>
                ) : (
                  <p className="text-xs text-text-secondary">
                    {dict["noPlayersWaiting"] ?? "Keine Spieler"}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <Button
        variant="accent"
        size="lg"
        disabled={!selectedBox || joining}
        loading={joining}
        onClick={handleJoinQueue}
        className="w-full"
      >
        <Search className="mr-2 h-5 w-5" />
        {dict["searchBattle"] ?? "Battle suchen"}
      </Button>
    </div>
  );
}
