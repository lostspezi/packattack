"use client";

import React, { useState } from "react";
import { ShoppingCart, Coins, ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

interface DrawnCard {
  cardId: string;
  name: string;
  rarity: string;
  coinValue: number;
  conversionValue: number;
  image: string | null;
  packIndex: number;
  cardIndex: number;
}

interface OpenResult {
  packGroupId: string;
  packCount: number;
  totalCost: number;
  newBalance: number;
  cards: DrawnCard[];
}

interface BoxInfo {
  _id: string;
  name: { de: string; en: string };
  coinConversionRate: number;
}

interface PackOpeningProps {
  result: OpenResult;
  box: BoxInfo;
  lang: string;
  onDone: () => void;
  onCoinsChange: (coins: number) => void;
}

type CardChoice = "claim" | "convert" | null;

export function PackOpening({ result, box, lang, onDone, onCoinsChange }: PackOpeningProps) {
  const isDe = lang === "de";
  const { toast } = useToast();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  // Choices are LOCAL only — nothing sent to API until "Confirm"
  const [choices, setChoices] = useState<Map<number, CardChoice>>(new Map());
  const [phase, setPhase] = useState<"reveal" | "review">("reveal");
  const [submitting, setSubmitting] = useState(false);

  const cards = result.cards;
  const currentCard = cards[currentIndex];
  const isLast = currentIndex >= cards.length - 1;
  const boxName = isDe ? (box.name.de || box.name.en) : (box.name.en || box.name.de);

  function setChoice(idx: number, choice: CardChoice) {
    setChoices((prev) => new Map(prev).set(idx, choice));
  }

  function advanceCard() {
    if (isLast) {
      setPhase("review");
    } else {
      setCurrentIndex((i) => i + 1);
      setRevealed(false);
    }
  }

  // All cards must have a choice before confirming
  const allDecided = cards.every((_, i) => choices.get(i) === "claim" || choices.get(i) === "convert");
  const claimedCount = [...choices.values()].filter((c) => c === "claim").length;
  const convertedCount = [...choices.values()].filter((c) => c === "convert").length;
  const coinsBack = cards.reduce((sum, c, i) => choices.get(i) === "convert" ? sum + c.conversionValue : sum, 0);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      // Send all decisions in sequence
      for (let i = 0; i < cards.length; i++) {
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
        const data = await res.json() as { newBalance?: number; error?: string };
        if (!res.ok) {
          toast({ type: "error", title: data.error ?? `Failed on card ${i + 1}` });
          setSubmitting(false);
          return;
        }
        if (data.newBalance !== undefined) onCoinsChange(data.newBalance);
      }

      toast({
        type: "success",
        title: isDe ? "Pack-Opening abgeschlossen! Karten im Warenkorb." : "Pack opening complete! Cards in cart.",
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
          <p className="text-sm text-text-secondary">{boxName} · {cards.length} {isDe ? "Karten" : "cards"}</p>
        </div>

        {/* Card list with decision toggles */}
        <div className="space-y-2">
          {cards.map((c, i) => {
            const choice = choices.get(i);
            return (
              <div key={i} className="flex items-center gap-3 bg-surface border border-border rounded-xl p-3">
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

                {/* Decision toggle */}
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
              </div>
            );
          })}
        </div>

        {/* Summary bar */}
        <div className="bg-white/4 border border-border rounded-xl p-4 flex items-center justify-between">
          <div className="flex gap-4 text-sm">
            <span className="text-green-400">{claimedCount} {isDe ? "Warenkorb" : "Cart"}</span>
            <span className="text-blue-400">{convertedCount} {isDe ? "Umwandlungen" : "Converts"}</span>
            {coinsBack > 0 && <span className="text-pa-green">+{coinsBack} Coins</span>}
          </div>
          {!allDecided && (
            <span className="text-xs text-yellow-400">
              {isDe ? `Noch ${cards.length - claimedCount - convertedCount} offen` : `${cards.length - claimedCount - convertedCount} remaining`}
            </span>
          )}
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
            ? (isDe ? "Bestätigen" : "Confirm")
            : (isDe ? "Bitte alle Karten entscheiden" : "Please decide all cards")}
        </Button>
      </div>
    );
  }

  // ─── REVEAL PHASE: Cards one by one ───
  if (!currentCard) return null;

  return (
    <div className="max-w-md mx-auto space-y-6 py-8">
      {/* Progress */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">
          {isDe ? "Karte" : "Card"} {currentIndex + 1}/{cards.length}
        </p>
        {result.packCount > 1 && (
          <p className="text-xs text-text-muted">
            Pack {currentCard.packIndex + 1}/{result.packCount}
          </p>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/6 rounded-full overflow-hidden">
        <div
          className="h-full bg-pa-green rounded-full transition-all"
          style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
        />
      </div>

      {/* Card display */}
      <div className="bg-surface border border-border rounded-[14px] p-6 text-center space-y-4">
        {!revealed ? (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="w-full space-y-4"
          >
            <div className="w-48 h-64 mx-auto bg-gradient-to-br from-pa-green/10 to-pa-lila/20 rounded-xl flex items-center justify-center border border-pa-green/20">
              <span className="text-4xl">?</span>
            </div>
            <p className="text-sm text-pa-green font-medium">
              {isDe ? "Tippe zum Aufdecken" : "Tap to reveal"}
            </p>
          </button>
        ) : (
          <>
            {currentCard.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentCard.image} alt={currentCard.name} className="w-48 mx-auto rounded-xl" />
            ) : (
              <div className="w-48 h-64 mx-auto bg-white/4 rounded-xl flex items-center justify-center">
                <span className="text-text-muted">?</span>
              </div>
            )}

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-text-primary">{currentCard.name}</h3>
              <Badge variant="info">{currentCard.rarity}</Badge>
            </div>

            <div className="flex items-center justify-center gap-4 text-sm">
              <span className="text-text-muted">{isDe ? "Wert" : "Value"}: <strong className="text-text-primary">{currentCard.coinValue} Coins</strong></span>
              <span className="text-text-muted">{isDe ? "Umwandlung" : "Convert"}: <strong className="text-text-primary">{currentCard.conversionValue} Coins</strong></span>
            </div>

            {/* Optional inline decision + skip */}
            <div className="flex flex-col gap-2 pt-2">
              {(() => {
                const choice = choices.get(currentIndex);
                return (
                  <>
                    <div className="flex gap-2">
                      <Button
                        variant={choice === "claim" ? "primary" : "secondary"}
                        size="md"
                        className="flex-1"
                        onClick={() => setChoice(currentIndex, choice === "claim" ? null : "claim")}
                      >
                        <ShoppingCart className="w-4 h-4 mr-1.5" />
                        {isDe ? "Warenkorb" : "Cart"}
                      </Button>
                      <Button
                        variant={choice === "convert" ? "primary" : "secondary"}
                        size="md"
                        className="flex-1"
                        onClick={() => setChoice(currentIndex, choice === "convert" ? null : "convert")}
                      >
                        <Coins className="w-4 h-4 mr-1.5" />
                        {currentCard.conversionValue} Coins
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={advanceCard}
                    >
                      <ArrowRight className="w-3.5 h-3.5 mr-1" />
                      {isLast
                        ? (isDe ? "Zur Übersicht" : "Go to overview")
                        : choice
                        ? (isDe ? "Nächste Karte" : "Next card")
                        : (isDe ? "Überspringen — später entscheiden" : "Skip — decide later")}
                    </Button>
                  </>
                );
              })()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
