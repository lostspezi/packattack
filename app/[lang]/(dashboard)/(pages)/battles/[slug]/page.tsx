"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, ArrowLeft } from "lucide-react";
import { GiTrophyCup, GiCrossedSwords, GiScales, GiLaurelCrown, GiPodiumWinner, GiPodiumSecond, GiPodiumThird, GiSandsOfTime, GiScrollUnfurled, GiRoundStar } from "react-icons/gi";

import { BattleWaiting } from "@/components/battles/battle-waiting";
import { BattleHand } from "@/components/battles/battle-hand";
import { BattleReveal } from "@/components/battles/battle-reveal";
import { notifyPendingPulls } from "@/components/packs/pending-pulls-guard";
import { useToast } from "@/components/ui/toast";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface VirtualCard {
  cardId: string | null;
  name: string;
  image: string;
  rarity: string;
  coinValue: number;
}

interface BattlePlayer {
  user: { _id: string; username: string; elo?: number };
  isReady: boolean;
  roundsWon: number;
}

interface BattleHand_ {
  player: string;
  cards: VirtualCard[];
  selectedCardIndex: number | null;
}

interface BattleRound {
  roundNumber: number;
  hands: BattleHand_[];
  winner: string | null;
  status: "selecting" | "revealing" | "completed";
  selectDeadline: string | null;
}

interface BattleResult {
  winner: string | null;
  isDraw: boolean;
  finalScores: { player: string; roundsWon: number }[];
  transfers: {
    from: string;
    to: string;
    cards: VirtualCard[];
    mode: string;
  }[];
  eloChanges: {
    player: string;
    oldElo: number;
    newElo: number;
    change: number;
  }[];
}

interface BattleData {
  _id: string;
  slug: string;
  status: string;
  creator: { _id: string; username: string };
  box: { _id: string; name: { de: string; en: string }; game: string; image: string | null };
  players: BattlePlayer[];
  settings: {
    playerCount: number;
    rounds: number;
    mode: string;
    isPrivate: boolean;
    inviteCode: string | null;
  };
  entryFee: number;
  currentRound: number;
  lobbyExpiresAt: string;
  readyCheckExpiresAt: string | null;
  rounds: BattleRound[];
  result: BattleResult | null;
}

/* ------------------------------------------------------------------ */
/*  SSE Hook                                                           */
/* ------------------------------------------------------------------ */

