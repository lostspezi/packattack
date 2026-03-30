"use client";

import React, { useState, useRef, useCallback } from "react";
import { ShoppingCart, Coins, RotateCcw } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { Pack3D } from "./pack-3d";
import { PackRipper } from "./pack-ripper";
import { CardRevealGrid } from "./card-reveal-grid";
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
  const { play } = usePackSounds();
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

  // All cards must have a choice before confirming (recovered count as decided)
  const allDecided = cards.every(
    (_, i) =>
      recoveredIndices.has(i) ||
      choices.get(i) === "claim" ||
      choices.get(i) === "convert"
  );
  const claimedCount = [...choices.values()].filter((c) => c === "claim").length;
  const convertedCount = [...choices.values()].filter((c) => c === "convert").length;
  const coinsBack = cards.reduce(
    (sum, c, i) => (choices.get(i) === "convert" ? sum + c.conversionValue : sum),
    0
  );

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

  // ─── REVIEW PHASE: Overview of all cards with changeable decisions ───
  if (phase === "review") {
    return (
      <div className="max-w-lg mx-auto space-y-5 py-8">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold text-text-primary">
            {isDe ? "Deine Karten — Entscheide dich!" : "Your Cards — Make Your Choice!"}
          </h2>
          <p className="text-sm text-text-secondary">
            {boxName} · {cards.length} {isDe ? "Karten" : "cards"}
          </p>
        </div>

        {/* Recovery banner */}
        {isRecovery && (
          <div className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/8 px-4 py-3">
            <RotateCcw className="h-4 w-4 shrink-0 text-blue-400" />
            <p className="text-sm text-blue-300">
              {isDe
                ? recoveredIndices.size > 0
                  ? `Pack-Opening fortgesetzt. Du hast bereits ${recoveredIndices.size} von ${cards.length} Karten entschieden — die restlichen ${cards.length - recoveredIndices.size} warten auf dich.`
                  : `Dein letztes Pack-Opening wurde unterbrochen. Deine ${cards.length} Karten sind sicher — entscheide jetzt, was du damit machen möchtest.`
                : recoveredIndices.size > 0
                  ? `Pack opening resumed. You've already decided ${recoveredIndices.size} of ${cards.length} cards — ${cards.length - recoveredIndices.size} remaining.`
                  : `Your last pack opening was interrupted. Your ${cards.length} cards are safe — decide what to do with them now.`}
            </p>
          </div>
        )}

        {/* Card list with decision toggles */}
        <div className="space-y-2">
          {cards.map((c, i) => {
            const choice = choices.get(i);
            const isRecovered = recoveredIndices.has(i);

            return (
              <div
                key={i}
                className={[
                  "flex items-center gap-3 rounded-xl border p-3",
                  isRecovered
                    ? "border-white/8 bg-white/3 opacity-70"
                    : "border-border bg-surface",
                ].join(" ")}
              >
                {/* Image */}
                {c.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.image} alt="" className="w-12 rounded shrink-0" loading="lazy" />
                ) : (
                  <div className="w-12 aspect-[63/88] bg-white/4 rounded shrink-0" />
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{c.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="info">{c.rarity}</Badge>
                    <span className="text-[11px] text-text-muted">{c.coinValue} Coins</span>
                  </div>
                </div>

                {/* Decision toggle or recovered status */}
                {isRecovered ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                      choice === "claim"
                        ? "bg-green-500/15 text-green-400"
                        : "bg-blue-500/15 text-blue-400"
                    }`}>
                      {choice === "claim" ? (
                        <><ShoppingCart className="h-3.5 w-3.5" /> {isDe ? "Warenkorb" : "Cart"}</>
                      ) : (
                        <><Coins className="h-3.5 w-3.5" /> {c.conversionValue}</>
                      )}
                      <span className="text-[10px] opacity-50">✓</span>
                    </span>
                  </div>
                ) : (
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setChoice(i, "claim")}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                        choice === "claim"
                          ? "bg-green-500/15 text-green-400 border-green-500/30"
                          : "bg-white/4 text-text-muted border-border hover:bg-white/6"
                      }`}
                    >
                      <ShoppingCart className="w-3.5 h-3.5 inline mr-1" />
                      {isDe ? "Warenkorb" : "Cart"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setChoice(i, "convert")}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                        choice === "convert"
                          ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                          : "bg-white/4 text-text-muted border-border hover:bg-white/6"
                      }`}
                    >
                      <Coins className="w-3.5 h-3.5 inline mr-1" />
                      {c.conversionValue}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary bar */}
        <div className="bg-white/4 border border-border rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex gap-4 text-sm">
              <span className="text-green-400">
                {claimedCount} {isDe ? "Warenkorb" : "Cart"}
              </span>
              <span className="text-blue-400">
                {convertedCount}{" "}
                {isDe ? "Umwandlungen" : "Converts"}
              </span>
              {coinsBack > 0 && (
                <span className="text-pa-green">
                  +{coinsBack} Coins
                </span>
              )}
            </div>
            {!allDecided && (
              <span className="text-xs text-yellow-400">
                {isDe
                  ? `Noch ${cards.length - claimedCount - convertedCount - recoveredIndices.size} offen`
                  : `${cards.length - claimedCount - convertedCount - recoveredIndices.size} remaining`}
              </span>
            )}
          </div>
        </div>

        {/* Confirm button */}
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={!allDecided}
          loading={submitting}
          onClick={() => void handleConfirm()}
        >
          {allDecided
            ? isDe
              ? "Bestätigen"
              : "Confirm"
            : isDe
              ? "Bitte alle Karten entscheiden"
              : "Please decide all cards"}
        </Button>
      </div>
    );
  }

  // ─── ANIMATION PHASES: idle, ripping, reveal — single wrapper with one ParticleCanvas ───
  return (
    <div className={`relative mx-auto flex flex-col items-center py-8 ${phase === "reveal" ? "max-w-4xl" : "max-w-md"}`}>
      <ParticleCanvas ref={particleRef} />
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
