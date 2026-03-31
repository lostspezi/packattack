"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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

        case "round_start":
          setRevealData(null);
          setSelectedCardIndex(null);
          if (event.data.hand) {
            setMyHand(event.data.hand as VirtualCard[]);
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
            player: string;
            playerId?: string;
            username?: string;
            card: { name: string; image: string; coinValue: number };
          }[];
          setBattle((prev) => {
            if (!prev) return prev;
            const playerNameMap = new Map(prev.players.map((p) => [String(p.user._id), p.user.username]));
            setRevealData({
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
            });
            return prev;
          });
          setMyHand(null);
          // Update scores from event or refetch
          if (event.data.scores) {
            const scores = event.data.scores as Record<string, number>;
            setBattle((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                players: prev.players.map((p) => ({
                  ...p,
                  roundsWon: scores[String(p.user._id)] ?? p.roundsWon,
                })),
              };
            });
          } else {
            // Refetch to get updated scores when not included in event
            fetchBattle();
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
  const playerNameMap = new Map(battle.players.map((p) => [String(p.user._id), p.user.username]));

  // Sorted scores for podium (winner first)
  const sortedScores = [...result.finalScores].sort((a, b) => b.roundsWon - a.roundsWon);

  return (
    <div className="flex flex-col gap-4">
      {/* Victory / Defeat Banner — compact */}
      <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 px-3 py-4 text-center sm:rounded-2xl sm:px-5 sm:py-5">
        <div
          className={`absolute inset-0 opacity-[0.07] ${
            isDraw ? "bg-zinc-400" : isWinner ? "bg-yellow-400" : "bg-red-400"
          }`}
          style={{ filter: "blur(80px)" }}
        />
        <div className="relative">
          <div className="text-3xl sm:text-4xl">{isDraw ? "🤝" : isWinner ? "🏆" : "⚔️"}</div>
          <h1
            className={`mt-1 text-xl font-extrabold sm:text-2xl ${
              isDraw
                ? "text-zinc-300"
                : isWinner
                  ? "bg-gradient-to-r from-yellow-300 to-amber-500 bg-clip-text text-transparent"
                  : "text-red-400"
            }`}
          >
            {isDraw
              ? isDe ? "Unentschieden!" : "Draw!"
              : isWinner
                ? isDe ? "Sieg!" : "Victory!"
                : isDe ? "Niederlage" : "Defeat"}
          </h1>
          {myEloChange && (
            <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1 text-xs sm:gap-1.5 sm:text-sm">
              <span className="text-zinc-500">ELO</span>
              <span className="font-bold text-zinc-400">{myEloChange.oldElo}</span>
              <span className="text-zinc-600">→</span>
              <span className="font-bold text-zinc-100">{myEloChange.newElo}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                  myEloChange.change >= 0
                    ? "bg-green-400/10 text-green-400"
                    : "bg-red-400/10 text-red-400"
                }`}
              >
                {myEloChange.change >= 0 ? "+" : ""}
                {myEloChange.change}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Podium */}
      <div className="flex items-end justify-center gap-2 sm:gap-4">
        {(() => {
          const podiumOrder = sortedScores.length <= 2
            ? sortedScores
            : [sortedScores[1], sortedScores[0], sortedScores[2], ...sortedScores.slice(3)];
          const podiumHeights = sortedScores.length <= 2
            ? ["h-24 sm:h-32", "h-16 sm:h-24"]
            : ["h-16 sm:h-24", "h-24 sm:h-36", "h-12 sm:h-20"];

          return podiumOrder.map((score, podIdx) => {
            const rank = sortedScores.indexOf(score);
            const player = battle.players.find((p) => String(p.user._id) === String(score.player));
            const isMe = String(score.player) === currentUserId;
            const eloChange = result.eloChanges.find((e) => String(e.player) === String(score.player));
            const isChamp = rank === 0;
            const podiumH = podiumHeights[podIdx] ?? "h-10 sm:h-16";

            return (
              <div key={String(score.player)} className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
                <div className={`max-w-full truncate text-[11px] font-bold sm:text-xs ${isMe ? "text-yellow-400" : "text-zinc-300"}`}>
                  {player?.user.username ?? "???"}
                </div>
                <div className="flex items-baseline gap-0.5">
                  <span className={`font-extrabold ${isChamp ? "text-lg text-yellow-400 sm:text-xl" : "text-base text-zinc-300 sm:text-lg"}`}>
                    {score.roundsWon}
                  </span>
                  <span className="text-[8px] uppercase text-zinc-500 sm:text-[9px]">{isDe ? "Siege" : "Wins"}</span>
                </div>
                {eloChange && (
                  <span className={`text-[9px] font-bold sm:text-[10px] ${eloChange.change >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {eloChange.change >= 0 ? "+" : ""}{eloChange.change}
                  </span>
                )}
                <div
                  className={`flex w-full max-w-[100px] items-start justify-center rounded-t-lg sm:max-w-[120px] ${podiumH} ${
                    isChamp
                      ? "border border-b-0 border-yellow-400/30 bg-gradient-to-t from-yellow-400/20 to-yellow-400/5"
                      : rank === 1
                        ? "border border-b-0 border-zinc-600/30 bg-gradient-to-t from-zinc-600/20 to-zinc-600/5"
                        : "border border-b-0 border-amber-700/30 bg-gradient-to-t from-amber-700/20 to-amber-700/5"
                  }`}
                >
                  <span className="mt-1.5 text-base sm:mt-2 sm:text-lg">
                    {isChamp ? "🥇" : rank === 1 ? "🥈" : "🥉"}
                  </span>
                </div>
              </div>
            );
          });
        })()}
      </div>

      {/* CTAs */}
      <div className="flex gap-2">
        <a
          href={`/${lang}/battles`}
          className="flex-1 rounded-lg border border-yellow-400/30 bg-yellow-400/10 py-2.5 text-center text-sm font-bold text-yellow-400 transition-colors hover:bg-yellow-400/20"
        >
          {isDe ? "Neues Battle" : "New Battle"}
        </a>
        <a
          href={`/${lang}/battles`}
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 py-2.5 text-center text-sm font-bold text-zinc-300 transition-colors hover:bg-zinc-700"
        >
          {isDe ? "Zur Lobby" : "Back to Lobby"}
        </a>
      </div>

      {/* Round History */}
      {battle.rounds.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {isDe ? "Rundenverlauf" : "Round History"}
          </h3>
          <div className="overflow-hidden rounded-xl border border-zinc-800">
            {battle.rounds
              .filter((r) => r.status === "completed" || r.status === "revealing")
              .map((round, idx) => {
                const roundWinnerId = round.winner ? String(round.winner) : null;
                return (
                  <div
                    key={round.roundNumber}
                    className={`p-2.5 sm:p-3 lg:px-5 ${
                      idx > 0 ? "border-t border-zinc-800" : ""
                    } ${roundWinnerId ? "bg-zinc-900/60" : "bg-zinc-900/30"}`}
                  >
                    {/* Round label + winner */}
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-zinc-500">
                        {isDe ? "Runde" : "Round"} {round.roundNumber}
                        {round.roundNumber > battle.settings.rounds && (
                          <span className="ml-1 text-yellow-400">SD</span>
                        )}
                      </span>
                      <span className={`text-[11px] font-bold ${roundWinnerId ? "text-yellow-400" : "text-zinc-600"}`}>
                        {roundWinnerId
                          ? `👑 ${playerNameMap.get(roundWinnerId) ?? "???"}`
                          : isDe ? "Gleich" : "Tie"}
                      </span>
                    </div>

                    {/* Player cards — always stacked on mobile */}
                    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                      {round.hands.map((hand, hIdx) => {
                        const playerId = String(hand.player);
                        const username = playerNameMap.get(playerId) ?? "???";
                        const isMe = playerId === currentUserId;
                        const isRoundWinner = playerId === roundWinnerId;
                        const selectedCard =
                          hand.selectedCardIndex !== null && hand.selectedCardIndex >= 0
                            ? hand.cards[hand.selectedCardIndex]
                            : null;

                        return (
                          <React.Fragment key={playerId}>
                            {hIdx > 0 && (
                              <span className="hidden text-[10px] font-bold text-zinc-600 sm:block">vs</span>
                            )}
                            <div className={`flex flex-1 items-center gap-2 rounded-lg border p-1.5 ${
                              isRoundWinner
                                ? "border-yellow-400/20 bg-yellow-400/5"
                                : "border-zinc-800 bg-zinc-800/20"
                            }`}>
                              {selectedCard && selectedCard.cardId ? (
                                <img
                                  src={selectedCard.image}
                                  alt=""
                                  className={`h-10 w-7 shrink-0 rounded border object-cover ${
                                    isRoundWinner ? "border-yellow-400/50" : "border-zinc-700"
                                  }`}
                                />
                              ) : (
                                <div className="flex h-10 w-7 shrink-0 items-center justify-center rounded border border-zinc-700 bg-zinc-800 text-[10px] text-zinc-600">
                                  ?
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className={`truncate text-[11px] font-bold ${isMe ? "text-yellow-400" : "text-zinc-300"}`}>
                                  {username} {isRoundWinner && "👑"}
                                </div>
                                {selectedCard && selectedCard.cardId && (
                                  <div className="flex items-baseline justify-between gap-1">
                                    <span className="min-w-0 truncate text-[10px] text-zinc-500">
                                      {selectedCard.name}
                                    </span>
                                    <span className={`shrink-0 text-[10px] font-bold ${isRoundWinner ? "text-yellow-400" : "text-zinc-400"}`}>
                                      {selectedCard.coinValue}
                                    </span>
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
        </div>
      )}

      {/* Received Cards Summary */}
      {result.transfers.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {isDe ? "Erhaltene Karten" : "Cards Received"}
          </h3>
          <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:gap-3">
            {result.transfers.map((transfer, i) => {
              const toPlayer = battle.players.find((p) => String(p.user._id) === String(transfer.to));
              const isMe = String(transfer.to) === currentUserId;
              const totalValue = transfer.cards.reduce((sum, c) => sum + c.coinValue, 0);
              return (
                <div
                  key={i}
                  className={`rounded-xl border p-2.5 sm:p-3 ${
                    isMe ? "border-yellow-400/20 bg-yellow-400/5" : "border-zinc-800 bg-zinc-900"
                  }`}
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className={`text-xs font-bold sm:text-sm ${isMe ? "text-yellow-400" : "text-zinc-300"}`}>
                      {toPlayer?.user.username ?? "???"}
                    </span>
                    <span className="text-xs font-bold text-yellow-400 sm:text-sm">
                      {totalValue} Coins
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {transfer.cards.map((card, j) => (
                      <div
                        key={j}
                        className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/80 p-1.5"
                      >
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
        </div>
      )}
    </div>
  );
}
