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
  conditions: string[];
}

const COND_ORDER = ["Mint", "Near Mint", "Lightly Played", "Moderately Played", "Heavily Played"];
const COND_SHORT: Record<string, string> = { "Mint": "M", "Near Mint": "NM", "Lightly Played": "LP", "Moderately Played": "MP", "Heavily Played": "HP" };

function formatConditionRange(conditions: string[]): string {
  if (conditions.length === 0) return "NM";
  if (conditions.length === 1) return COND_SHORT[conditions[0]] ?? conditions[0];
  const sorted = [...conditions].sort((a, b) => COND_ORDER.indexOf(a) - COND_ORDER.indexOf(b));
  return `${COND_SHORT[sorted[0]] ?? sorted[0]} – ${COND_SHORT[sorted[sorted.length - 1]] ?? sorted[sorted.length - 1]}`;
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

/** Generischer Kartenrücken im PA-Design */
function CardBack({ label }: { label: string }) {
  return (
    <div className="w-full aspect-[63/88] rounded-lg mb-1.5 relative overflow-hidden bg-gradient-to-br from-[#1A1924] via-[#24043A] to-[#1A1924] border border-white/8">
      {/* Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(155,255,0,0.08) 8px, rgba(155,255,0,0.08) 9px)`,
        }} />
      </div>
      {/* Center logo area */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
        <div className="w-8 h-8 rounded-full bg-pa-green/10 border border-pa-green/20 flex items-center justify-center">
          <span className="text-pa-green text-xs font-black">PA</span>
        </div>
        <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">{label}</span>
      </div>
      {/* Corner accents */}
      <div className="absolute top-1.5 left-1.5 w-2 h-2 border-t border-l border-pa-green/20 rounded-tl" />
      <div className="absolute top-1.5 right-1.5 w-2 h-2 border-t border-r border-pa-green/20 rounded-tr" />
      <div className="absolute bottom-1.5 left-1.5 w-2 h-2 border-b border-l border-pa-green/20 rounded-bl" />
      <div className="absolute bottom-1.5 right-1.5 w-2 h-2 border-b border-r border-pa-green/20 rounded-br" />
    </div>
  );
}

export function CardPool({ cards, lang, pullCounts }: { cards: CardInfo[]; lang: string; pullCounts?: Record<string, number> }) {
  const isDe = lang === "de";
  const [selected, setSelected] = useState<CardInfo | null>(null);

  return (
    <>
      <div
        data-tour="box-card-pool"
        className="bg-surface border border-border rounded-[14px] p-4"
      >
        <div className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-3">
          {isDe ? `Alle Karten (${cards.length})` : `All Cards (${cards.length})`}
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
          {cards.map((card, idx) => {
            const outOfStock = card.stock === 0;
            return (
              <button
                key={card.cardId}
                type="button"
                data-tour={idx === 0 ? "box-first-card" : undefined}
                onClick={() => setSelected(card)}
                className="bg-white/3 border border-border rounded-xl p-2 text-center hover:border-pa-green/20 transition-all"
              >
                {outOfStock ? (
                  <CardBack label={isDe ? "Bald verfügbar" : "Back soon"} />
                ) : card.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={card.image} alt="" className="w-full rounded-lg mb-1.5" loading="lazy" />
                ) : (
                  <div className="w-full aspect-[63/88] bg-white/4 rounded-lg mb-1.5" />
                )}
                <p className={`text-[10px] font-semibold truncate ${outOfStock ? "text-text-muted" : "text-text-primary"}`}>{card.name}</p>
                {!outOfStock && (
                  <p className="text-[9px] text-text-muted">{formatConditionRange(card.conditions)}</p>
                )}
                <p className={`text-[10px] font-bold tabular-nums ${outOfStock ? "text-text-disabled" : chanceColor(card.chance)}`}>
                  {outOfStock ? (isDe ? "Bald verfügbar" : "Back soon") : formatChance(card.chance)}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <CardLightbox card={selected} lang={lang} open={true} onClose={() => setSelected(null)} pullCount={pullCounts?.[selected.cardId]} />
      )}
    </>
  );
}
