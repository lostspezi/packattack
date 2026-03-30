"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ShoppingCart, Coins, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type EffectTier, TIER_CONFIGS, getEffectTier } from "./effect-tiers";
import type { ParticleCanvasHandle } from "./particle-canvas";

interface CardFlipperProps {
  card: {
    cardId: string;
    name: string;
    rarity: string;
    coinValue: number;
    conversionValue: number;
    image: string | null;
  };
  index: number;
  total: number;
  packIndex: number;
  packCount: number;
  lang: string;
  particleRef: React.RefObject<ParticleCanvasHandle | null>;
  onChoice: (choice: "claim" | "convert" | null) => void;
  onNext: () => void;
  onPlaySound: (key: string, volume?: number) => void;
  choice: "claim" | "convert" | null;
}

export function CardFlipper({
  card, index, total, packIndex, packCount, lang,
  particleRef, onChoice, onNext, onPlaySound, choice,
}: CardFlipperProps) {
  const isDe = lang === "de";
  const prefersReducedMotion = useReducedMotion();
  const [flipped, setFlipped] = useState(false);
  const [shaking, setShaking] = useState(false);
  // displayedCard holds the card shown on the front face — updates only after flip-back
  const [displayedCard, setDisplayedCard] = useState(card);
  const [prevCardId, setPrevCardId] = useState(card.cardId);
  const cardRef = useRef<HTMLDivElement>(null);
  const isLast = index >= total - 1;
  const tier = getEffectTier(displayedCard.coinValue);
  const config = TIER_CONFIGS[tier];
  const FLIP_BACK_MS = 400;

  // Detect card change during render (no refs in effects)
  if (card.cardId !== prevCardId) {
    setPrevCardId(card.cardId);
    if (flipped) {
      setFlipped(false);
    } else {
      setDisplayedCard(card);
    }
  }

  // After flip-back completes, swap the displayed card to the new one
  useEffect(() => {
    if (!flipped && displayedCard.cardId !== card.cardId) {
      const timer = setTimeout(() => {
        setDisplayedCard(card);
      }, FLIP_BACK_MS);
      return () => clearTimeout(timer);
    }
  }, [flipped, card, displayedCard.cardId]);

  const handleFlip = useCallback(() => {
    if (flipped) return;
    setFlipped(true);
    onPlaySound(config.soundKey, config.volume);
    const delay = config.flipPauseMs + (config.flipDuration * 500);
    setTimeout(() => {
      if (config.particleCount > 0 && cardRef.current && particleRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        const containerRect = cardRef.current.closest(".relative")?.getBoundingClientRect();
        if (containerRect) {
          particleRef.current.emit({
            x: rect.left - containerRect.left + rect.width / 2,
            y: rect.top - containerRect.top + rect.height / 2,
            count: config.particleCount, colors: config.colors,
            speed: [60, 180], size: [2, 6], lifetime: [400, 1000],
            gravity: 60, spread: Math.PI * 2, shape: "circle",
          });
        }
      }
      if (config.screenShake) {
        setShaking(true);
        setTimeout(() => setShaking(false), 150);
      }
      if (config.confetti && particleRef.current) {
        particleRef.current.emitConfetti(config.colors, 40);
      }
    }, delay);
  }, [flipped, config, onPlaySound, particleRef]);


  if (prefersReducedMotion) {
    return (
      <div className="max-w-md mx-auto space-y-4 py-4">
        <ProgressBar index={index} total={total} packIndex={packIndex} packCount={packCount} isDe={isDe} />
        <div className="bg-surface border border-border rounded-[14px] p-6 text-center space-y-4">
          <CardFront card={card} tier={tier} isDe={isDe} />
          <ActionButtons card={card} choice={choice} onChoice={onChoice} onNext={onNext} isLast={isLast} isDe={isDe} />
        </div>
      </div>
    );
  }

  return (
    <div className={`max-w-md mx-auto space-y-4 py-4 ${shaking ? "animate-screen-shake" : ""}`}>
      <ProgressBar index={index} total={total} packIndex={packIndex} packCount={packCount} isDe={isDe} />
      <div className="relative">
        <div
          ref={cardRef}
          className="bg-surface border border-border rounded-[14px] p-6 text-center cursor-pointer"
          onClick={handleFlip}
          role="button"
          tabIndex={0}
          aria-label={isDe ? "Karte aufdecken" : "Flip card to reveal"}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleFlip(); } }}
          style={{ perspective: 1000, minHeight: "16rem" }}
        >
          <div style={{
            transformStyle: "preserve-3d",
            transition: `transform ${flipped ? config.flipDuration : FLIP_BACK_MS / 1000}s cubic-bezier(0.4, 0, 0.2, 1)`,
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            position: "relative",
            minHeight: "16rem",
          }}>
            {/* Card Back — visible when not flipped */}
            <div style={{ backfaceVisibility: "hidden", position: "absolute", inset: 0 }}>
              <div className="w-48 h-64 mx-auto rounded-xl overflow-hidden relative flex items-center justify-center border border-pa-green/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/card-back.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
                <span className="relative text-sm text-pa-green font-medium drop-shadow-lg">{isDe ? "Tippe zum Aufdecken" : "Tap to reveal"}</span>
              </div>
            </div>
            {/* Card Front — visible when flipped */}
            <div style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
              <CardFront card={displayedCard} tier={tier} isDe={isDe} />
            </div>
          </div>
        </div>
        {flipped && config.glowIntensity > 0 && (
          <motion.div
            className="absolute inset-0 rounded-[14px] pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            style={{ boxShadow: `0 0 ${config.glowIntensity}px ${config.glowColor}, 0 0 ${config.glowIntensity * 2}px ${config.glowColor}` }}
          />
        )}
      </div>
      {flipped && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2, duration: 0.3 }}>
          <ActionButtons card={card} choice={choice} onChoice={onChoice} onNext={onNext} isLast={isLast} isDe={isDe} />
        </motion.div>
      )}
    </div>
  );
}

