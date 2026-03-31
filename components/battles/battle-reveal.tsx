"use client";

import React, { useState, useEffect } from "react";
import { Trophy, Minus } from "lucide-react";

interface RevealCard {
  name: string;
  image: string;
  coinValue: number;
}

interface RevealPlayer {
  userId: string;
  username: string;
  card: RevealCard;
}

interface BattleRevealProps {
  roundNumber: number;
  totalRounds: number;
  players: RevealPlayer[];
  winnerId: string | null;
  lang: string;
}

export function BattleReveal({ roundNumber, totalRounds, players, winnerId, lang }: BattleRevealProps) {
  const isDe = lang === "de";
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setFlipped(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const isTie = winnerId === null;

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Round Header */}
      <div className="text-center">
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {isDe ? "Runde" : "Round"} {roundNumber}/{totalRounds}
        </div>
        {isTie ? (
          <div className="mt-1 flex items-center gap-1 text-sm font-bold text-zinc-400">
            <Minus className="h-4 w-4" />
            {isDe ? "Gleichstand!" : "Tie!"}
          </div>
        ) : (
          <div className="mt-1 flex items-center gap-1 text-sm font-bold text-yellow-400">
            <Trophy className="h-4 w-4" />
            {players.find((p) => p.userId === winnerId)?.username} {isDe ? "gewinnt!" : "wins!"}
          </div>
        )}
      </div>

      {/* Cards Reveal */}
      <div className="flex flex-wrap justify-center gap-4">
        {players.map((player) => {
          const isWinner = player.userId === winnerId;
          return (
            <div key={player.userId} className="flex flex-col items-center gap-2">
              <div className={`text-xs font-bold ${isWinner ? "text-yellow-400" : "text-zinc-400"}`}>
                {player.username}
              </div>

              {/* Card with flip animation */}
              <div
                className="relative h-[210px] w-[140px] sm:h-[240px] sm:w-[160px]"
                style={{ perspective: "600px" }}
              >
                <div
                  className="relative h-full w-full transition-transform duration-700"
                  style={{
                    transformStyle: "preserve-3d",
                    transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                  }}
                >
                  {/* Card Back */}
                  <div
                    className="absolute inset-0 rounded-xl border-2 border-zinc-700 overflow-hidden"
                    style={{ backfaceVisibility: "hidden" }}
                  >
                    <img
                      src="/images/card-back.jpg"
                      alt="Card Back"
                      className="h-full w-full object-cover"
                    />
                  </div>

                  {/* Card Front */}
                  <div
                    className={`absolute inset-0 rounded-xl border-2 overflow-hidden ${
                      isWinner ? "border-yellow-400 shadow-lg shadow-yellow-400/20" : "border-zinc-600"
                    }`}
                    style={{
                      backfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                    }}
                  >
                    <img
                      src={player.card.image}
                      alt={player.card.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
              </div>

              {/* Card Value (shown after flip) */}
              <div
                className={`text-sm font-bold transition-opacity duration-500 ${
                  flipped ? "opacity-100" : "opacity-0"
                } ${isWinner ? "text-yellow-400" : "text-zinc-400"}`}
              >
                {player.card.coinValue} Coins
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
