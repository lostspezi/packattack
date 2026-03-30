"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { Users, Swords, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getEloRank, getEloDivision } from "@/lib/battle-elo";

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
  eloRange?: { min: number; max: number } | null;
}

interface BattleLobbyProps {
  battle: Battle;
  dict: Record<string, string>;
  lang: string;
  isPlayer: boolean;
  onJoin: () => void;
  onLeave: () => void;
}

/* ------------------------------------------------------------------ */
/*  Fullscreen Ready-Check Overlay                                     */
/* ------------------------------------------------------------------ */

function useReadySound(timer: number | null) {
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playBeep = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // Audio not supported
    }
  }, []);

  useEffect(() => {
    if (timer === null) return;
    // Play sound at 30, 20, 10, 5, 4, 3, 2, 1
    if (timer === 30 || timer === 20 || timer === 10 || (timer <= 5 && timer > 0)) {
      playBeep();
    }
  }, [timer, playBeep]);
}

interface ReadyCheckOverlayProps {
  battle: {
    players: BattlePlayer[];
  };
  dict: Record<string, string>;
  readyTimer: number | null;
  isPlayer: boolean;
  currentUserId: string | undefined;
  readying: boolean;
  onReady: () => void;
}

function ReadyCheckOverlay({
  battle,
  dict,
  readyTimer,
  isPlayer,
  currentUserId,
  readying,
  onReady,
}: ReadyCheckOverlayProps) {
  useReadySound(readyTimer);

  const timer = readyTimer ?? 30;
  const readyCount = battle.players.filter((p) => p.ready).length;
  const totalCount = battle.players.length;
  const allReady = readyCount === totalCount;
  const meReady = battle.players.find((p) => p.user._id === currentUserId)?.ready ?? false;
  const isUrgent = timer <= 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/98">
      {/* Subtle pulsing glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className={[
            "h-[300px] w-[300px] rounded-full opacity-10 animate-pulse",
            isUrgent ? "bg-red-500" : "bg-pa-green",
          ].join(" ")}
          style={{ filter: "blur(80px)" }}
        />
      </div>

      <div className="relative flex flex-col items-center gap-8 px-6 max-w-lg w-full">
        {/* Icon */}
        <div className={[
          "flex h-20 w-20 items-center justify-center rounded-full border-2",
          isUrgent
            ? "border-red-500/50 bg-red-500/10"
            : "border-pa-green/50 bg-pa-green/10",
        ].join(" ")}>
          <Swords className={[
            "h-10 w-10",
            isUrgent ? "text-red-400" : "text-pa-green",
          ].join(" ")} />
        </div>

        {/* Title */}
        <div className="text-center">
          <h2 className="text-3xl font-black text-text-primary tracking-tight">
            {dict["readyCheckTitle"] ?? "Bist du bereit?"}
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            {dict["readyCheckSubtitle"] ?? "Alle Spieler müssen bestätigen"}
          </p>
        </div>

        {/* Timer */}
        <div className="relative flex items-center justify-center">
          {/* Circular progress */}
          <svg className="h-32 w-32 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50" cy="50" r="44"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-white/5"
            />
            <circle
              cx="50" cy="50" r="44"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 44}`}
              strokeDashoffset={`${2 * Math.PI * 44 * (1 - timer / 30)}`}
              className={[
                "transition-[stroke-dashoffset] duration-1000 ease-linear",
                isUrgent ? "text-red-500" : "text-pa-green",
              ].join(" ")}
            />
          </svg>
          <span className={[
            "absolute text-5xl font-black tabular-nums",
            isUrgent ? "text-red-400 animate-pulse" : "text-pa-green",
          ].join(" ")}>
            {timer}
          </span>
        </div>

        {/* Player ready status */}
        <div className="w-full space-y-3">
          <div className="flex items-center justify-center gap-2 text-sm text-text-secondary">
            <CheckCircle2 className="h-4 w-4 text-pa-green" />
            <span>{readyCount} / {totalCount} {dict["playersReady"] ?? "bereit"}</span>
          </div>
          <div className="flex flex-col gap-2">
            {battle.players.map((p) => (
              <div
                key={p.user._id}
                className={[
                  "flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-300",
                  p.ready
                    ? "bg-pa-green/10 border border-pa-green/30"
                    : "bg-white/3 border border-white/6",
                ].join(" ")}
              >
                {p.user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.user.image}
                    alt={p.user.name}
                    className="h-8 w-8 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pa-lila/30">
                    <Users className="h-4 w-4 text-text-secondary" />
                  </div>
                )}
                <span className="flex-1 text-sm font-semibold text-text-primary truncate">
                  {p.user.username ?? p.user.name}
                </span>
                {p.ready ? (
                  <CheckCircle2 className="h-5 w-5 text-pa-green shrink-0" />
                ) : (
                  <Clock className={[
                    "h-5 w-5 shrink-0 animate-pulse",
                    isUrgent ? "text-red-400" : "text-text-secondary",
                  ].join(" ")} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Ready button */}
        {isPlayer && !meReady && (
          <Button
            variant="accent"
            size="lg"
            loading={readying}
            onClick={onReady}
            className="w-full max-w-xs text-lg py-4 font-bold"
          >
            {dict["ready"] ?? "Ready!"}
          </Button>
        )}

        {/* Already ready message */}
        {isPlayer && meReady && !allReady && (
          <p className="text-sm text-pa-green font-medium animate-pulse">
            {dict["waitingForOthers"] ?? "Warte auf andere Spieler..."}
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Battle Lobby                                                       */
/* ------------------------------------------------------------------ */

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
      {/* Fullscreen ready-check overlay */}
      {isReadyCheck && (
        <ReadyCheckOverlay
          battle={battle}
          dict={dict}
          readyTimer={readyTimer}
          isPlayer={isPlayer}
          currentUserId={currentUserId}
          readying={readying}
          onReady={handleReady}
        />
      )}

      {/* Fullscreen countdown overlay (3-2-1 after all ready) */}
      {isCountdown && countdown !== null && countdown > 0 && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg/95 backdrop-blur-md">
          <p className="mb-4 text-lg font-medium text-text-secondary tracking-widest uppercase">
            {dict["battleStarting"] ?? "Battle startet in..."}
          </p>
          <span className="text-[10rem] font-black text-pa-green tabular-nums animate-pulse leading-none">
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
        {battle.eloRange && (
          <p className="text-xs text-text-secondary">
            Elo: {battle.eloRange.min}–{battle.eloRange.max}
          </p>
        )}
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
                    {rank.emoji} {getEloDivision(p.eloAtStart)}
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
