"use client";

import React, { useState } from "react";
import { Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
}

export function TopHits({ cards, lang }: { cards: CardInfo[]; lang: string }) {
  const isDe = lang === "de";
  const [selected, setSelected] = useState<CardInfo | null>(null);

  if (cards.length === 0) return null;

  function formatChance(c: number) {
    if (c < 0.01) return `${c.toFixed(3)}%`;
    if (c < 1) return `${c.toFixed(2)}%`;
    return `${c.toFixed(1)}%`;
  }

  return (
    <>
      <div className="bg-surface border border-border rounded-[14px] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4 text-yellow-400" />
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">Top Hits</span>
        </div>

        <div className="space-y-2">
          {cards.map((card, i) => (
            <button
              key={card.cardId}
              type="button"
              onClick={() => setSelected(card)}
              className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all ${
                i === 0
                  ? "bg-pa-green/5 border border-pa-green/15 hover:border-pa-green/30"
                  : "bg-white/3 hover:bg-white/5"
              }`}
            >
              {/* Rank */}
              <span className={`text-xs font-bold w-5 text-center ${i === 0 ? "text-pa-green" : "text-text-muted"}`}>
                #{i + 1}
              </span>

              {/* Card image */}
              {card.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={card.image} alt="" className="w-9 rounded shrink-0" loading="lazy" />
              ) : (
                <div className="w-9 aspect-[63/88] bg-white/4 rounded shrink-0" />
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-text-primary truncate">{card.name}</p>
                <Badge variant="info">{card.rarity}</Badge>
              </div>

              {/* Value + Chance */}
              <div className="text-right shrink-0">
                <p className={`text-sm font-bold tabular-nums ${i === 0 ? "text-pa-green" : "text-text-primary"}`}>
                  {card.coinValue.toLocaleString()}
                </p>
                <p className="text-[10px] text-yellow-400 tabular-nums">{formatChance(card.chance)}</p>
              </div>
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
