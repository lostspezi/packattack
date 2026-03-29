"use client";

import { useEffect, useState } from "react";

interface CardData {
  name: string;
  image?: string;
  rarity: string;
  coinValue: number;
}

interface CardFlipProps {
  card: CardData;
  revealed: boolean;
  delay?: number;
}

const RARITY_GLOW: Record<string, string> = {
  Common: "border-gray-400/60 shadow-gray-400/20",
  Uncommon: "border-green-400/60 shadow-green-400/30",
  Rare: "border-blue-400/60 shadow-blue-400/30",
  "Rare Holo": "border-blue-400/60 shadow-blue-400/30",
  Epic: "border-purple-400/60 shadow-purple-400/40",
  Legendary: "border-yellow-400/60 shadow-yellow-400/40",
  "Ultra Rare": "border-transparent shadow-lg",
};

const RARITY_BADGE: Record<string, string> = {
  Common: "bg-gray-500/20 text-gray-300",
  Uncommon: "bg-green-500/20 text-green-300",
  Rare: "bg-blue-500/20 text-blue-300",
  "Rare Holo": "bg-blue-500/20 text-blue-300",
  Epic: "bg-purple-500/20 text-purple-300",
  Legendary: "bg-yellow-500/20 text-yellow-300",
  "Ultra Rare": "bg-gradient-to-r from-pink-500/30 via-yellow-400/30 to-blue-500/30 text-white",
};

function isUltraRare(rarity: string) {
  return rarity === "Ultra Rare" || rarity === "Secret Rare" || rarity === "Hyper Rare" || rarity === "Special Illustration Rare";
}

export function CardFlip({ card, revealed, delay = 0 }: CardFlipProps) {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (!revealed) return;
    const t = setTimeout(() => setFlipped(true), delay);
    return () => clearTimeout(t);
  }, [revealed, delay]);

  const glow = RARITY_GLOW[card.rarity] ?? RARITY_GLOW["Common"];
  const badge = RARITY_BADGE[card.rarity] ?? RARITY_BADGE["Common"];
  const ultra = isUltraRare(card.rarity);

  return (
    <div className="perspective-500 w-32 h-44">
      <div
        className="relative h-full w-full transition-transform duration-700"
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Back face */}
        <div
          className="absolute inset-0 rounded-[10px] border border-pa-lila/40 bg-gradient-to-br from-pa-lila/30 to-bg/80 flex items-center justify-center"
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="h-10 w-10 rounded-full bg-pa-lila/20 border border-pa-lila/40 flex items-center justify-center">
            <span className="text-lg">⚔️</span>
          </div>
        </div>

        {/* Front face */}
        <div
          className={[
            "absolute inset-0 rounded-[10px] border-2 overflow-hidden flex flex-col",
            glow,
            ultra ? "shadow-[0_0_18px_4px_rgba(250,200,50,0.35)]" : "shadow-md",
          ].join(" ")}
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            background: ultra
              ? "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)"
              : "var(--color-surface, #1a1a1a)",
          }}
        >
          {card.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.image}
              alt={card.name}
              className="w-full flex-1 object-cover"
            />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-white/5">
              <span className="text-3xl">🃏</span>
            </div>
          )}
          <div className="px-1.5 py-1 bg-bg/80">
            <p className="truncate text-[10px] font-semibold text-text-primary leading-tight">
              {card.name}
            </p>
            <div className="mt-0.5 flex items-center justify-between gap-1">
              <span className={["rounded px-1 py-0.5 text-[8px] font-bold", badge].join(" ")}>
                {card.rarity}
              </span>
              <span className="text-[9px] text-pa-green font-medium">{card.coinValue}🪙</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
