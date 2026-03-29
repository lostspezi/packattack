"use client";

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
}

interface Battle {
  _id: string;
  totalRounds: number;
  status: string;
}

interface BattleClashProps {
  battle: Battle;
  currentRound: number;
  rounds: Round[];
  players: BattlePlayer[];
  dict: Record<string, string>;
}

function getStreakCount(rounds: Round[], playerId: string): number {
  let streak = 0;
  for (let i = rounds.length - 1; i >= 0; i--) {
    if (rounds[i].winnerId === playerId) streak++;
    else break;
  }
  return streak;
}

export function BattleClash({ battle, currentRound, rounds, players, dict }: BattleClashProps) {
  const currentRoundData = rounds.find((r) => r.roundIndex === currentRound);
  const hasCards = currentRoundData && currentRoundData.cards.length > 0;
  const hasResult = currentRoundData?.winnerId !== undefined && currentRoundData?.winnerId !== null;

  return (
    <div className="space-y-4">
      {/* Round counter */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-text-primary">
          {dict.round || "Round"}{" "}
          <span className="text-pa-green">{currentRound + 1}</span>{" "}
          {dict.of || "of"}{" "}
          {battle.totalRounds}
        </h2>
        <span className="text-sm text-text-secondary">
          {battle.status === "opening" ? (dict.openingPacks || "Opening packs...") : ""}
        </span>
      </div>

      {/* Player cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {players.map((player, idx) => {
          const playerCard = currentRoundData?.cards.find((c) => c.player === player.user._id);
          const isWinner = hasResult && currentRoundData?.winnerId === player.user._id;
          const streak = getStreakCount(rounds, player.user._id);
          const onFire = streak >= 3;

          return (
            <Card
              key={player.user._id}
              variant="soft"
              className={[
                "flex flex-col items-center gap-3 p-4 transition-all duration-500",
                isWinner ? "border-pa-green/60 ring-2 ring-pa-green/30 bg-pa-green/5" : "",
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
                      🔥 {dict.onFire || "ON FIRE!"}
                    </p>
                  )}
                </div>
              </div>

              {/* Card flip */}
              <CardFlip
                card={
                  playerCard
                    ? { name: playerCard.card.name, image: playerCard.card.image, rarity: playerCard.rarity, coinValue: playerCard.coinValue }
                    : { name: "?", rarity: "Common", coinValue: 0 }
                }
                revealed={!!hasCards}
                delay={idx * 200}
              />

              {/* Winner badge */}
              {isWinner && (
                <span className="rounded border border-pa-green/30 bg-pa-green/10 px-2 py-0.5 text-[10px] font-bold text-pa-green">
                  ✓ {dict.winner || "Winner"}
                </span>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