function ProgressBar({ index, total, packIndex, packCount, isDe }: {
  index: number; total: number; packIndex: number; packCount: number; isDe: boolean;
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">{isDe ? "Karte" : "Card"} {index + 1}/{total}</p>
        {packCount > 1 && <p className="text-xs text-text-muted">Pack {packIndex + 1}/{packCount}</p>}
      </div>
      <div className="h-1 bg-white/6 rounded-full overflow-hidden">
        <div className="h-full bg-pa-green rounded-full transition-all" style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>
    </>
  );
}

function CardFront({ card, tier, isDe }: {
  card: { name: string; rarity: string; coinValue: number; conversionValue: number; image: string | null };
  tier: EffectTier; isDe: boolean;
}) {
  const config = TIER_CONFIGS[tier];
  return (
    <div className="space-y-4">
      {card.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.image} alt={card.name} className="w-48 mx-auto rounded-xl" />
      ) : (
        <div className="w-48 h-64 mx-auto bg-white/4 rounded-xl flex items-center justify-center">
          <span className="text-text-muted">?</span>
        </div>
      )}
      <div className="space-y-1">
        <h3 className="text-lg font-bold text-text-primary">{card.name}</h3>
        <Badge variant="info">{card.rarity}</Badge>
        {tier >= 2 && (
          <span className="ml-2 text-xs font-bold uppercase tracking-wider" style={{ color: config.colors[0] }}>
            {config.label}
          </span>
        )}
      </div>
      <div className="flex items-center justify-center gap-4 text-sm">
        <span className="text-text-muted">
          {isDe ? "Wert" : "Value"}: <strong className="text-text-primary">{card.coinValue} Coins</strong>
        </span>
        <span className="text-text-muted">
          {isDe ? "Umwandlung" : "Convert"}: <strong className="text-text-primary">{card.conversionValue} Coins</strong>
        </span>
      </div>
    </div>
  );
}

function ActionButtons({ card, choice, onChoice, onNext, isLast, isDe }: {
  card: { conversionValue: number };
  choice: "claim" | "convert" | null;
  onChoice: (c: "claim" | "convert" | null) => void;
  onNext: () => void;
  isLast: boolean;
  isDe: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button variant={choice === "claim" ? "primary" : "secondary"} size="md" className="flex-1" onClick={() => onChoice(choice === "claim" ? null : "claim")}>
          <ShoppingCart className="w-4 h-4 mr-1.5" />{isDe ? "Warenkorb" : "Cart"}
        </Button>
        <Button variant={choice === "convert" ? "primary" : "secondary"} size="md" className="flex-1" onClick={() => onChoice(choice === "convert" ? null : "convert")}>
          <Coins className="w-4 h-4 mr-1.5" />{card.conversionValue} Coins
        </Button>
      </div>
      <Button variant="ghost" size="sm" className="w-full" onClick={onNext}>
        <ArrowRight className="w-3.5 h-3.5 mr-1" />
        {isLast
          ? isDe ? "Zur Übersicht" : "Go to overview"
          : choice
            ? isDe ? "Nächste Karte" : "Next card"
            : isDe ? "Überspringen — später entscheiden" : "Skip — decide later"}
      </Button>
    </div>
  );
}
