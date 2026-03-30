"use client";

import React, { useState, useRef, useCallback } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useToast } from "@/components/ui/toast";
import { Pack3D } from "./pack-3d";
import { PackRipper } from "./pack-ripper";
import { CardRevealGrid } from "./card-reveal-grid";
import { CardReview } from "./card-review";
import { ParticleCanvas, type ParticleCanvasHandle } from "./particle-canvas";
import { usePackSounds, type SoundKey } from "./use-pack-sounds";
import { getMaxTierFromCards } from "./effect-tiers";

interface DrawnCard {
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

interface OpenResult {
  packGroupId: string;
  packCount: number;
  totalCost: number;
  newBalance: number;
  isRecovery?: boolean;
  cards: DrawnCard[];
}

interface BoxInfo {
  _id: string;
  name: { de: string; en: string };
  image?: string | null;
}

interface PackOpeningProps {
  result: OpenResult;
  box: BoxInfo;
  lang: string;
  onDone: () => void;
  onCoinsChange: (coins: number) => void;
  quickOpen?: boolean;
}

type CardChoice = "claim" | "convert" | null;
type Phase = "idle" | "ripping" | "reveal" | "review";

export function PackOpening({ result, box, lang, onDone, onCoinsChange, quickOpen }: PackOpeningProps) {
  const isDe = lang === "de";
  const { toast } = useToast();
  const { play, masterVolume, setMasterVolume } = usePackSounds();
  const prefersReducedMotion = useReducedMotion();

  const isRecovery = result.isRecovery ?? false;

  // Pre-populate choices from recovery data (already decided cards)
  const initialChoices = (() => {
    const map = new Map<number, CardChoice>();
    if (isRecovery) {
      result.cards.forEach((c, i) => {
        if (c.status === "reserved") map.set(i, "claim");
        if (c.status === "converted") map.set(i, "convert");
      });
    }
    return map;
  })();

  const getInitialPhase = (): Phase => {
    if (isRecovery) return "review";
    if (quickOpen) return "review";
    if (prefersReducedMotion) return "reveal";
    return "ripping";
  };

  const [choices, setChoices] = useState<Map<number, CardChoice>>(initialChoices);
  const [phase, setPhase] = useState<Phase>(getInitialPhase);
  const [submitting, setSubmitting] = useState(false);

  const particleRef = useRef<ParticleCanvasHandle>(null);

  const cards = result.cards;
  const boxName = isDe ? (box.name.de || box.name.en) : (box.name.en || box.name.de);
  const maxTier = getMaxTierFromCards(cards);

  // Cards already decided before recovery (not changeable)
  const recoveredIndices = new Set(
    isRecovery
      ? cards.map((c, i) => (c.status === "reserved" || c.status === "converted") ? i : -1).filter((i) => i >= 0)
      : []
  );

  function setChoice(idx: number, choice: CardChoice) {
    setChoices((prev) => new Map(prev).set(idx, choice));
  }

  const handlePlaySound = useCallback((key: string, volume?: number) => {
    play(key as SoundKey, volume);
  }, [play]);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      // Send decisions only for cards not already decided (recovered)
      for (let i = 0; i < cards.length; i++) {
        if (recoveredIndices.has(i)) continue;

        const card = cards[i];
        const decision = choices.get(i);
        if (!decision) continue;

        const res = await fetch("/api/pulls/decide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            packGroupId: result.packGroupId,
            cardId: card.cardId,
            cardIndex: i,
            packIndex: card.packIndex,
            rarity: card.rarity,
            coinValue: card.coinValue,
            conversionValue: card.conversionValue,
            decision,
            boxId: box._id,
          }),
        });
        const data = (await res.json()) as { newBalance?: number; error?: string };
        if (!res.ok) {
          toast({ type: "error", title: data.error ?? `Failed on card ${i + 1}` });
          setSubmitting(false);
          return;
        }
        if (data.newBalance !== undefined) onCoinsChange(data.newBalance);
      }

      toast({
        type: "success",
        title: isDe
          ? "Pack-Opening abgeschlossen! Karten im Warenkorb."
          : "Pack opening complete! Cards in cart.",
      });
      onDone();
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setSubmitting(false);
    }
  }

  // ─── REVIEW PHASE ───
  if (phase === "review") {
    return (
      <CardReview
        cards={cards}
        boxName={boxName}
        lang={lang}
        isRecovery={isRecovery}
        recoveredIndices={recoveredIndices}
        choices={choices}
        onSetChoice={setChoice}
        onConfirm={() => void handleConfirm()}
        submitting={submitting}
      />
    );
  }

  // ─── ANIMATION PHASES: idle, ripping, reveal — single wrapper with one ParticleCanvas ───
  return (
    <div className={`relative mx-auto flex flex-col items-center py-8 ${phase === "reveal" ? "max-w-4xl" : "max-w-md"}`}>
      <ParticleCanvas ref={particleRef} />

      {/* Volume control — top right corner */}
      <SoundControl volume={masterVolume} onChange={setMasterVolume} />

      {phase === "idle" && (
        <Pack3D
          boxName={boxName}
          onReady={() => setPhase("ripping")}
        />
      )}
      {phase === "ripping" && (
        <PackRipper
          boxName={boxName}
          cardCount={cards.length}
          maxTier={maxTier}
          particleRef={particleRef}
          onRipComplete={() => setPhase("reveal")}
          onPlaySound={handlePlaySound}
        />
      )}
      {phase === "reveal" && (
        <CardRevealGrid
          cards={cards}
          packCount={result.packCount}
          lang={lang}
          particleRef={particleRef}
          onPlaySound={handlePlaySound}
          onAllRevealed={() => setPhase("review")}
        />
      )}
    </div>
  );
}

// ─── Sound Control ────────────────────────────────────────────────────

function SoundControl({ volume, onChange }: { volume: number; onChange: (v: number) => void }) {
  const isMuted = volume <= 0;

  return (
    <div className="absolute top-2 right-2 z-40 flex items-center gap-2 bg-surface/80 backdrop-blur-sm border border-border rounded-lg px-2.5 py-1.5">
      <button
        type="button"
        onClick={() => onChange(isMuted ? 0.5 : 0)}
        className="text-text-muted hover:text-text-primary transition-colors"
        aria-label={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-16 sm:w-20 h-1 accent-pa-green cursor-pointer"
        aria-label="Sound volume"
      />
    </div>
  );
}