function useBattleSSE(
  battleId: string | null,
  onEvent: (event: { type: string; data: Record<string, unknown>; timestamp: string }) => void,
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!battleId) return;

    let eventSource: EventSource | null = null;
    let retryCount = 0;

    function connect() {
      eventSource = new EventSource(`/api/battles/${battleId}/events`);

      eventSource.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          retryCount = 0;
          onEventRef.current(event);
        } catch {
          // ignore parse errors
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        if (retryCount < 10) {
          retryCount++;
          setTimeout(connect, Math.min(1000 * retryCount, 10000));
        }
      };
    }

    connect();
    return () => {
      eventSource?.close();
    };
  }, [battleId]);
}

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function BattleDetailPage() {
  const params = useParams<{ lang: string; slug: string }>();
  const lang = params.lang ?? "en";
  const slug = params.slug;
  const isDe = lang === "de";
  const router = useRouter();
  const { toast } = useToast();

  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? "";

  const [battle, setBattle] = useState<BattleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [readying, setReadying] = useState(false);

  // Current round state from SSE
  const [myHand, setMyHand] = useState<VirtualCard[] | null>(null);
  const [selectDeadline, setSelectDeadline] = useState<string | null>(null);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const [revealData, setRevealData] = useState<{
    roundNumber: number;
    players: { userId: string; username: string; card: { name: string; image: string; coinValue: number } }[];
    winnerId: string | null;
  } | null>(null);
  // Round history for in-game display
  const [roundHistory, setRoundHistory] = useState<{
    roundNumber: number;
    players: { userId: string; username: string; card: { name: string; image: string; coinValue: number } }[];
    winnerId: string | null;
  }[]>([]);
  // Queue next round data so reveal animation can finish
  const pendingRoundRef = useRef<{ hand: VirtualCard[] | null; deadline: string; roundNumber: number } | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealPayloadRef = useRef<{
    roundNumber: number;
    players: { userId: string; username: string; card: { name: string; image: string; coinValue: number } }[];
    winnerId: string | null;
  } | null>(null);

  // Fetch initial battle state
  const fetchBattle = useCallback(async () => {
    try {
      const battleRes = await fetch(`/api/battles/${slug}`);

      if (!battleRes.ok) {
        router.push(`/${lang}/battles`);
        return;
      }

      const battleData = await battleRes.json();
      setBattle(battleData.battle);

      // Restore hand from current round if reconnecting
      const b = battleData.battle as BattleData;
      if ((b.status === "active" || b.status === "sudden_death") && b.rounds.length > 0) {
        const lastRound = b.rounds[b.rounds.length - 1];
        if (lastRound.status === "selecting" && currentUserId) {
          const myHandData = lastRound.hands.find((h: BattleHand_) => h.player === currentUserId);
          if (myHandData) {
            setMyHand(myHandData.cards);
            setSelectDeadline(lastRound.selectDeadline);
            setSelectedCardIndex(myHandData.selectedCardIndex);
            setRevealData(null);
          }
        }
      }
    } catch {
      router.push(`/${lang}/battles`);
    } finally {
      setLoading(false);
    }
  }, [slug, lang, router, currentUserId]);

  useEffect(() => {
    fetchBattle();
  }, [fetchBattle]);

  // SSE event handling
  const handleSSEEvent = useCallback(
    (event: { type: string; data: Record<string, unknown> }) => {
      switch (event.type) {
        case "player_joined":
        case "player_left":
        case "player_ready":
        case "battle_cancelled":
          // Refetch full state for structural changes
          fetchBattle();
          break;

        case "ready_check_started":
          setBattle((prev) =>
            prev ? { ...prev, status: "ready_check", readyCheckExpiresAt: event.data.expiresAt as string } : prev,
          );
          // Browser notification
          if (document.hidden && "Notification" in window && Notification.permission === "granted") {
            new Notification(isDe ? "Battle bereit!" : "Battle Ready!", {
              body: isDe ? "Dein Battle wartet auf dich!" : "Your battle is waiting!",
              icon: "/icon-192x192.png",
            });
          }
          break;

        case "countdown_started":
          setBattle((prev) => (prev ? { ...prev, status: "countdown" } : prev));
          break;

        case "round_start": {
          // Server sends one round_start per player:
          // - own event has hand[] (cards to pick from)
          // - opponent events have no hand (just round notification)
          // Only update pending if this event has hand data, OR if nothing is pending yet
          const incomingHand = event.data.hand as VirtualCard[] | null;
          const existing = pendingRoundRef.current;

          if (incomingHand || !existing || existing.roundNumber !== (event.data.roundNumber as number)) {
            pendingRoundRef.current = {
              hand: incomingHand ?? existing?.hand ?? null,
              deadline: event.data.selectDeadline as string,
              roundNumber: event.data.roundNumber as number,
            };
          }

          // If no reveal is playing, apply after a short delay
          // (500ms gives time for both per-player round_start events to arrive)
          if (!revealTimerRef.current) {
            revealTimerRef.current = setTimeout(() => {
              revealTimerRef.current = null;
              const pending = pendingRoundRef.current;
              if (!pending) return;
              setRevealData(null);
              setSelectedCardIndex(null);
              if (pending.hand) setMyHand(pending.hand);
              setSelectDeadline(pending.deadline);
              setBattle((prev) => prev ? { ...prev, status: "active", currentRound: pending.roundNumber } : prev);
              pendingRoundRef.current = null;
            }, 500);
          }
          break;
        }

        case "round_reveal": {
          const selections = event.data.selections as {
            player: string;
            playerId?: string;
            username?: string;
            card: { name: string; image: string; coinValue: number };
          }[];

          // Build reveal data using current battle state for player names
          setBattle((prev) => {
            if (!prev) return prev;
            const playerNameMap = new Map(prev.players.map((p) => [String(p.user._id), p.user.username]));
            // Store reveal data in ref first, then set state outside this callback
            revealPayloadRef.current = {
              roundNumber: event.data.roundNumber as number,
              players: selections.map((s) => {
                const id = s.playerId ?? s.player;
                return {
                  userId: id,
                  username: s.username ?? playerNameMap.get(id) ?? "???",
                  card: s.card,
                };
              }),
              winnerId: ((event.data.winner ?? event.data.roundWinner) as string) ?? null,
            };

            // Update scores inline
            if (event.data.scores) {
              const scores = event.data.scores as Record<string, number>;
              return {
                ...prev,
                players: prev.players.map((p) => ({
                  ...p,
                  roundsWon: scores[String(p.user._id)] ?? p.roundsWon,
                })),
              };
            }
            return prev;
          });

          // Apply reveal data outside the setBattle callback
          const revealSnapshot = revealPayloadRef.current;
          if (revealSnapshot) {
            setRevealData(revealSnapshot);
            revealPayloadRef.current = null;
          }
          setMyHand(null);

          // Cancel any existing timer (e.g. short fallback from round_start above)
          if (revealTimerRef.current) clearTimeout(revealTimerRef.current);

          // Keep reveal visible for 4s, then add to history + apply pending round_start
          revealTimerRef.current = setTimeout(() => {
            revealTimerRef.current = null;
            // Add to round history AFTER the flip animation
            if (revealSnapshot) {
              setRoundHistory((prev) => {
                const exists = prev.some((r) => r.roundNumber === revealSnapshot.roundNumber);
                if (exists) return prev;
                return [...prev, revealSnapshot];
              });
            }
            const pending = pendingRoundRef.current;
            if (pending) {
              setRevealData(null);
              setSelectedCardIndex(null);
              if (pending.hand) setMyHand(pending.hand);
              setSelectDeadline(pending.deadline);
              setBattle((prev) => prev ? { ...prev, status: "active", currentRound: pending.roundNumber } : prev);
              pendingRoundRef.current = null;
            }
          }, 4000);

          break;
        }

        case "battle_end":
        case "battle_finished":
          // Wait for reveal animation to finish before fetching final state
          if (revealTimerRef.current) {
            // A reveal is playing — wait for it, then fetch
            const existingTimer = revealTimerRef.current;
            clearTimeout(existingTimer);
            revealTimerRef.current = setTimeout(() => {
              revealTimerRef.current = null;
              pendingRoundRef.current = null;
              fetchBattle();
            }, 4000);
          } else {
            fetchBattle();
          }
          break;
      }
    },
    [fetchBattle, isDe],
  );

  useBattleSSE(battle?._id ?? null, handleSSEEvent);

  // Cleanup reveal timer on unmount
  useEffect(() => {
    return () => {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, []);

  // Notify the global PendingPullsGuard when battle finishes
  useEffect(() => {
    if (battle?.status === "finished") {
      notifyPendingPulls();
    }
  }, [battle?.status]);

  // Actions
  async function handleReady() {
    if (!battle) return;
    setReadying(true);
    try {
      const res = await fetch(`/api/battles/${battle._id}/ready`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        toast({ title: data.error || "Error", type: "error" });
      }
    } catch {
      toast({ title: isDe ? "Fehler" : "Error", type: "error" });
    } finally {
      setReadying(false);
    }
  }

  async function handleLeave() {
    if (!battle) return;
    try {
      const res = await fetch(`/api/battles/${battle._id}/leave`, { method: "POST" });
      if (res.ok) {
        router.push(`/${lang}/battles`);
      } else {
        const data = await res.json();
        toast({ title: data.error || "Error", type: "error" });
      }
    } catch {
      toast({ title: isDe ? "Fehler" : "Error", type: "error" });
    }
  }

  async function handleStart() {
    if (!battle) return;
    try {
      const res = await fetch(`/api/battles/${battle._id}/start`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        toast({ title: data.error || "Error", type: "error" });
      }
    } catch {
      toast({ title: isDe ? "Fehler" : "Error", type: "error" });
    }
  }

  async function handleSelect(cardIndex: number) {
    if (!battle || selectedCardIndex !== null) return;
    setSelectedCardIndex(cardIndex);
    try {
      const res = await fetch(`/api/battles/${battle._id}/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardIndex }),
      });
      if (!res.ok) {
        setSelectedCardIndex(null);
        const data = await res.json();
        toast({ title: data.error || "Error", type: "error" });
      }
    } catch {
      setSelectedCardIndex(null);
      toast({ title: isDe ? "Fehler" : "Error", type: "error" });
    }
  }

  // Loading
  if (loading || !battle) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  const isPreGame = ["waiting", "ready_check", "countdown"].includes(battle.status);
  const isActive = battle.status === "active" || battle.status === "sudden_death";
  const isFinished = battle.status === "finished" || battle.status === "cancelled";

  return (
    <div className={`mx-auto w-full px-4 py-6 ${isFinished ? "max-w-[1600px]" : isActive ? "max-w-[1400px]" : "max-w-5xl"}`}>
      {/* Back Link */}
      <button
        onClick={() => router.push(`/${lang}/battles`)}
        className="mb-4 flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <ArrowLeft className="h-4 w-4" />
        {isDe ? "Zurück zur Lobby" : "Back to Lobby"}
      </button>

      {/* Pre-Game: Waiting / Ready Check / Countdown */}
      {isPreGame && (
        <BattleWaiting
          battle={battle}
          currentUserId={currentUserId}
          lang={lang}
          onReady={handleReady}
          onLeave={handleLeave}
          onStart={handleStart}
          readying={readying}
        />
      )}

      {/* Active Game — 3-Column Table Layout */}
      {isActive && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[220px_1fr_220px] xl:grid-cols-[260px_1fr_260px]">

          {/* ===== LEFT SIDEBAR: Score + Round History (desktop) ===== */}
          <div className="hidden flex-col gap-3 lg:flex">
            {/* Scoreboard */}
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/70">
              <div className="flex items-center gap-1.5 border-b border-zinc-800/60 px-4 py-2.5">
                <GiCrossedSwords className="h-3.5 w-3.5 text-zinc-500" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  {isDe ? "Punkte" : "Score"}
                </span>
              </div>
              <div className="p-2">
                {[...battle.players].sort((a, b) => b.roundsWon - a.roundsWon).map((player, i) => {
                  const isMe = player.user._id === currentUserId;
                  return (
                    <div key={player.user._id} className={`flex items-center justify-between rounded-lg px-3 py-1.5 ${isMe ? "bg-yellow-400/10" : ""}`}>
                      <div className="flex items-center gap-2">
                        <span className="w-4 text-center text-[10px] font-bold text-zinc-600">{i + 1}</span>
                        <span className={`text-sm ${isMe ? "font-bold text-yellow-400" : "text-zinc-300"}`}>{player.user.username}</span>
                      </div>
                      <span className={`text-sm font-bold tabular-nums ${isMe ? "text-yellow-400" : "text-zinc-400"}`}>{player.roundsWon}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Round History */}
            {roundHistory.length > 0 && (
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/70">
                <div className="flex items-center gap-1.5 border-b border-zinc-800/60 px-4 py-2.5">
                  <GiScrollUnfurled className="h-3.5 w-3.5 text-zinc-500" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    {isDe ? "Verlauf" : "History"}
                  </span>
                </div>
                <div className="flex flex-col gap-1 p-2">
                  {roundHistory.map((round) => {
                    const winnerP = round.players.find((p) => p.userId === round.winnerId);
                    const isTie = !round.winnerId;
                    return (
                      <div key={round.roundNumber} className="rounded-lg bg-zinc-800/40 px-3 py-2">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                            {isDe ? "Runde" : "R"}{round.roundNumber}
                          </span>
                          {isTie ? (
                            <span className="text-[10px] font-bold text-zinc-500">{isDe ? "Gleich" : "Tie"}</span>
                          ) : (
                            <span className="text-[10px] font-bold text-yellow-400">{winnerP?.username}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {round.players.map((rp) => {
                            const isWin = rp.userId === round.winnerId;
                            return (
                              <div key={rp.userId} className="flex items-center gap-1">
                                <div className={`overflow-hidden rounded border ${isWin ? "border-yellow-400/60" : "border-zinc-700/40"}`} style={{ width: "28px", aspectRatio: "2/3" }}>
                                  <img src={rp.card.image} alt="" className="h-full w-full object-cover" draggable={false} />
                                </div>
                                <span className={`text-[10px] font-bold tabular-nums ${isWin ? "text-yellow-400" : "text-zinc-500"}`}>{rp.card.coinValue}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ===== CENTER: The Table ===== */}
          <div
            className="relative overflow-hidden rounded-2xl border border-zinc-800/80"
            style={{
              background: "radial-gradient(ellipse at 50% 40%, rgba(20,60,30,0.6) 0%, rgba(15,15,20,0.95) 70%)",
            }}
          >
            {/* Subtle felt texture via noise */}
            <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundSize: "128px" }} />

            {/* Table center logo watermark */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <img
                src="/images/logo.svg"
                alt=""
                className="w-24 opacity-[0.06] sm:w-36 lg:w-48"
                draggable={false}
              />
            </div>

            <div className="relative flex flex-col items-center px-3 py-4 sm:px-6 sm:py-6">
              {/* Round indicator — top center */}
              {battle.status === "sudden_death" ? (
                <div className="mb-3 flex flex-col items-center gap-1">
                  <div className="flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-1.5">
                    <GiCrossedSwords className="h-4 w-4 text-red-400" />
                    <span className="text-xs font-extrabold uppercase tracking-widest text-red-400">
                      Sudden Death
                    </span>
                    <GiCrossedSwords className="h-4 w-4 text-red-400" />
                  </div>
                  <span className="text-[10px] text-red-400/60">
                    {isDe ? "Gleichstand — eine letzte Runde entscheidet!" : "Tied — one final round decides it all!"}
                  </span>
                </div>
              ) : (
                <div className="mb-2 flex items-center gap-2">
                  <GiRoundStar className="h-3 w-3 text-yellow-400/40" />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                    {isDe ? "Runde" : "Round"} {battle.currentRound}/{battle.settings.rounds}
                  </span>
                  <GiRoundStar className="h-3 w-3 text-yellow-400/40" />
                </div>
              )}

              {/* Opponent zone — top of table */}
              <div className="mb-3 flex flex-wrap items-start justify-center gap-4">
                {battle.players
                  .filter((p) => p.user._id !== currentUserId)
                  .map((opponent) => {
                    const hasOpponentSelected = selectedCardIndex !== null;
                    return (
                      <div key={opponent.user._id} className="flex flex-col items-center gap-1.5">
                        <span className="text-[11px] font-bold text-zinc-400">{opponent.user.username}</span>
                        <div className="flex items-center gap-2">
                          {hasOpponentSelected ? (
                            <div className="overflow-hidden rounded-lg border border-zinc-700/60 shadow-lg shadow-black/30" style={{ width: "clamp(50px, 12vw, 70px)", aspectRatio: "2/3" }}>
                              <img src="/images/card-back.jpg" alt="" className="h-full w-full object-cover" draggable={false} />
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 rounded-full bg-zinc-800/60 px-3 py-1">
                              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-400/60" />
                              <span className="text-[10px] text-zinc-500">{isDe ? "Wählt..." : "Choosing..."}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* ===== TABLE CENTER: Reveal / Waiting ===== */}
              <div className="my-2 flex min-h-[180px] items-center justify-center sm:min-h-[220px]">
                {revealData ? (
                  <BattleReveal
                    roundNumber={revealData.roundNumber}
                    totalRounds={battle.settings.rounds}
                    players={revealData.players}
                    winnerId={revealData.winnerId}
                    lang={lang}
                    isSuddenDeath={battle.status === "sudden_death"}
                  />
                ) : !myHand ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-yellow-400/60" />
                    <p className="text-[11px] text-zinc-600">{isDe ? "Nächste Runde..." : "Next round..."}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <div className="text-[10px] uppercase tracking-widest text-zinc-600/40">
                      {isDe ? "Wähle deine Karte" : "Pick your card"}
                    </div>
                  </div>
                )}
              </div>

              {/* ===== MY HAND — bottom of table ===== */}
              {myHand && (
                <div className="mt-2 w-full">
                  <BattleHand
                    cards={myHand}
                    selectDeadline={selectDeadline}
                    onSelect={handleSelect}
                    lang={lang}
                    selectedIndex={selectedCardIndex}
                  />
                </div>
              )}
            </div>
          </div>

          {/* ===== RIGHT SIDEBAR: Round info + mobile score (desktop) ===== */}
          <div className="hidden flex-col gap-3 lg:flex">
            {/* Current player status */}
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 p-4">
              <div className="mb-3 flex items-center gap-1.5">
                <GiSandsOfTime className="h-3.5 w-3.5 text-zinc-500" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  {isDe ? "Status" : "Status"}
                </span>
              </div>
              {battle.players.map((player) => {
                const isMe = player.user._id === currentUserId;
                const hasSelected = isMe ? selectedCardIndex !== null : false;
                return (
                  <div key={player.user._id} className={`flex items-center justify-between rounded-lg px-3 py-1.5 ${isMe ? "bg-yellow-400/5" : ""}`}>
                    <span className={`text-xs ${isMe ? "font-bold text-yellow-400" : "text-zinc-400"}`}>
                      {player.user.username}
                    </span>
                    {hasSelected ? (
                      <span className="text-[10px] font-bold text-emerald-400">{isDe ? "Bereit" : "Ready"}</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-400/60" />
                        <span className="text-[10px] text-zinc-500">{isDe ? "Wählt..." : "Picking..."}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Battle info */}
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 p-4">
              <div className="space-y-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">{isDe ? "Modus" : "Mode"}</span>
                  <span className="font-bold text-zinc-300">{battle.settings.mode === "winner_takes_highest" ? (isDe ? "Höchste" : "Highest") : battle.settings.mode === "winner_takes_lowest" ? (isDe ? "Niedrigste" : "Lowest") : battle.settings.mode === "winner_takes_all" ? "All" : "Classic"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">{isDe ? "Einsatz" : "Entry"}</span>
                  <span className="font-bold text-yellow-400">{battle.entryFee} Coins</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">{isDe ? "Spieler" : "Players"}</span>
                  <span className="font-bold text-zinc-300">{battle.players.length}/{battle.settings.playerCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ===== MOBILE: Score strip + Round History (below table) ===== */}
          <div className="flex flex-col gap-2 lg:hidden">
            {/* Compact score row */}
            <div className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-900/70 px-3 py-2">
              <div className="flex items-center gap-1.5">
                <GiCrossedSwords className="h-3 w-3 text-zinc-500" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{isDe ? "Punkte" : "Score"}</span>
              </div>
              <div className="flex items-center gap-3">
                {battle.players.map((player) => {
                  const isMe = player.user._id === currentUserId;
                  return (
                    <div key={player.user._id} className="flex items-center gap-1.5">
                      <span className={`text-xs ${isMe ? "font-bold text-yellow-400" : "text-zinc-400"}`}>{player.user.username}</span>
                      <span className={`text-sm font-bold tabular-nums ${isMe ? "text-yellow-400" : "text-zinc-400"}`}>{player.roundsWon}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mobile round history — horizontal scroll */}
            {roundHistory.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {roundHistory.map((round) => {
                  const winnerP = round.players.find((p) => p.userId === round.winnerId);
                  const isTie = !round.winnerId;
                  return (
                    <div key={round.roundNumber} className="flex shrink-0 items-center gap-2 rounded-lg border border-zinc-800/60 bg-zinc-900/70 px-2.5 py-1.5">
                      <span className="text-[10px] font-bold text-zinc-500">R{round.roundNumber}</span>
                      <div className="flex items-center gap-1.5">
                        {round.players.map((rp) => {
                          const isWin = rp.userId === round.winnerId;
                          return (
                            <div key={rp.userId} className={`overflow-hidden rounded border ${isWin ? "border-yellow-400/60" : "border-zinc-700/40"}`} style={{ width: "22px", aspectRatio: "2/3" }}>
                              <img src={rp.card.image} alt="" className="h-full w-full object-cover" draggable={false} />
                            </div>
                          );
                        })}
                      </div>
                      {isTie ? (
                        <GiScales className="h-3 w-3 text-zinc-500" />
                      ) : (
                        <span className="max-w-[60px] truncate text-[10px] font-bold text-yellow-400">{winnerP?.username}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Finished — Result Screen */}
      {isFinished && battle.result && (
        <BattleResultView
          battle={battle}
          currentUserId={currentUserId}
          lang={lang}
        />
      )}

      {isFinished && !battle.result && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg font-bold text-zinc-400">
            {battle.status === "cancelled"
              ? isDe ? "Battle abgebrochen" : "Battle Cancelled"
              : isDe ? "Battle beendet" : "Battle Ended"}
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Battle Result (inline for now)                                     */
/* ------------------------------------------------------------------ */

function BattleResultView({
  battle,
  currentUserId,
  lang,
}: {
  battle: BattleData;
  currentUserId: string;
  lang: string;
}) {
  const isDe = lang === "de";
  const result = battle.result!;
  const isWinner = result.winner === currentUserId;
  const isDraw = result.isDraw;

  const myEloChange = result.eloChanges.find((e) => e.player === currentUserId);
  const playerNameMap = new Map(battle.players.map((p) => [String(p.user._id), p.user.username]));
  const sortedScores = [...result.finalScores].sort((a, b) => b.roundsWon - a.roundsWon);

  const glowColor = isDraw ? "rgba(161,161,170,0.15)" : isWinner ? "rgba(250,204,21,0.12)" : "rgba(248,113,113,0.1)";
  const accentColor = isDraw ? "zinc" : isWinner ? "yellow" : "red";

  return (
    <>
      {/* Keyframes */}
      <style>{`
        @keyframes battleFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes battleGlow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
      `}</style>

      {/* ====== MOBILE (< md): stacked ====== */}
      <div className="flex flex-col gap-3 md:hidden">
        {/* Banner */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 relative overflow-hidden px-4 py-5 text-center" style={{animation: "battleFadeUp 0.5s ease-out 0ms both"}}>
          <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${glowColor}, transparent 70%)` }} />
          <div className="relative">
            <div className="flex justify-center">{isDraw ? <GiScales className="h-8 w-8 text-zinc-400" /> : isWinner ? <GiTrophyCup className="h-8 w-8 text-yellow-400" /> : <GiCrossedSwords className="h-8 w-8 text-red-400" />}</div>
            <h1 className={`mt-1 text-xl font-extrabold tracking-tight ${
              accentColor === "yellow" ? "bg-gradient-to-r from-yellow-300 to-amber-500 bg-clip-text text-transparent"
              : accentColor === "red" ? "text-red-400" : "text-zinc-300"
            }`}>
              {isDraw ? (isDe ? "Unentschieden!" : "Draw!") : isWinner ? (isDe ? "Sieg!" : "Victory!") : (isDe ? "Niederlage" : "Defeat")}
            </h1>
            {myEloChange && (
              <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1 text-xs">
                <span className="text-zinc-500">ELO</span>
                <span className="font-bold text-zinc-400">{myEloChange.oldElo}</span>
                <span className="text-zinc-600">→</span>
                <span className="font-bold text-zinc-100">{myEloChange.newElo}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${myEloChange.change >= 0 ? "bg-green-400/10 text-green-400" : "bg-red-400/10 text-red-400"}`}>
                  {myEloChange.change >= 0 ? "+" : ""}{myEloChange.change}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Podium */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 px-3 py-4" style={{animation: "battleFadeUp 0.5s ease-out 80ms both"}}>
          <PodiumBlock scores={sortedScores} players={battle.players} currentUserId={currentUserId} eloChanges={result.eloChanges} isDe={isDe} />
        </div>

        {/* CTAs */}
        <div className="flex gap-2" style={{ animation: "battleFadeUp 0.5s ease-out 160ms both" }}>
          <a href={`/${lang}/battles`} className="flex-1 rounded-lg border border-yellow-400/30 bg-yellow-400/10 py-2.5 text-center text-sm font-bold text-yellow-400 transition-colors hover:bg-yellow-400/20">
            {isDe ? "Neues Battle" : "New Battle"}
          </a>
          <a href={`/${lang}/battles`} className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800/80 py-2.5 text-center text-sm font-bold text-zinc-300 transition-colors hover:bg-zinc-700">
            {isDe ? "Zur Lobby" : "Back to Lobby"}
          </a>
        </div>

        {/* Rounds */}
        {battle.rounds.length > 0 && (
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 overflow-hidden" style={{animation: "battleFadeUp 0.5s ease-out 240ms both"}}>
            <div className="border-b border-zinc-800 px-3 py-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{isDe ? "Rundenverlauf" : "Round History"}</h3>
            </div>
            <RoundRows rounds={battle.rounds} settings={battle.settings} playerNameMap={playerNameMap} currentUserId={currentUserId} isDe={isDe} />
          </div>
        )}

        {/* Transfers */}
        {result.transfers.length > 0 && (
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 overflow-hidden" style={{animation: "battleFadeUp 0.5s ease-out 320ms both"}}>
            <div className="border-b border-zinc-800 px-3 py-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{isDe ? "Erhaltene Karten" : "Cards Received"}</h3>
            </div>
            <TransfersList transfers={result.transfers} players={battle.players} currentUserId={currentUserId} />
          </div>
        )}
      </div>

      {/* ====== TABLET+ (md): bento grid ====== */}
      {/*
        md (2-col):
        ┌──────────┬──────────────┐
        │  Banner  │ Podium+CTAs  │
        ├──────────┴──────────────┤
        │  Rounds  │  Transfers   │
        └──────────┴──────────────┘

        lg (3-col):
        ┌────────┬──────────┬──────────┐
        │ Banner │  Podium  │  CTAs +  │
        │        │          │  Karten  │
        ├────────┴──────────┤          │
        │    Rundenverlauf  │          │
        └───────────────────┴──────────┘
      */}
      <div className="hidden md:block">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          {/* Banner — md: col1, lg: col1 */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 relative overflow-hidden p-5 text-center md:col-span-1" style={{animation: "battleFadeUp 0.5s ease-out 0ms both"}}>
            <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${glowColor}, transparent 70%)` }} />
            <div className="relative flex h-full flex-col items-center justify-center">
              <div className="flex justify-center">{isDraw ? <GiScales className="h-10 w-10 text-zinc-400" /> : isWinner ? <GiTrophyCup className="h-10 w-10 text-yellow-400" /> : <GiCrossedSwords className="h-10 w-10 text-red-400" />}</div>
              <h1 className={`mt-2 text-2xl font-extrabold tracking-tight lg:text-3xl ${
                accentColor === "yellow" ? "bg-gradient-to-r from-yellow-300 to-amber-500 bg-clip-text text-transparent"
                : accentColor === "red" ? "text-red-400" : "text-zinc-300"
              }`}>
                {isDraw ? (isDe ? "Unentschieden!" : "Draw!") : isWinner ? (isDe ? "Sieg!" : "Victory!") : (isDe ? "Niederlage" : "Defeat")}
              </h1>
              {myEloChange && (
                <div className="mt-2 flex items-center gap-1.5 text-sm">
                  <span className="text-zinc-500">ELO</span>
                  <span className="font-bold text-zinc-400">{myEloChange.oldElo}</span>
                  <span className="text-zinc-600">→</span>
                  <span className="font-bold text-zinc-100">{myEloChange.newElo}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${myEloChange.change >= 0 ? "bg-green-400/10 text-green-400" : "bg-red-400/10 text-red-400"}`}>
                    {myEloChange.change >= 0 ? "+" : ""}{myEloChange.change}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Podium + CTAs — md: col2, lg: col2 */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 flex flex-col gap-3 p-4 md:col-span-1" style={{animation: "battleFadeUp 0.5s ease-out 80ms both"}}>
            <PodiumBlock scores={sortedScores} players={battle.players} currentUserId={currentUserId} eloChanges={result.eloChanges} isDe={isDe} />
            <div className="mt-auto flex gap-2">
              <a href={`/${lang}/battles`} className="flex-1 rounded-lg border border-yellow-400/30 bg-yellow-400/10 py-2 text-center text-sm font-bold text-yellow-400 transition-colors hover:bg-yellow-400/20">
                {isDe ? "Neues Battle" : "New Battle"}
              </a>
              <a href={`/${lang}/battles`} className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800/80 py-2 text-center text-sm font-bold text-zinc-300 transition-colors hover:bg-zinc-700">
                {isDe ? "Zur Lobby" : "Back to Lobby"}
              </a>
            </div>
          </div>

          {/* Transfers — md: col2 row2, lg: col3 row-span-2 (right sidebar) */}
          {result.transfers.length > 0 && (
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 overflow-hidden md:col-span-1 md:row-span-1 lg:col-start-3 lg:row-span-2 lg:row-start-1" style={{animation: "battleFadeUp 0.5s ease-out 160ms both"}}>
              <div className="border-b border-zinc-800 px-3 py-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{isDe ? "Erhaltene Karten" : "Cards Received"}</h3>
              </div>
              <TransfersList transfers={result.transfers} players={battle.players} currentUserId={currentUserId} />
            </div>
          )}

          {/* Rounds — md: col-span-full or col1, lg: col-span-2 */}
          {battle.rounds.length > 0 && (
            <div className={`rounded-xl border border-zinc-800/80 bg-zinc-900/70 overflow-hidden ${result.transfers.length > 0 ? "md:col-span-1 lg:col-span-2" : "md:col-span-2 lg:col-span-3"}`} style={{animation: "battleFadeUp 0.5s ease-out 240ms both"}}>
              <div className="border-b border-zinc-800 px-4 py-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{isDe ? "Rundenverlauf" : "Round History"}</h3>
              </div>
              <RoundRows rounds={battle.rounds} settings={battle.settings} playerNameMap={playerNameMap} currentUserId={currentUserId} isDe={isDe} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ---- Sub-components for BattleResultView ---- */

function PodiumBlock({ scores, players, currentUserId, eloChanges, isDe }: {
  scores: { player: string; roundsWon: number }[];
  players: BattlePlayer[];
  currentUserId: string;
  eloChanges: { player: string; change: number }[];
  isDe: boolean;
}) {
  // Detect ties — players with the same roundsWon share a rank
  const topScore = scores[0]?.roundsWon ?? 0;
  const isTiedTop = scores.length >= 2 && scores[0].roundsWon === scores[1].roundsWon;

  const podiumOrder = scores.length <= 2
    ? scores
    : [scores[1], scores[0], scores[2], ...scores.slice(3)];
  const heights = scores.length <= 2
    ? (isTiedTop ? ["h-20 md:h-24", "h-20 md:h-24"] : ["h-20 md:h-24", "h-14 md:h-16"])
    : ["h-14 md:h-18", "h-20 md:h-24", "h-10 md:h-14"];
  const medalIcons = [
    <GiPodiumWinner key="1st" className="h-5 w-5 text-yellow-400 md:h-6 md:w-6" />,
    <GiPodiumSecond key="2nd" className="h-5 w-5 text-zinc-400 md:h-6 md:w-6" />,
    <GiPodiumThird key="3rd" className="h-5 w-5 text-amber-600 md:h-6 md:w-6" />,
  ];

  return (
    <div className="flex items-end justify-center gap-2">
      {podiumOrder.map((score, podIdx) => {
        const rank = scores.indexOf(score);
        const player = players.find((p) => String(p.user._id) === String(score.player));
        const isMe = String(score.player) === currentUserId;
        const elo = eloChanges.find((e) => String(e.player) === String(score.player));
        // Only crown as champion if they're rank 0 AND not tied
        const isChamp = rank === 0 && !isTiedTop;
        const isTied = score.roundsWon === topScore && isTiedTop;
        const h = heights[podIdx] ?? "h-10";
        const borderColor = isTied ? "border-zinc-400/40" : isChamp ? "border-yellow-400/40" : rank === 1 ? "border-zinc-500/40" : "border-amber-700/40";
        const gradFrom = isTied ? "from-zinc-400/15" : isChamp ? "from-yellow-400/25" : rank === 1 ? "from-zinc-500/20" : "from-amber-700/20";

        return (
          <div key={String(score.player)} className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
            <div className={`max-w-full truncate text-[11px] font-bold ${isMe ? "text-yellow-400" : "text-zinc-300"}`}>
              {player?.user.username ?? "???"}
            </div>
            <div className="flex items-baseline gap-0.5">
              <span className={`font-extrabold ${isChamp ? "text-lg text-yellow-400" : "text-base text-zinc-300"}`}>{score.roundsWon}</span>
              <span className="text-[8px] uppercase text-zinc-500">{isDe ? "Siege" : "Wins"}</span>
            </div>
            {elo && (
              <span className={`text-[9px] font-bold ${elo.change >= 0 ? "text-green-400" : "text-red-400"}`}>
                {elo.change >= 0 ? "+" : ""}{elo.change}
              </span>
            )}
            <div className={`flex w-full max-w-[80px] items-start justify-center rounded-t-lg border border-b-0 bg-gradient-to-t ${gradFrom} to-transparent md:max-w-[100px] ${borderColor} ${h}`}>
              <span className="mt-1.5 md:mt-2">
                {isTied
                  ? <GiScales className="h-5 w-5 text-zinc-400 md:h-6 md:w-6" />
                  : (medalIcons[rank] ?? <span className="text-xs font-bold text-zinc-500">#{rank + 1}</span>)
                }
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RoundRows({ rounds, settings, playerNameMap, currentUserId, isDe }: {
  rounds: BattleRound[];
  settings: { rounds: number };
  playerNameMap: Map<string, string>;
  currentUserId: string;
  isDe: boolean;
}) {
  return (
    <div>
      {rounds
        .filter((r) => r.status === "completed" || r.status === "revealing")
        .map((round, idx) => {
          const winnerId = round.winner ? String(round.winner) : null;
          return (
            <div
              key={round.roundNumber}
              className={`p-2.5 md:p-3 ${idx > 0 ? "border-t border-zinc-800/60" : ""} ${winnerId ? "bg-zinc-800/20" : ""}`}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-bold text-zinc-500">
                  {isDe ? "Runde" : "Round"} {round.roundNumber}
                  {round.roundNumber > settings.rounds && <span className="ml-1 text-yellow-400">SD</span>}
                </span>
                <span className={`text-[11px] font-bold ${winnerId ? "text-yellow-400" : "text-zinc-600"}`}>
                  {winnerId ? <><GiLaurelCrown className="mr-0.5 inline h-3 w-3" /> {playerNameMap.get(winnerId) ?? "???"}</> : (isDe ? "Gleich" : "Tie")}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-3">
                {round.hands.map((hand, hIdx) => {
                  const pid = String(hand.player);
                  const name = playerNameMap.get(pid) ?? "???";
                  const isMe = pid === currentUserId;
                  const isW = pid === winnerId;
                  const card = hand.selectedCardIndex !== null && hand.selectedCardIndex >= 0 ? hand.cards[hand.selectedCardIndex] : null;
                  return (
                    <React.Fragment key={pid}>
                      {hIdx > 0 && <span className="hidden text-[10px] font-bold text-zinc-600 md:block">vs</span>}
                      <div className={`flex flex-1 items-center gap-2 rounded-lg border p-1.5 ${isW ? "border-yellow-400/20 bg-yellow-400/5" : "border-zinc-800 bg-zinc-800/20"}`}>
                        {card && card.cardId ? (
                          <img src={card.image} alt="" className={`h-10 w-7 shrink-0 rounded border object-cover ${isW ? "border-yellow-400/50" : "border-zinc-700"}`} />
                        ) : (
                          <div className="flex h-10 w-7 shrink-0 items-center justify-center rounded border border-zinc-700 bg-zinc-800 text-[10px] text-zinc-600">?</div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className={`flex items-center gap-0.5 text-[11px] font-bold ${isMe ? "text-yellow-400" : "text-zinc-300"}`}><span className="truncate">{name}</span> {isW && <GiLaurelCrown className="h-3 w-3 shrink-0 text-yellow-400" />}</div>
                          {card && card.cardId && (
                            <div className="flex items-baseline justify-between gap-1">
                              <span className="min-w-0 truncate text-[10px] text-zinc-500">{card.name}</span>
                              <span className={`shrink-0 text-[10px] font-bold ${isW ? "text-yellow-400" : "text-zinc-400"}`}>{card.coinValue}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          );
        })}
    </div>
  );
}

function TransfersList({ transfers, players, currentUserId }: {
  transfers: BattleResult["transfers"];
  players: BattlePlayer[];
  currentUserId: string;
}) {
  return (
    <div className="divide-y divide-zinc-800/60">
      {transfers.map((transfer, i) => {
        const toPlayer = players.find((p) => String(p.user._id) === String(transfer.to));
        const isMe = String(transfer.to) === currentUserId;
        const total = transfer.cards.reduce((s, c) => s + c.coinValue, 0);
        return (
          <div key={i} className={`p-2.5 ${isMe ? "bg-yellow-400/[0.03]" : ""}`}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className={`text-xs font-bold ${isMe ? "text-yellow-400" : "text-zinc-300"}`}>{toPlayer?.user.username ?? "???"}</span>
              <span className="text-xs font-bold text-yellow-400">{total} Coins</span>
            </div>
            <div className="flex flex-col gap-1">
              {transfer.cards.map((card, j) => (
                <div key={j} className="flex items-center gap-2 rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-1.5">
                  <img src={card.image} alt="" className="h-8 w-6 shrink-0 rounded object-cover" />
                  <div className="min-w-0 flex-1 truncate text-[11px] text-zinc-300">{card.name}</div>
                  <div className="shrink-0 text-[10px] font-bold text-yellow-400">{card.coinValue}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
