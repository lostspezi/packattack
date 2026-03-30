"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { Users, Swords, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BattlePlayer {
  user: {
    _id: string;
    name: string;
    username?: string;
    image?: string;
  };
  ready: boolean;
}

interface ActiveBattle {
  _id: string;
  slug: string;
  status: string;
  players: BattlePlayer[];
}

/* ------------------------------------------------------------------ */
/*  Sound hook                                                         */
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
    if (timer === 30 || timer === 20 || timer === 10 || (timer <= 5 && timer > 0)) {
      playBeep();
    }
  }, [timer, playBeep]);
}

/* ------------------------------------------------------------------ */
/*  Global Ready Check                                                 */
/* ------------------------------------------------------------------ */

interface GlobalReadyCheckProps {
  lang: string;
  dict: Record<string, string>;
}

export function GlobalReadyCheck({ lang, dict }: GlobalReadyCheckProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const currentUserId = (session?.user as { id?: string } | undefined)?.id;

  const [battle, setBattle] = useState<ActiveBattle | null>(null);
  const [readyTimer, setReadyTimer] = useState<number | null>(null);
  const [readying, setReadying] = useState(false);
  const [actionError, setActionError] = useState("");
  const eventSourceRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useReadySound(readyTimer);

  // Already on the battle page? Don't show overlay (battle-lobby handles it).
  const isOnBattlePage = battle?.slug
    ? pathname.includes(`/battles/${battle.slug}`)
    : false;

  // Poll for active battle every 10s
  useEffect(() => {
    if (!currentUserId) return;

    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/battles/active");
        const data = await res.json();
        if (cancelled) return;
        if (data.active && data.battle) {
          setBattle((prev) => {
            // Only set if different battle or first time
            if (!prev || prev._id !== data.battle._id) {
              return {
                _id: data.battle._id,
                slug: data.battle.slug,
                status: data.battle.status,
                players: data.battle.players ?? [],
              };
            }
            return prev;
          });
        } else {
          setBattle(null);
        }
      } catch {
        // ignore
      }
    }

    check();
    const iv = setInterval(check, 10_000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [currentUserId]);

  // Connect SSE when we have a battle
  useEffect(() => {
    if (!battle?._id) {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      return;
    }

    // Don't connect SSE if we're on the battle page (battle-view handles it)
    if (isOnBattlePage) {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      return;
    }

    const es = new EventSource(`/api/battles/${battle._id}/events`);
    eventSourceRef.current = es;

    es.addEventListener("ready_check_start", () => {
      setBattle((prev) => prev ? { ...prev, status: "ready_check" } : prev);
      setReadyTimer(30);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setReadyTimer((t) => {
          if (t === null || t <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    });

    es.addEventListener("player_ready", (e) => {
      try {
        const data = JSON.parse(e.data);
        setBattle((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            players: prev.players.map((p) =>
              p.user._id === data.userId ? { ...p, ready: true } : p
            ),
          };
        });
      } catch { /* ignore */ }
    });

    es.addEventListener("players_kicked", (e) => {
      try {
        const data = JSON.parse(e.data);
        const kickedIds: string[] = data.kickedUserIds ?? [];
        // If current user was kicked, close everything
        if (currentUserId && kickedIds.includes(currentUserId)) {
          setBattle(null);
          setReadyTimer(null);
          if (timerRef.current) clearInterval(timerRef.current);
          return;
        }
        setBattle((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            status: "waiting",
            players: prev.players
              .filter((p) => !kickedIds.includes(p.user._id))
              .map((p) => ({ ...p, ready: false })),
          };
        });
        setReadyTimer(null);
        if (timerRef.current) clearInterval(timerRef.current);
      } catch { /* ignore */ }
    });

    es.addEventListener("battle_start", () => {
      // Battle is starting — redirect to battle page
      setBattle(null);
      setReadyTimer(null);
      if (timerRef.current) clearInterval(timerRef.current);
      if (battle.slug) {
        router.push(`/${lang}/battles/${battle.slug}`);
      }
    });

    es.addEventListener("sync", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.battle) {
          setBattle((prev) => ({
            _id: data.battle._id ?? prev?._id ?? "",
            slug: data.battle.slug ?? prev?.slug ?? "",
            status: data.battle.status ?? prev?.status ?? "waiting",
            players: data.battle.players ?? prev?.players ?? [],
          }));
          // If sync shows ready_check and we don't have timer running, start it
          if (data.battle.status === "ready_check" && readyTimer === null) {
            // Calculate remaining time from readyCheckStartedAt
            let remaining = 30;
            if (data.battle.readyCheckStartedAt) {
              const elapsed = Math.floor(
                (Date.now() - new Date(data.battle.readyCheckStartedAt).getTime()) / 1000
              );
              remaining = Math.max(0, 30 - elapsed);
            }
            setReadyTimer(remaining);
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => {
              setReadyTimer((t) => {
                if (t === null || t <= 1) {
                  if (timerRef.current) clearInterval(timerRef.current);
                  return 0;
                }
                return t - 1;
              });
            }, 1000);
          }
        }
      } catch { /* ignore */ }
    });

    es.onerror = () => {
      // Browser auto-reconnects EventSource
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [battle?._id, isOnBattlePage]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleReady() {
    if (!battle) return;
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

  // Only show overlay when in ready_check status and not on the battle page
  const showOverlay = battle?.status === "ready_check" && !isOnBattlePage;
  if (!showOverlay) return null;

  const isPlayer = battle.players.some((p) => p.user._id === currentUserId);
  if (!isPlayer) return null;

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
        {!meReady && (
          <Button
            variant="accent"
            size="lg"
            loading={readying}
            onClick={handleReady}
            className="w-full max-w-xs text-lg py-4 font-bold"
          >
            {dict["ready"] ?? "Ready!"}
          </Button>
        )}

        {/* Already ready message */}
        {meReady && !allReady && (
          <p className="text-sm text-pa-green font-medium animate-pulse">
            {dict["waitingForOthers"] ?? "Warte auf andere Spieler..."}
          </p>
        )}

        {/* Error */}
        {actionError && (
          <p className="rounded-[10px] border border-red-500/20 bg-red-500/8 px-4 py-2 text-sm text-red-400">
            {actionError}
          </p>
        )}
      </div>
    </div>
  );
}
