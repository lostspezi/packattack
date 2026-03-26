"use client";

import React, { useState } from "react";
import { Check, Coins, Clock, ArrowRight } from "lucide-react";
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
  claimDeadline: string;
  cards: DrawnCard[];
}

interface BoxInfo {
  name: { de: string; en: string };
  coinConversionRate: number;
  claimDeadlineHours: number;
}

interface PackOpeningProps {
  result: OpenResult;
  box: BoxInfo;
  lang: string;
  onDone: () => void;
  onCoinsChange: (coins: number) => void;
}

type CardDecision = "pending" | "claimed" | "converted";

export function PackOpening({ result, box, lang, onDone, onCoinsChange }: PackOpeningProps) {
  const isDe = lang === "de";
  const { toast } = useToast();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [decisions, setDecisions] = useState<Map<number, CardDecision>>(new Map());
  const [processing, setProcessing] = useState(false);
  const [finished, setFinished] = useState(false);

  const cards = result.cards;
  const currentCard = cards[currentIndex];
  const isLast = currentIndex >= cards.length - 1;
  const boxName = isDe ? (box.name.de || box.name.en) : (box.name.en || box.name.de);

  async function handleDecision(decision: "claim" | "convert" | "later") {
    if (!currentCard) return;
    setProcessing(true);

    try {
      if (decision === "claim" || decision === "convert") {
        const endpoint = decision === "claim" ? "claim" : "convert";
        // We need the pull ID — for now we'll use packGroupId + index to find it
        const res = await fetch(`/api/pulls/decide`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            packGroupId: result.packGroupId,
            cardIndex: currentIndex,
            decision,
          }),
        });
        const data = await res.json() as { newBalance?: number; error?: string };
        if (!res.ok) {
          toast({ type: "error", title: data.error ?? "Failed" });
          setProcessing(false);
          return;
        }
        if (data.newBalance !== undefined) onCoinsChange(data.newBalance);
      }

      setDecisions((prev) => new Map(prev).set(currentIndex, decision === "claim" ? "claimed" : decision === "convert" ? "converted" : "pending"));

      if (isLast) {
        setFinished(true);
      } else {
        setCurrentIndex((i) => i + 1);
        setRevealed(false);
      }
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setProcessing(false);
    }
  }

  // Summary screen
  if (finished) {
    const claimed = [...decisions.values()].filter((d) => d === "claimed").length;
    const converted = [...decisions.values()].filter((d) => d === "converted").length;
    const pending = cards.length - claimed - converted;

    return (
      <div className="max-w-lg mx-auto space-y-6 py-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-text-primary">
            {isDe ? "Pack-Opening abgeschlossen!" : "Pack Opening Complete!"}
          </h2>
          <p className="text-sm text-text-secondary">{boxName}</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-400">{claimed}</p>
            <p className="text-[11px] text-text-muted">{isDe ? "Geclaimed" : "Claimed"}</p>
          </div>
          <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-blue-400">{converted}</p>
            <p className="text-[11px] text-text-muted">{isDe ? "Umgewandelt" : "Converted"}</p>
          </div>
          <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-yellow-400">{pending}</p>
            <p className="text-[11px] text-text-muted">{isDe ? "Ausstehend" : "Pending"}</p>
          </div>
        </div>

        {pending > 0 && (
          <p className="text-xs text-text-muted text-center">
            {isDe
              ? `${pending} Karte(n) ausstehend — du hast ${box.claimDeadlineHours}h um zu entscheiden.`
              : `${pending} card(s) pending — you have ${box.claimDeadlineHours}h to decide.`}
          </p>
        )}

        <Button variant="primary" size="lg" className="w-full" onClick={onDone}>
          {isDe ? "Fertig" : "Done"}
        </Button>
      </div>
    );
  }

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
            {/* Card image */}
            {currentCard.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentCard.image}
                alt={currentCard.name}
                className="w-48 mx-auto rounded-xl"
              />
            ) : (
              <div className="w-48 h-64 mx-auto bg-white/4 rounded-xl flex items-center justify-center">
                <span className="text-text-muted">?</span>
              </div>
            )}

            {/* Card info */}
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-text-primary">{currentCard.name}</h3>
              <Badge variant="info">{currentCard.rarity}</Badge>
            </div>

            <div className="flex items-center justify-center gap-4 text-sm">
              <span className="text-text-muted">{isDe ? "Wert" : "Value"}: <strong className="text-text-primary">{currentCard.coinValue} Coins</strong></span>
              <span className="text-text-muted">{isDe ? "Umwandlung" : "Convert"}: <strong className="text-text-primary">{currentCard.conversionValue} Coins</strong></span>
            </div>

            {/* Decision buttons */}
            <div className="flex flex-col gap-2 pt-2">
              <Button
                variant="primary"
                size="md"
                className="w-full"
                loading={processing}
                onClick={() => void handleDecision("claim")}
              >
                <Check className="w-4 h-4 mr-1.5" />
                {isDe ? "Claimen" : "Claim"}
              </Button>
              <Button
                variant="secondary"
                size="md"
                className="w-full"
                loading={processing}
                onClick={() => void handleDecision("convert")}
              >
                <Coins className="w-4 h-4 mr-1.5" />
                {isDe ? `In ${currentCard.conversionValue} Coins umwandeln` : `Convert to ${currentCard.conversionValue} coins`}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                loading={processing}
                onClick={() => void handleDecision("later")}
              >
                <Clock className="w-3.5 h-3.5 mr-1" />
                {isDe ? "Später entscheiden" : "Decide later"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
