"use client";

import React, { useState, useEffect } from "react";
import { GiSandsOfTime } from "react-icons/gi";

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
    }, 1000);
    return () => clearInterval(interval);
  }, [selectDeadline]);

  const hasSelected = selectedIndex !== null && selectedIndex !== undefined;
  const total = cards.length;
  // Fan angles: spread cards in an arc
  const maxFanAngle = total <= 3 ? 6 : total <= 5 ? 10 : 14;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Timer bar */}
      <div className="flex items-center gap-2">
        <GiSandsOfTime className={`h-4 w-4 ${timeLeft <= 5 ? "text-red-400 animate-pulse" : "text-zinc-500"}`} />
        <div className="relative h-1.5 w-32 overflow-hidden rounded-full bg-zinc-800 sm:w-48">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-200 ${
              timeLeft <= 5 ? "bg-red-500" : timeLeft <= 10 ? "bg-yellow-500" : "bg-emerald-500"
            }`}
            style={{ width: `${Math.min(100, (timeLeft / 30) * 100)}%` }}
          />
        </div>
        <span className={`min-w-[2ch] text-right text-xs font-bold tabular-nums ${
          timeLeft <= 5 ? "text-red-400" : timeLeft <= 10 ? "text-yellow-400" : "text-zinc-400"
        }`}>
          {timeLeft}s
        </span>
      </div>

      {/* Prompt */}
      <p className="text-[11px] uppercase tracking-widest text-zinc-500">
        {hasSelected ? (isDe ? "Karte gewählt" : "Card selected") : (isDe ? "Wähle eine Karte" : "Pick a card")}
      </p>

      {/* Fan of cards */}
      <div className="relative flex items-end justify-center" style={{ minHeight: "200px" }}>
        {cards.map((card, idx) => {
          const isSelected = selectedIndex === idx;
          const mid = (total - 1) / 2;
          const offset = idx - mid;
          const angle = offset * (maxFanAngle / Math.max(total - 1, 1));
          const yShift = Math.abs(offset) * 6;

          return (
            <button
              key={idx}
              onClick={() => onSelect(idx)}
              disabled={disabled || hasSelected}
              className={`group relative transition-all duration-300 ease-out ${
                !hasSelected && !disabled ? "cursor-pointer hover:-translate-y-4 hover:z-30" : ""
              }`}
              style={{
                transform: `rotate(${isSelected ? 0 : angle}deg) translateY(${isSelected ? -16 : yShift}px)`,
                zIndex: isSelected ? 20 : idx,
                marginLeft: idx === 0 ? 0 : "-16px",
              }}
            >
              <div
                className={`relative overflow-hidden rounded-lg border-2 transition-all duration-300 ${
                  isSelected
                    ? "border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.3)] scale-110"
                    : hasSelected
                      ? "border-zinc-800 opacity-40 scale-95"
                      : "border-zinc-700/50 hover:border-zinc-500 shadow-lg shadow-black/40"
                }`}
                style={{ width: "clamp(80px, 18vw, 130px)", aspectRatio: "2/3" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={card.image}
                  alt={card.name}
                  className="h-full w-full object-cover"
                  draggable={false}
                />
                {isSelected && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
                    <div className="rounded-full bg-yellow-400 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
                      {isDe ? "Gewählt" : "Selected"}
                    </div>
                  </div>
                )}
              </div>
              {/* Card value label */}
              <div className={`mt-1 text-center transition-opacity duration-300 ${hasSelected && !isSelected ? "opacity-0" : "opacity-100"}`}>
                <div className="truncate text-[10px] text-zinc-500" style={{ maxWidth: "clamp(80px, 18vw, 130px)" }}>{card.name}</div>
                <div className={`text-[11px] font-bold ${isSelected ? "text-yellow-400" : "text-zinc-400"}`}>{card.coinValue}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
