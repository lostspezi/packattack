"use client";

import React, { useState, useEffect } from "react";
import { GiLaurelCrown } from "react-icons/gi";

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
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    const flipTimer = setTimeout(() => setFlipped(true), 600);
    const resultTimer = setTimeout(() => setShowResult(true), 1400);
    return () => { clearTimeout(flipTimer); clearTimeout(resultTimer); };
  }, []);

  const isTie = winnerId === null;

  return (
    <div className="flex flex-col items-center gap-4">
      <style>{`
        @keyframes revealSlam {
          0% { transform: rotateY(180deg) scale(1); }
          60% { transform: rotateY(180deg) scale(1.08); }
          100% { transform: rotateY(180deg) scale(1); }
        }
      `}</style>

      {/* Round label */}
      <div className="text-[11px] uppercase tracking-widest text-zinc-500">
        {isDe ? "Runde" : "Round"} {roundNumber}/{totalRounds}
      </div>

      {/* Cards on table */}
      <div className="flex items-center justify-center gap-4 sm:gap-8">
        {players.map((player) => {
          const isWinner = player.userId === winnerId;
          return (
            <div key={player.userId} className="flex flex-col items-center gap-2">
              {/* Player name */}
              <span className={`text-xs font-bold ${isWinner && showResult ? "text-yellow-400" : "text-zinc-400"}`}>
                {player.username}
                {isWinner && showResult && <GiLaurelCrown className="ml-1 inline h-3 w-3 text-yellow-400" />}
              </span>

              {/* Flip card */}
              <div
                className="relative"
                style={{
                  perspective: "800px",
                  width: "clamp(100px, 22vw, 160px)",
                  aspectRatio: "2/3",
                }}
              >
                <div
                  className="relative h-full w-full"
                  style={{
                    transformStyle: "preserve-3d",
                    transition: "transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)",
                    transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                    animation: flipped ? "revealSlam 0.4s ease-out 0.7s" : undefined,
                  }}
                >
                  {/* Back */}
                  <div
                    className="absolute inset-0 overflow-hidden rounded-lg border-2 border-zinc-700"
                    style={{ backfaceVisibility: "hidden" }}
                  >
                    <img src="/images/card-back.jpg" alt="" className="h-full w-full object-cover" draggable={false} />
                  </div>

                  {/* Front */}
                  <div
                    className={`absolute inset-0 overflow-hidden rounded-lg border-2 ${
                      isWinner && showResult
                        ? "border-yellow-400 shadow-[0_0_24px_rgba(250,204,21,0.35)]"
                        : "border-zinc-600"
                    }`}
                    style={{
                      backfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                    }}
                  >
                    <img src={player.card.image} alt={player.card.name} className="h-full w-full object-cover" draggable={false} />
                  </div>
                </div>
              </div>

              {/* Coin value */}
              <div
                className={`text-sm font-bold transition-all duration-500 ${
                  showResult ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                } ${isWinner ? "text-yellow-400" : "text-zinc-500"}`}
              >
                {player.card.coinValue} Coins
              </div>
            </div>
          );
        })}
      </div>

      {/* Result announcement */}
      <div className={`transition-all duration-500 ${showResult ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}>
        {isTie ? (
          <span className="text-sm font-bold text-zinc-500">{isDe ? "Gleichstand" : "Tie"}</span>
        ) : (
          <span className="text-sm font-bold text-yellow-400">
            {players.find((p) => p.userId === winnerId)?.username} {isDe ? "gewinnt die Runde!" : "wins the round!"}
          </span>
        )}
      </div>
    </div>
  );
}
