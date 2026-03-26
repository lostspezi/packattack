"use client";

import React, { useState } from "react";
import { CardLightbox } from "@/components/packs/card-lightbox";

interface CardInfo {
  cardId: string;
  name: string;
  image: string | null;
  rarity: string;
  setName: string;
  coinValue: number;
  marketPrice: number | null;
  chance: number;
  stock: number;
}

function chanceColor(chance: number): string {
  if (chance < 0.1) return "text-red-400";
  if (chance < 1) return "text-yellow-400";
  return "text-pa-green";
}

function formatChance(c: number) {
  if (c < 0.01) return `${c.toFixed(3)}%`;
  if (c < 1) return `${c.toFixed(2)}%`;
  return `${c.toFixed(1)}%`;
}

export function CardPool({ cards, lang }: { cards: CardInfo[]; lang: string }) {
  const isDe = lang === "de";
  const [selected, setSelected] = useState<CardInfo | null>(null);

  return (
    <>
      <div className="bg-surface border border-border rounded-[14px] p-4">
        <div className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-3">
          {isDe ? `Alle Karten (${cards.length})` : `All Cards (${cards.length})`}
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
          {cards.map((card) => (
            <button
              key={card.cardId}
              type="button"
              onClick={() => setSelected(card)}
              className={`bg-white/3 border border-border rounded-xl p-2 text-center hover:border-pa-green/20 transition-all ${
                card.stock === 0 ? "opacity-40" : ""
              }`}
            >
              {card.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={card.image} alt="" className="w-full rounded-lg mb-1.5" loading="lazy" />
              ) : (
                <div className="w-full aspect-[63/88] bg-white/4 rounded-lg mb-1.5" />
              )}
              <p className="text-[10px] font-semibold text-text-primary truncate">{card.name}</p>
              <p className={`text-[10px] font-bold tabular-nums ${chanceColor(card.chance)}`}>
                {formatChance(card.chance)}
              </p>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <CardLightbox card={selected} lang={lang} open={true} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
