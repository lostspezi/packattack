"use client";

import { useState, useEffect } from "react";
import { Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ELO_RANKS } from "@/lib/battle-constants";

interface BattlePlayer {
  user: {
    _id: string;
    name: string;
    username?: string;
    image?: string;
    elo: number;
  };
  score: number;
  placement: number | null;
  eloChange: number | null;
  eloAtStart: number;
}

interface Battle {
  _id: string;
  slug: string;
  status: string;
  maxPlayers: number;
  packsPerPlayer: number;
  players: BattlePlayer[];
  box: { name: Record<string, string>; image?: string };
  visibility: string;
}

interface BattleLobbyProps {
  battle: Battle;
  dict: Record<string, string>;
  lang: string;
  isPlayer: boolean;
  onJoin: () => void;
  onLeave: () => void;
}

function getEloRank(elo: number): typeof ELO_RANKS[number] {
  let rank: typeof ELO_RANKS[number] = ELO_RANKS[0];
  for (const r of ELO_RANKS) {
    if (elo >= r.minElo) rank = r;
  }
  return rank;
}

export function BattleLobby({ battle, dict, lang, isPlayer, onJoin, onLeave }: BattleLobbyProps) {
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);

  const filledSlots = battle.players;
  const emptyCount = Math.max(0, battle.maxPlayers - filledSlots.length);
  const isFull = filledSlots.length >= battle.maxPlayers;
  const isCountdown = battle.status === "countdown";

  const boxName =
    battle.box.name[lang] ??
    battle.box.name["en"] ??
    battle.box.name["de"] ??
    Object.values(battle.box.name)[0] ??
    "—";

  // Start visual countdown when status switches to countdown
  useEffect(() => {
    if (!isCountdown || countdown !== null) return;
    setCountdown(5);
    const iv = setInterval(() => {
      setCountdown((c) => {
        if (c === null || c <= 1) { clearInterval(iv); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [isCountdown]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleJoin() {
    setJoining(true);
    setActionError("");
    try {
      const res = await fetch(`/api/battles/${battle._id}/join`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || dict.joinError || "Failed to join.");
      } else {
        onJoin();
      }
    } catch {
      setActionError(dict.error_generic || "An error occurred.");
    } finally {
      setJoining(false);
    }
  }

  async function handleLeave() {
    setLeaving(true);
    setActionError("");
    try {
      const res = await fetch(`/api/battles/${battle._id}/leave`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || dict.leaveError || "Failed to leave.");
      } else {
        onLeave();
      }
    } catch {
      setActionError(dict.error_generic || "An error occurred.");
    } finally {
      setLeaving(false);
    }
  }

  return (
    <div className="relative space-y-6">
      {/* Countdown overlay */}
      {isCountdown && countdown !== null && countdown > 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[14px] bg-bg/90 backdrop-blur-sm">
          <p className="mb-2 text-sm font-medium text-text-secondary">
            {dict.battleStarting || "Battle starting in..."}
          </p>
          <span className="text-8xl font-extrabold text-pa-green tabular-nums animate-pulse">
            {countdown}
          </span>
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-text-primary">{boxName}</h2>
        <p className="mt-1 text-sm text-text-secondary">
          {battle.packsPerPlayer} {dict.packsLabel || "packs"} · {battle.visibility}
        </p>
      </div>

      {/* Player grid */}
      <div>
        <p className="mb-3 text-sm font-medium text-text-secondary">
          {dict.players || "Players"} ({filledSlots.length}/{battle.maxPlayers})
        </p>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filledSlots.map((p) => {
            const rank = getEloRank(p.eloAtStart);
            return (
              <Card key={p.user._id} variant="soft" className="flex items-center gap-3 p-3">
                {p.user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.user.image}
                    alt={p.user.name}
                    className="h-10 w-10 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pa-lila/30">
                    <Users className="h-5 w-5 text-text-secondary" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-primary">
                    {p.user.username ?? p.user.name}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {rank.emoji} {rank.label["en"]}
                  </p>
                </div>
              </Card>
            );
          })}

          {/* Empty slots */}
          {Array.from({ length: emptyCount }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="flex h-16 items-center justify-center rounded-[14px] border border-dashed border-border"
            >
              <p className="text-xs text-text-secondary">{dict.emptySlot || "Empty"}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        {isPlayer ? (
          <Button variant="danger" size="md" loading={leaving} onClick={handleLeave}>
            {dict.leaveBattle || "Leave"}
          </Button>
        ) : (
          <Button
            variant="accent"
            size="md"
            loading={joining}
            disabled={isFull || joining}
            onClick={handleJoin}
          >
            {isFull ? (dict.battleFull || "Full") : (dict.join || "Join")}
          </Button>
        )}
      </div>

      {actionError && (
        <p className="rounded-[10px] border border-red-500/20 bg-red-500/8 px-4 py-2 text-sm text-red-400">
          {actionError}
        </p>
      )}
    </div>
  );
}
