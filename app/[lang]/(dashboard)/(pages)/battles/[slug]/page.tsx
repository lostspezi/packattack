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

  return (
    <div className="flex flex-col items-center gap-6 py-6">
      {/* Victory / Defeat Banner */}
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 px-6 py-10 text-center">
        {/* Background glow */}
        <div
          className={`absolute inset-0 opacity-10 ${
            isDraw ? "bg-zinc-400" : isWinner ? "bg-yellow-400" : "bg-red-400"
          }`}
          style={{ filter: "blur(60px)" }}
        />
        <div className="relative">
          {isDraw ? (
            <>
              <div className="mb-2 text-5xl">🤝</div>
              <h1 className="text-3xl font-extrabold text-zinc-300">
                {isDe ? "Unentschieden!" : "Draw!"}
              </h1>
            </>
          ) : isWinner ? (
            <>
              <div className="mb-2 text-5xl">🏆</div>
              <h1 className="bg-gradient-to-r from-yellow-300 to-amber-500 bg-clip-text text-4xl font-extrabold text-transparent">
                {isDe ? "Sieg!" : "Victory!"}
              </h1>
            </>
          ) : (
            <>
              <div className="mb-2 text-5xl">⚔️</div>
              <h1 className="text-3xl font-extrabold text-red-400">
                {isDe ? "Niederlage" : "Defeat"}
              </h1>
            </>
          )}

          {myEloChange && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="text-sm text-zinc-500">ELO</span>
              <span className="text-lg font-bold text-zinc-300">{myEloChange.oldElo}</span>
              <span className="text-zinc-600">→</span>
              <span className="text-lg font-bold text-zinc-100">{myEloChange.newElo}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-sm font-bold ${
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

      {/* Player Scores */}
      <div className="flex w-full max-w-2xl gap-3">
        {result.finalScores
          .sort((a, b) => b.roundsWon - a.roundsWon)
          .map((score, i) => {
            const player = battle.players.find((p) => String(p.user._id) === String(score.player));
            const isMe = String(score.player) === currentUserId;
            const eloChange = result.eloChanges.find((e) => String(e.player) === String(score.player));
            const isFirst = i === 0;
            return (
              <div
                key={String(score.player)}
                className={`flex flex-1 flex-col items-center rounded-xl border p-4 ${
                  isFirst
                    ? "border-yellow-400/30 bg-yellow-400/5"
                    : "border-zinc-800 bg-zinc-900"
                }`}
              >
                <div className="mb-1 text-2xl">{isFirst ? "👑" : `#${i + 1}`}</div>
                <div className={`text-sm font-bold ${isMe ? "text-yellow-400" : "text-zinc-200"}`}>
                  {player?.user.username ?? "???"}
                </div>
                <div className="mt-1 text-2xl font-extrabold text-zinc-100">
                  {score.roundsWon}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                  {isDe ? "Siege" : "Wins"}
                </div>
                {eloChange && (
                  <div
                    className={`mt-1 text-xs font-bold ${
                      eloChange.change >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {eloChange.change >= 0 ? "+" : ""}
                    {eloChange.change} ELO
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Round History */}
      {battle.rounds.length > 0 && (
        <div className="w-full max-w-2xl">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {isDe ? "Rundenverlauf" : "Round History"}
          </h3>
          <div className="flex flex-col gap-2">
            {battle.rounds
              .filter((r) => r.status === "completed" || r.status === "revealing")
              .map((round) => {
                const roundWinnerId = round.winner ? String(round.winner) : null;
                return (
                  <div
                    key={round.roundNumber}
                    className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"
                  >
                    {/* Round header */}
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                        {isDe ? "Runde" : "Round"} {round.roundNumber}
                        {round.roundNumber > battle.settings.rounds && (
                          <span className="ml-2 text-yellow-400">Sudden Death</span>
                        )}
                      </span>
                      {roundWinnerId && (
                        <span className="rounded-full bg-yellow-400/10 px-2 py-0.5 text-[10px] font-bold text-yellow-400">
                          👑 {playerNameMap.get(roundWinnerId) ?? "???"}
                        </span>
                      )}
                      {!roundWinnerId && round.status === "completed" && (
                        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-500">
                          {isDe ? "Gleichstand" : "Tie"}
                        </span>
                      )}
                    </div>

                    {/* Player cards side by side */}
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-2">
                      {round.hands.map((hand) => {
                        const playerId = String(hand.player);
                        const username = playerNameMap.get(playerId) ?? "???";
                        const isMe = playerId === currentUserId;
                        const isRoundWinner = playerId === roundWinnerId;
                        const selectedCard =
                          hand.selectedCardIndex !== null && hand.selectedCardIndex >= 0
                            ? hand.cards[hand.selectedCardIndex]
                            : null;

                        return (
                          <div
                            key={playerId}
                            className={`flex flex-col items-center rounded-lg border p-3 ${
                              isRoundWinner
                                ? "border-yellow-400/30 bg-yellow-400/5"
                                : "border-zinc-800 bg-zinc-800/30"
                            }`}
                          >
                            <div className={`mb-2 text-xs font-bold ${isMe ? "text-yellow-400" : "text-zinc-400"}`}>
                              {username} {isRoundWinner && "👑"}
                            </div>
                            {selectedCard && selectedCard.cardId ? (
                              <div className="flex flex-col items-center gap-1.5">
                                <img
                                  src={selectedCard.image}
                                  alt={selectedCard.name}
                                  className={`h-24 w-auto rounded-lg border-2 object-cover ${
                                    isRoundWinner ? "border-yellow-400/50" : "border-zinc-700"
                                  }`}
                                />
                                <div className="max-w-[140px] truncate text-center text-[11px] text-zinc-300">
                                  {selectedCard.name}
                                </div>
                                <div className="text-xs font-bold text-yellow-400">
                                  {selectedCard.coinValue} Coins
                                </div>
                              </div>
                            ) : (
                              <div className="flex h-24 w-16 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800">
                                <span className="text-lg text-zinc-600">?</span>
                              </div>
                            )}
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

      {/* Received Cards Summary (snake_draft) */}
      {result.transfers.length > 0 && (
        <div className="w-full max-w-2xl">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {isDe ? "Erhaltene Karten" : "Cards Received"}
          </h3>
          <div className="flex flex-col gap-3">
            {result.transfers.map((transfer, i) => {
              const toPlayer = battle.players.find((p) => String(p.user._id) === String(transfer.to));
              const isMe = String(transfer.to) === currentUserId;
              const totalValue = transfer.cards.reduce((sum, c) => sum + c.coinValue, 0);
              return (
                <div
                  key={i}
                  className={`rounded-xl border p-4 ${
                    isMe ? "border-yellow-400/20 bg-yellow-400/5" : "border-zinc-800 bg-zinc-900"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className={`text-sm font-bold ${isMe ? "text-yellow-400" : "text-zinc-300"}`}>
                      {toPlayer?.user.username ?? "???"}
                    </span>
                    <span className="text-xs font-bold text-yellow-400">
                      {totalValue} Coins
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {transfer.cards.map((card, j) => (
                      <div
                        key={j}
                        className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2 py-1.5"
                      >
                        <img src={card.image} alt="" className="h-9 w-9 rounded object-cover" />
                        <div>
                          <div className="max-w-[120px] truncate text-xs text-zinc-300">{card.name}</div>
                          <div className="text-[10px] font-bold text-yellow-400">{card.coinValue} Coins</div>
                        </div>
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
