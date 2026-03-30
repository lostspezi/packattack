"use client";

import { useState, useEffect } from "react";
import { Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CardFlip } from "./card-flip";

interface RoundCard {
  player: string;
  card: { _id: string; name: string; image?: string };
  rarity: string;
  coinValue: number;
}

interface Round {
  roundIndex: number;
  cards: RoundCard[];
  winnerId: string | null;
  revealedAt: string | null;
}

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

interface HandCard {
  index: number;
  card: string;
  coinValue: number;
  rarity: string;
  name: string;
  image: string;
}

interface PlayedCard {
  playerId: string;
  card: { _id: string; name: string; image: string };
  coinValue: number;
  rarity: string;
  effectTier: string;
}

interface Battle {
  _id: string;
  totalRounds: number;
  status: string;
  players: BattlePlayer[];
}

interface BattleClashProps {
  battle: Battle;
  currentRound: number;
  rounds: Round[];
  players: BattlePlayer[];
  dict: Record<string, string>;
  revealedCards: Record<string, RoundCard>;
  roundAnnounce: { roundIndex: number; revealOrder: string[] } | null;
  roundResult: { winnerId: string | null; isClose: boolean } | null;
  handCards: HandCard[] | null;
  selectedCardIndex: number | null;
  playersSelected: Set<string>;
  revealedPlayedCards: PlayedCard[] | null;
  onSelectCard: (cardIndex: number) => void;
  isPlayer: boolean;
}

function getStreakCount(rounds: Round[], playerId: string): number {
  let streak = 0;
  for (let i = rounds.length - 1; i >= 0; i--) {
    if (rounds[i].winnerId === playerId) streak++;
    else break;
  }
  return streak;
}

