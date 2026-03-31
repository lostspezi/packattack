"use client";

import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface VirtualCard {
  cardId: string | null;
  name: string;
  image: string;
  rarity: string;
  coinValue: number;
}

interface BattleHandProps {
  cards: VirtualCard[];
  selectDeadline: string | null;
  onSelect: (index: number) => void;
  lang: string;
  disabled?: boolean;
  selectedIndex?: number | null;
}

export function BattleHand({
  cards,
  selectDeadline,
  onSelect,
  lang,
  disabled,
  selectedIndex,
}: BattleHandProps) {
  const isDe = lang === "de";
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    if (!selectDeadline) return;
    const interval = setInterval(() => {
      const left = Math.max(0, Math.ceil((new Date(selectDeadline).getTime() - Date.now()) / 1000));
      setTimeLeft(left);
    }, 200);
    return () => clearInterval(interval);
  }, [selectDeadline]);

  const hasSelected = selectedIndex !== null && selectedIndex !== undefined;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Timer */}
      <div className="flex items-center gap-2 text-sm">
        <Clock className={`h-4 w-4 ${timeLeft <= 5 ? "text-red-400" : "text-zinc-400"}`} />
        <span className={`font-bold ${timeLeft <= 5 ? "text-red-400" : timeLeft <= 10 ? "text-yellow-400" : "text-zinc-300"}`}>
          {timeLeft}s
        </span>
        <span className="text-zinc-500">
          {hasSelected
            ? isDe ? "— Karte gewählt" : "— Card selected"
            : isDe ? "— Wähle eine Karte" : "— Pick a card"}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-wrap justify-center gap-3">
        {cards.map((card, idx) => {
          const isSelected = selectedIndex === idx;
          return (
            <button
              key={idx}
              onClick={() => onSelect(idx)}
              disabled={disabled || hasSelected}
              className={`group relative flex w-[140px] flex-col overflow-hidden rounded-xl border-2 transition-all sm:w-[160px] ${
                isSelected
                  ? "scale-105 border-yellow-400 shadow-lg shadow-yellow-400/20"
                  : hasSelected
                    ? "border-zinc-800 opacity-50"
                    : "border-zinc-700 hover:border-zinc-500 hover:shadow-md"
              } ${!hasSelected && !disabled ? "cursor-pointer" : ""}`}
            >
              {/* Card Image */}
              <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-900">
                <img
                  src={card.image}
                  alt={card.name}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
                {isSelected && (
                  <div className="absolute inset-0 flex items-center justify-center bg-yellow-400/20">
                    <div className="rounded-full bg-yellow-400 px-3 py-1 text-xs font-bold text-black">
                      {isDe ? "Gewählt" : "Selected"}
                    </div>
                  </div>
                )}
              </div>

              {/* Card Info */}
              <div className="bg-zinc-900 p-2 text-center">
                <div className="truncate text-xs font-medium text-zinc-300">{card.name}</div>
                <div className="mt-0.5 text-sm font-bold text-yellow-400">{card.coinValue} Coins</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
