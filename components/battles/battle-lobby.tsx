"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Users } from "lucide-react";
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
  ready: boolean;
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
  const [readying, setReadying] = useState(false);
  const [readyTimer, setReadyTimer] = useState<number | null>(null);
  const { data: session } = useSession();
  const currentUserId = (session?.user as { id?: string } | undefined)?.id;

  const filledSlots = battle.players;
  const emptyCount = Math.max(0, battle.maxPlayers - filledSlots.length);
  const isFull = filledSlots.length >= battle.maxPlayers;
  const isCountdown = battle.status === "countdown";
  const isReadyCheck = battle.status === "ready_check";

  const boxName =
    battle.box.name[lang] ??
    battle.box.name["en"] ??
    battle.box.name["de"] ??
    Object.values(battle.box.name)[0] ??
    "—";

  // Start visual countdown when status switches to countdown
  useEffect(() => {
    if (!isCountdown || countdown !== null) return;
    setCountdown(3);
    const iv = setInterval(() => {
      setCountdown((c) => {
        if (c === null || c <= 1) { clearInterval(iv); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [isCountdown]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ready-check countdown timer
  useEffect(() => {
    if (!isReadyCheck) {
      setReadyTimer(null);
      return;
    }
    setReadyTimer(30);
    const iv = setInterval(() => {
      setReadyTimer((t) => {
        if (t === null || t <= 1) { clearInterval(iv); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [isReadyCheck]);

  async function handleJoin() {
    setJoining(true);
    setActionError("");
    try {
      const res = await fetch(`/api/battles/${battle._id}/join`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || dict["joinError"] || "Beitreten fehlgeschlagen.");
      } else {
        onJoin();
      }
    } catch {
      setActionError(dict["error_generic"] || "Ein Fehler ist aufgetreten.");
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
        setActionError(data.error || dict["leaveError"] || "Verlassen fehlgeschlagen.");
      } else {
        onLeave();
      }
    } catch {
      setActionError(dict["error_generic"] || "Ein Fehler ist aufgetreten.");
    } finally {
      setLeaving(false);
    }
  }

  async function handleReady() {
    setReadying(true);
    setActionError("");
    try {
      const res = await fetch(`/api/battles/${battle._id}/ready`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || dict["readyError"] || "Ready fehlgeschlagen.");
      }
    } catch {
      setActionError(dict["error_generic"] || "Ein Fehler ist aufgetreten.");
    } finally {
      setReadying(false);
    }
  }

  return (
    <div className="relative space-y-6">
      {/* Ready-check overlay */}
      {isReadyCheck && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-[14px] bg-bg/90 backdrop-blur-sm">
          <p className="text-sm font-medium text-text-secondary">
            {dict["readyCheckTitle"] ?? "Bist du bereit?"}
          </p>
          <span className="text-6xl font-extrabold tabular-nums text-pa-green animate-pulse">
            {readyTimer ?? 30}
          </span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {battle.players.map((p) => (
              <div
                key={p.user._id}
                className={[
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all",
                  p.ready
                    ? "bg-pa-green/20 text-pa-green border border-pa-green/40"
                    : "bg-surface text-text-secondary border border-border",
                ].join(" ")}
              >
                {p.ready ? "✓" : "…"} {p.user.username ?? p.user.name}
              </div>
            ))}
          </div>
          {isPlayer && !battle.players.find((p) => p.user._id === currentUserId)?.ready && (
            <Button
              variant="accent"
              size="lg"
              loading={readying}
              onClick={handleReady}
            >
              {dict["ready"] ?? "Ready!"}
            </Button>
          )}
        </div>
      )}

      {/* Countdown overlay (3-2-1 after all ready) */}
      {isCountdown && countdown !== null && countdown > 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[14px] bg-bg/90 backdrop-blur-sm">
          <p className="mb-2 text-sm font-medium text-text-secondary">
            {dict["battleStarting"] ?? "Battle startet in..."}
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
          {battle.packsPerPlayer} {dict["packsLabel"] ?? "Packs"} · {battle.visibility === "public" ? (dict["public"] ?? "Öffentlich") : (dict["private"] ?? "Privat")}
        </p>
      </div>

      {/* Player grid */}
      <div>
        <p className="mb-3 text-sm font-medium text-text-secondary">
          {dict["players"] ?? "Spieler"} ({filledSlots.length}/{battle.maxPlayers})
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
                    {rank.emoji} {rank.label[lang as "de" | "en"] ?? rank.label.de}
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
              <p className="text-xs text-text-secondary">{dict["emptySlot"] ?? "Leer"}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      {!isReadyCheck && !isCountdown && (
        <div className="flex flex-wrap items-center gap-3">
          {isPlayer ? (
            <Button variant="danger" size="md" loading={leaving} onClick={handleLeave}>
              {dict["leaveBattle"] ?? "Verlassen"}
            </Button>
          ) : (
            <Button
              variant="accent"
              size="md"
              loading={joining}
              disabled={isFull || joining}
              onClick={handleJoin}
            >
              {isFull ? (dict["battleFull"] ?? "Voll") : (dict["join"] ?? "Beitreten")}
            </Button>
          )}
        </div>
      )}

      {actionError && (
        <p className="rounded-[10px] border border-red-500/20 bg-red-500/8 px-4 py-2 text-sm text-red-400">
          {actionError}
        </p>
      )}
    </div>
  );
}
