"use client";

import React from "react";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";

interface CardInfo {
  name: string;
  image: string | null;
  rarity: string;
  setName: string;
  coinValue: number;
  marketPrice: number | null;
  chance: number;
}

export function CardLightbox({ card, lang, open, onClose }: { card: CardInfo; lang: string; open: boolean; onClose: () => void }) {
  const isDe = lang === "de";

  function formatChance(c: number) {
    if (c < 0.01) return `${c.toFixed(3)}%`;
    if (c < 1) return `${c.toFixed(2)}%`;
    return `${c.toFixed(1)}%`;
  }

  return (
    <Modal open={open} onClose={onClose} size="md">
      <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
        {/* Card image */}
        {card.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.image} alt={card.name} className="w-44 rounded-xl shrink-0" />
        ) : (
          <div className="w-44 aspect-[63/88] bg-white/4 rounded-xl shrink-0" />
        )}

        {/* Details */}
        <div className="space-y-3 flex-1 text-center sm:text-left">
          <div>
            <h3 className="text-xl font-bold text-text-primary">{card.name}</h3>
            {card.setName && <p className="text-xs text-text-muted mt-0.5">{card.setName}</p>}
            <Badge variant="info" className="mt-2">{card.rarity}</Badge>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="bg-white/4 border border-border rounded-xl px-4 py-2.5">
              <p className="text-[10px] text-text-muted">{isDe ? "Coin-Wert" : "Coin Value"}</p>
              <p className="text-lg font-bold text-pa-green">{card.coinValue.toLocaleString()}</p>
            </div>
            <div className="bg-white/4 border border-border rounded-xl px-4 py-2.5">
              <p className="text-[10px] text-text-muted">{isDe ? "Ziehchance" : "Draw Chance"}</p>
              <p className="text-lg font-bold text-yellow-400">{formatChance(card.chance)}</p>
            </div>
            {card.marketPrice !== null && (
              <div className="bg-white/4 border border-border rounded-xl px-4 py-2.5">
                <p className="text-[10px] text-text-muted">{isDe ? "Marktpreis" : "Market Price"}</p>
                <p className="text-lg font-bold text-text-primary">${card.marketPrice.toFixed(2)}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
