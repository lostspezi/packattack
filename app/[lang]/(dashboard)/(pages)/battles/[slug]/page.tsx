"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft } from "lucide-react";

import { BattleWaiting } from "@/components/battles/battle-waiting";
import { BattleHand } from "@/components/battles/battle-hand";
import { BattleReveal } from "@/components/battles/battle-reveal";
import { BattleScoreboard } from "@/components/battles/battle-scoreboard";
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

  const [battle, setBattle] = useState<BattleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState("");
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

  // Fetch initial battle state
  const fetchBattle = useCallback(async () => {
    try {
      const [battleRes, meRes] = await Promise.all([
        fetch(`/api/battles/${slug}`),
        fetch("/api/user/me"),
      ]);

      if (!battleRes.ok) {
        router.push(`/${lang}/battles`);
        return;
      }

      const battleData = await battleRes.json();
      setBattle(battleData.battle);

      let meUserId = "";
      if (meRes.ok) {
        const meData = await meRes.json();
        meUserId = meData.user?._id ?? meData.user?.id ?? "";
        setCurrentUserId(meUserId);
      }

      // Restore hand from current round if reconnecting
      const b = battleData.battle as BattleData;
      if ((b.status === "active" || b.status === "sudden_death") && b.rounds.length > 0) {
        const lastRound = b.rounds[b.rounds.length - 1];
        if (lastRound.status === "selecting") {
          const myHandData = lastRound.hands.find((h: BattleHand_) => h.player === meUserId);
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
   
  }, [slug, lang, router]);

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

        case "round_start":
          setRevealData(null);
          setSelectedCardIndex(null);
          if (event.data.hand) {
            setMyHand((event.data.hand as { cards: VirtualCard[] }).cards);
          }
          setSelectDeadline(event.data.selectDeadline as string);
          setBattle((prev) =>
            prev
              ? { ...prev, status: "active", currentRound: event.data.roundNumber as number }
              : prev,
          );
          break;

        case "round_reveal": {
          const selections = event.data.selections as {
            playerId: string;
            username: string;
            card: { name: string; image: string; coinValue: number };
          }[];
          setRevealData({
            roundNumber: event.data.roundNumber as number,
            players: selections.map((s) => ({
              userId: s.playerId,
              username: s.username,
              card: s.card,
            })),
            winnerId: (event.data.roundWinner as string) ?? null,
          });
          setMyHand(null);
          // Update scores
          if (event.data.scores) {
            const scores = event.data.scores as Record<string, number>;
            setBattle((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                players: prev.players.map((p) => ({
                  ...p,
                  roundsWon: scores[p.user._id] ?? p.roundsWon,
                })),
              };
            });
          }
          break;
        }

        case "battle_finished":
          fetchBattle();
          break;
      }
    },
    [fetchBattle, isDe],
  );

  useBattleSSE(battle?._id ?? null, handleSSEEvent);

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
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
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

      {/* Active Game */}
      {isActive && (
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Main Area */}
          <div className="min-w-0 flex-1">
            {/* Round Reveal */}
            {revealData && (
              <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                <BattleReveal
                  roundNumber={revealData.roundNumber}
                  totalRounds={battle.settings.rounds}
                  players={revealData.players}
                  winnerId={revealData.winnerId}
                  lang={lang}
                />
              </div>
            )}

            {/* Hand Selection */}
            {myHand && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                <BattleHand
                  cards={myHand}
                  selectDeadline={selectDeadline}
                  onSelect={handleSelect}
                  lang={lang}
                  selectedIndex={selectedCardIndex}
                />
              </div>
            )}

            {/* Waiting for other players after selecting */}
            {!myHand && !revealData && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 py-16">
                <Loader2 className="mb-3 h-8 w-8 animate-spin text-yellow-400" />
                <p className="text-sm text-zinc-500">
                  {isDe ? "Warte auf andere Spieler..." : "Waiting for other players..."}
                </p>
              </div>
            )}
          </div>

          {/* Sidebar: Scoreboard */}
          <div className="w-full shrink-0 lg:w-[280px]">
            <BattleScoreboard
              players={battle.players.map((p) => ({
                userId: p.user._id,
                username: p.user.username,
                roundsWon: p.roundsWon,
              }))}
              currentRound={battle.currentRound}
              totalRounds={battle.settings.rounds}
              currentUserId={currentUserId}
              lang={lang}
            />
          </div>
        </div>
      )}

      {/* Finished / Cancelled */}
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

  return (
    <div className="flex flex-col items-center gap-8 py-8">
      {/* Victory / Defeat Banner */}
      <div className="text-center">
        {isDraw ? (
          <h1 className="text-3xl font-bold text-zinc-400">
            {isDe ? "Unentschieden!" : "Draw!"}
          </h1>
        ) : isWinner ? (
          <h1 className="text-3xl font-bold text-yellow-400">
            {isDe ? "Sieg!" : "Victory!"}
          </h1>
        ) : (
          <h1 className="text-3xl font-bold text-red-400">
            {isDe ? "Niederlage" : "Defeat"}
          </h1>
        )}

        {myEloChange && (
          <div className={`mt-2 text-lg font-bold ${myEloChange.change >= 0 ? "text-green-400" : "text-red-400"}`}>
            ELO: {myEloChange.oldElo} → {myEloChange.newElo} ({myEloChange.change >= 0 ? "+" : ""}
            {myEloChange.change})
          </div>
        )}
      </div>

      {/* Final Scores */}
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {isDe ? "Endstand" : "Final Scores"}
        </h3>
        {result.finalScores
          .sort((a, b) => b.roundsWon - a.roundsWon)
          .map((score, i) => {
            const player = battle.players.find((p) => p.user._id === score.player);
            const isMe = score.player === currentUserId;
            const eloChange = result.eloChanges.find((e) => e.player === score.player);
            return (
              <div
                key={score.player}
                className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                  isMe ? "bg-yellow-400/10" : i % 2 === 0 ? "bg-zinc-800/30" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 text-center text-xs text-zinc-600">#{i + 1}</span>
                  <span className={isMe ? "font-bold text-yellow-400" : "text-zinc-300"}>
                    {player?.user.username ?? "???"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-zinc-300">
                    {score.roundsWon} {isDe ? "Siege" : "Wins"}
                  </span>
                  {eloChange && (
                    <span className={`text-xs ${eloChange.change >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {eloChange.change >= 0 ? "+" : ""}{eloChange.change}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
      </div>

      {/* Transfers */}
      {result.transfers.length > 0 && (
        <div className="w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {isDe ? "Kartentransfers" : "Card Transfers"}
          </h3>
          {result.transfers.map((transfer, i) => {
            const fromPlayer = battle.players.find((p) => p.user._id === transfer.from);
            const toPlayer = battle.players.find((p) => p.user._id === transfer.to);
            return (
              <div key={i} className="mb-3 last:mb-0">
                <div className="mb-2 text-xs text-zinc-400">
                  {fromPlayer?.user.username ?? "?"} → {toPlayer?.user.username ?? "?"}
                </div>
                <div className="flex flex-wrap gap-2">
                  {transfer.cards.map((card, j) => (
                    <div
                      key={j}
                      className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1"
                    >
                      <img src={card.image} alt="" className="h-8 w-8 rounded object-cover" />
                      <div>
                        <div className="text-xs text-zinc-300">{card.name}</div>
                        <div className="text-[10px] text-yellow-400">{card.coinValue} Coins</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