export function BattleClash({
  battle,
  currentRound,
  rounds,
  players,
  dict,
  revealedCards,
  roundAnnounce,
  roundResult,
  handCards,
  selectedCardIndex,
  playersSelected,
  revealedPlayedCards,
  onSelectCard,
  isPlayer,
}: BattleClashProps) {
  const [showAnnounce, setShowAnnounce] = useState(false);
  const [spotlightIndex, setSpotlightIndex] = useState<number | null>(null);

  const isAnnouncing = roundAnnounce !== null && roundAnnounce.roundIndex === currentRound;
  const hasResult = roundResult !== null;
  const isDraw = hasResult && roundResult.winnerId === null;
  const winnerId = roundResult?.winnerId ?? null;
  const isClose = roundResult?.isClose ?? false;

  // Show round announcement animation
  useEffect(() => {
    if (!isAnnouncing) return;
    setShowAnnounce(true);
    const t = setTimeout(() => setShowAnnounce(false), 2500);
    return () => clearTimeout(t);
  }, [isAnnouncing, roundAnnounce?.roundIndex]);

  // Close-match spotlight animation
  useEffect(() => {
    if (!hasResult || !isClose || isDraw) {
      setSpotlightIndex(null);
      return;
    }
    // Cycle spotlight between top players
    const topPlayers = players
      .filter((p) => revealedCards[p.user._id])
      .map((p) => p.user._id);
    if (topPlayers.length < 2) return;

    let i = 0;
    setSpotlightIndex(0);
    const iv = setInterval(() => {
      i++;
      if (i >= 8) {
        clearInterval(iv);
        setSpotlightIndex(null);
        return;
      }
      setSpotlightIndex(i % topPlayers.length);
    }, 400);
    return () => clearInterval(iv);
  }, [hasResult, isClose, isDraw]); // eslint-disable-line react-hooks/exhaustive-deps

  // Determine display order: use reveal order if available, else player order
  const displayOrder = roundAnnounce?.revealOrder ?? players.map((p) => p.user._id);

  return (
    <div className="relative space-y-4">
      {/* Round announcement overlay */}
      {showAnnounce && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[14px] bg-bg/80 backdrop-blur-sm">
          <div className="text-center animate-in zoom-in-50 duration-500">
            <p className="text-sm font-medium text-text-secondary uppercase tracking-widest">
              {dict["round"] ?? "Runde"}
            </p>
            <p className="text-7xl font-black text-pa-green tabular-nums">
              {currentRound + 1}
            </p>
            <p className="text-sm text-text-secondary">
              {dict["of"] ?? "von"} {battle.totalRounds}
            </p>
          </div>
        </div>
      )}

      {/* Round counter */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-text-primary">
          {dict["round"] ?? "Runde"}{" "}
          <span className="text-pa-green">{currentRound + 1}</span>{" "}
          {dict["of"] ?? "von"}{" "}
          {battle.totalRounds}
        </h2>
        {isDraw && (
          <span className="rounded border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-sm font-bold text-yellow-400 animate-pulse">
            {dict["draw"] ?? "Unentschieden!"}
          </span>
        )}
      </div>

      {/* Player cards grid — ordered by reveal order */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {displayOrder.map((playerId) => {
          const player = players.find((p) => p.user._id === playerId);
          if (!player) return null;

          const playerCard = revealedCards[playerId];
          const isRevealed = !!playerCard;
          const isWinner = hasResult && winnerId === playerId;
          const isLoser = hasResult && winnerId !== null && winnerId !== playerId;
          const streak = getStreakCount(rounds, playerId);
          const onFire = streak >= 3;

          // Close-match spotlight: highlight the player the spotlight is on
          const isSpotlit = spotlightIndex !== null && displayOrder[spotlightIndex % displayOrder.length] === playerId;

          return (
            <Card
              key={playerId}
              variant="soft"
              className={[
                "flex flex-col items-center gap-3 p-4 transition-all duration-500",
                isWinner ? "border-pa-green/60 ring-2 ring-pa-green/30 bg-pa-green/5 scale-105" : "",
                isLoser ? "opacity-50 grayscale" : "",
                isDraw && hasResult ? "border-yellow-500/40 ring-1 ring-yellow-500/20" : "",
                isSpotlit ? "ring-2 ring-yellow-400/60 bg-yellow-400/5 scale-105" : "",
              ].join(" ")}
            >
              {/* Player header */}
              <div className="flex items-center gap-2 self-start">
                {player.user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={player.user.image}
                    alt={player.user.name}
                    className="h-7 w-7 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-pa-lila/30">
                    <Users className="h-4 w-4 text-text-secondary" />
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold text-text-primary">
                    {player.user.username ?? player.user.name}
                  </p>
                  {onFire && (
                    <p className="text-[10px] font-bold text-orange-400 animate-pulse">
                      🔥 {dict["onFire"] ?? "ON FIRE!"}
                    </p>
                  )}
                </div>
              </div>

              {/* Card flip */}
              <CardFlip
                key={`round-${currentRound}-${playerId}`}
                card={
                  playerCard
                    ? { name: playerCard.card.name, image: playerCard.card.image, rarity: playerCard.rarity, coinValue: playerCard.coinValue }
                    : { name: "?", rarity: "Common", coinValue: 0 }
                }
                revealed={isRevealed}
                delay={0}
              />

              {/* Winner badge */}
              {isWinner && (
                <span className="rounded border border-pa-green/30 bg-pa-green/10 px-2 py-0.5 text-[10px] font-bold text-pa-green animate-in zoom-in-75 duration-300">
                  ✓ {dict["winner"] ?? "Gewinner"}
                </span>
              )}

              {/* Draw badge */}
              {isDraw && hasResult && (
                <span className="rounded border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-[10px] font-bold text-yellow-400">
                  = {dict["draw"] ?? "Unentschieden"}
                </span>
              )}
            </Card>
          );
        })}
      </div>

      {/* Card Selection Hand */}
      {isPlayer && handCards && (
        <div className="mt-6 space-y-3">
          <p className="text-center text-sm text-text-secondary tracking-widest uppercase">
            {selectedCardIndex !== null
              ? `Karte gewählt — Warte auf Gegner... (${playersSelected.size}/${battle.players.length})`
              : "Wähle eine Karte"}
          </p>
          <div className="flex justify-center gap-3">
            {handCards.map((card) => (
              <button
                key={card.index}
                onClick={() => onSelectCard(card.index)}
                disabled={selectedCardIndex !== null}
                className={`
                  relative w-20 rounded-lg border-2 p-3 text-center transition-all
                  ${selectedCardIndex === card.index
                    ? "border-pa-green -translate-y-3 shadow-[0_0_20px_rgba(155,255,0,0.3)]"
                    : selectedCardIndex !== null
                      ? "border-white/10 opacity-40"
                      : "border-white/10 hover:border-pa-green/50 hover:-translate-y-1 cursor-pointer"
                  }
                `}
              >
                <div className="text-xs text-text-secondary">{card.rarity}</div>
                <div className="mt-1 text-lg font-bold text-pa-green">
                  {Math.round(card.coinValue)} <span className="text-xs font-normal">Coins</span>
                </div>
                <div className="mt-1 truncate text-xs text-text-secondary">{card.name}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Revealed Cards (after all players selected) */}
      {revealedPlayedCards && (
        <div className="mt-6 space-y-3">
          <div className="flex justify-center items-center gap-6">
            {revealedPlayedCards.map((card, i) => (
              <div key={i} className="text-center">
                <div className="text-xs text-text-secondary mb-1">
                  {battle.players.find(p => p.user._id === card.playerId)?.user.name ?? "Player"}
                </div>
                <div className={`
                  w-20 rounded-lg border-2 p-3
                  ${card.effectTier === "extreme" ? "border-yellow-400 shadow-[0_0_30px_rgba(255,215,0,0.4)]" :
                    card.effectTier === "high" ? "border-purple-400 shadow-[0_0_20px_rgba(200,100,255,0.3)]" :
                    card.effectTier === "medium" ? "border-pa-green shadow-[0_0_15px_rgba(155,255,0,0.2)]" :
                    "border-white/20"}
                `}>
                  <div className="text-lg font-bold" style={{
                    color: card.effectTier === "extreme" ? "#ffd54f" :
                           card.effectTier === "high" ? "#c864ff" :
                           "#9BFF00"
                  }}>
                    {Math.round(card.coinValue)} <span className="text-xs font-normal opacity-70">Coins</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
