"use client";

import { useState, useRef, useCallback } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { type EffectTier, TIER_CONFIGS, getEffectTier } from "./effect-tiers";
import type { ParticleCanvasHandle } from "./particle-canvas";

interface CardData {
  cardId: string;
  name: string;
  rarity: string;
  coinValue: number;
  conversionValue: number;
  image: string | null;
  packIndex: number;
  cardIndex: number;
  status?: string;
}

interface CardRevealGridProps {
  cards: CardData[];
  packCount: number;
  lang: string;
  particleRef: React.RefObject<ParticleCanvasHandle | null>;
  onPlaySound: (key: string, volume?: number) => void;
  onAllRevealed: () => void;
}

export function CardRevealGrid({
  cards, packCount, lang, particleRef, onPlaySound, onAllRevealed,
}: CardRevealGridProps) {
  const isDe = lang === "de";
  const prefersReducedMotion = useReducedMotion();
  const [flippedSet, setFlippedSet] = useState<Set<number>>(new Set());
  const [shakingSet, setShakingSet] = useState<Set<number>>(new Set());
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const allRevealed = flippedSet.size === cards.length;
  const revealedCount = flippedSet.size;

  const handleFlip = useCallback((index: number) => {
    if (flippedSet.has(index)) return;

    const card = cards[index];
    const tier = getEffectTier(card.coinValue);
    const config = TIER_CONFIGS[tier];

    onPlaySound(config.soundKey, config.volume);
    setFlippedSet((prev) => new Set(prev).add(index));

    const delay = config.flipPauseMs + (config.flipDuration * 500);
    setTimeout(() => {
      if (config.particleCount > 0 && particleRef.current) {
        const el = cardRefs.current.get(index);
        const container = el?.closest(".relative");
        if (el && container) {
          const rect = el.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          particleRef.current.emit({
            x: rect.left - containerRect.left + rect.width / 2,
            y: rect.top - containerRect.top + rect.height / 2,
            count: config.particleCount,
            colors: config.colors,
            speed: [60, 180],
            size: [2, 6],
            lifetime: [400, 1000],
            gravity: 60,
            spread: Math.PI * 2,
            shape: "circle",
          });
        }
      }

      if (config.screenShake) {
        setShakingSet((prev) => new Set(prev).add(index));
        setTimeout(() => setShakingSet((prev) => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        }), 150);
      }

      if (config.confetti && particleRef.current) {
        particleRef.current.emitConfetti(config.colors, 40);
      }
    }, delay);
  }, [flippedSet, cards, onPlaySound, particleRef]);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5 py-4">
      {/* Header */}
      <div className="text-center">
        <p className="text-sm text-text-muted">
          {revealedCount}/{cards.length} {isDe ? "aufgedeckt" : "revealed"}
          {packCount > 1 && ` · ${packCount} Packs`}
        </p>
      </div>

      {/* Card grid — flex-wrap with fixed card width for uniform sizing */}
      <div className="flex flex-wrap justify-center gap-3">
        {cards.map((card, i) => (
          <GridCard
            key={i}
            card={card}
            index={i}
            flipped={flippedSet.has(i)}
            shaking={shakingSet.has(i)}
            isDe={isDe}
            reducedMotion={!!prefersReducedMotion}
            onFlip={handleFlip}
            cardRefs={cardRefs}
          />
        ))}
      </div>

      {/* Continue button */}
      {allRevealed && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          className="pt-2"
        >
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={onAllRevealed}
          >
            {isDe ? "Weiter zur Übersicht" : "Continue to overview"}
          </Button>
        </motion.div>
      )}
    </div>
  );
}

// ─── Individual Grid Card ─────────────────────────────────────────────

function GridCard({
  card, index, flipped, shaking, isDe, reducedMotion, onFlip, cardRefs,
}: {
  card: CardData;
  index: number;
  flipped: boolean;
  shaking: boolean;
  isDe: boolean;
  reducedMotion: boolean;
  onFlip: (i: number) => void;
  cardRefs: React.RefObject<Map<number, HTMLDivElement>>;
}) {
  const tier = getEffectTier(card.coinValue);
  const config = TIER_CONFIGS[tier];

  const setRef = (el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(index, el);
    else cardRefs.current.delete(index);
  };

  // Fixed card width — keeps all cards the same size
  const cardWidth = "w-[130px] sm:w-[150px]";

  if (reducedMotion) {
    return (
      <div
        ref={setRef}
        className={`${cardWidth} cursor-pointer`}
        onClick={() => onFlip(index)}
        role="button"
        tabIndex={0}
        aria-label={isDe ? "Karte aufdecken" : "Flip card"}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onFlip(index); } }}
      >
        {flipped ? (
          <GridCardFront card={card} tier={tier} />
        ) : (
          <GridCardBack />
        )}
      </div>
    );
  }

  return (
    <div className={`${cardWidth} relative ${shaking ? "animate-screen-shake" : ""}`}>
      <div
        ref={setRef}
        className="cursor-pointer"
        onClick={() => onFlip(index)}
        role="button"
        tabIndex={0}
        aria-label={isDe ? "Karte aufdecken" : "Flip card"}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onFlip(index); } }}
        style={{ perspective: 600 }}
      >
        <div style={{
          transformStyle: "preserve-3d",
          transition: `transform ${flipped ? config.flipDuration : 0.4}s cubic-bezier(0.4, 0, 0.2, 1)`,
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          position: "relative",
        }}>
          {/* Card Back */}
          <div style={{ backfaceVisibility: "hidden" }}>
            <GridCardBack />
          </div>
          {/* Card Front */}
          <div style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            position: "absolute",
            inset: 0,
          }}>
            <GridCardFront card={card} tier={tier} />
          </div>
        </div>
      </div>

      {/* Glow effect */}
      {flipped && config.glowIntensity > 0 && (
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          style={{
            boxShadow: `0 0 ${config.glowIntensity}px ${config.glowColor}, 0 0 ${config.glowIntensity * 2}px ${config.glowColor}`,
          }}
        />
      )}
    </div>
  );
}

// ─── Card Back (face-down) ────────────────────────────────────────────

function GridCardBack() {
  return (
    <div className="aspect-[63/88] rounded-xl overflow-hidden relative border border-pa-green/20 shadow-lg">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/card-back.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />
    </div>
  );
}

// ─── Card Front (revealed) ────────────────────────────────────────────

function GridCardFront({ card, tier }: {
  card: CardData;
  tier: EffectTier;
}) {
  const config = TIER_CONFIGS[tier];
  return (
    <div className="relative">
      {/* Card image */}
      {card.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.image}
          alt={card.name}
          className="aspect-[63/88] w-full object-cover rounded-xl"
          draggable={false}
        />
      ) : (
        <div className="aspect-[63/88] w-full bg-white/4 rounded-xl flex items-center justify-center border border-border">
          <span className="text-text-muted text-xs">?</span>
        </div>
      )}

      {/* Overlay info at bottom of card */}
      <div className="absolute inset-x-0 bottom-0 rounded-b-xl bg-gradient-to-t from-black/80 via-black/50 to-transparent px-2 pt-5 pb-2">
        <p className="text-[11px] font-semibold text-white truncate leading-tight">{card.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[9px] text-white/60">{card.rarity}</span>
          {tier >= 2 && (
            <span className="text-[9px] font-bold uppercase" style={{ color: config.colors[0] }}>
              {config.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
