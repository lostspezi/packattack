"use client";

import React, { useState } from "react";
import { ShoppingCart, Coins, ArrowRight, Sparkles, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  BULK_COIN_THRESHOLD,
  BULK_CONVERSION_BONUS,
  MIN_PACKS_FOR_BULK_OFFER,
  MIN_BULK_CARDS_FOR_OFFER,
} from "@/lib/pack-constants";

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

  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [choices, setChoices] = useState<Map<number, CardChoice>>(initialChoices);
  const [phase, setPhase] = useState<"reveal" | "review">(isRecovery ? "review" : "reveal");
  const [submitting, setSubmitting] = useState(false);

  // Bulk conversion state
  const [bulkDismissed, setBulkDismissed] = useState(false);
  const [bulkConverted, setBulkConverted] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const cards = result.cards;
  const currentCard = cards[currentIndex];
  const isLast = currentIndex >= cards.length - 1;
  const boxName = isDe ? (box.name.de || box.name.en) : (box.name.en || box.name.de);

  // Cards already decided before recovery (not changeable)
  const recoveredIndices = new Set(
    isRecovery
      ? cards.map((c, i) => (c.status === "reserved" || c.status === "converted") ? i : -1).filter((i) => i >= 0)
      : []
  );

  // Bulk conversion computed values (exclude already-recovered cards)
  const bulkIndices = new Set(
    cards.map((c, i) => (c.coinValue < BULK_COIN_THRESHOLD && !recoveredIndices.has(i) ? i : -1)).filter((i) => i >= 0)
  );
  const bulkCards = cards.filter((c, i) => c.coinValue < BULK_COIN_THRESHOLD && !recoveredIndices.has(i));
  const isBulkEligible =
    result.packCount >= MIN_PACKS_FOR_BULK_OFFER &&
    bulkCards.length >= MIN_BULK_CARDS_FOR_OFFER;
  const bulkTotalBase = bulkCards.reduce((sum, c) => sum + c.conversionValue, 0);
  const bulkTotalWithBonus = Math.floor(bulkTotalBase * (1 + BULK_CONVERSION_BONUS));
  const bulkBonusAmount = bulkTotalWithBonus - bulkTotalBase;

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

  // All cards must have a choice before confirming (bulk-converted and recovered count as decided)
  const allDecided = cards.every(
    (_, i) =>
      recoveredIndices.has(i) ||
      (bulkConverted && bulkIndices.has(i)) ||
      choices.get(i) === "claim" ||
      choices.get(i) === "convert"
  );
  const claimedCount = [...choices.values()].filter((c) => c === "claim").length;
  const convertedCount = [...choices.values()].filter((c) => c === "convert").length;
  const coinsBack = cards.reduce((sum, c, i) => {
    if (bulkConverted && bulkIndices.has(i)) return sum;
    return choices.get(i) === "convert" ? sum + c.conversionValue : sum;
  }, 0);

  async function handleBulkConvert() {
    setBulkSubmitting(true);
    try {
      const bulkCardData = cards
        .map((c, i) => ({ ...c, _idx: i }))
        .filter((c) => c.coinValue < BULK_COIN_THRESHOLD);

      const res = await fetch("/api/pulls/bulk-convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packGroupId: result.packGroupId,
          boxId: box._id,
          cards: bulkCardData.map((c) => ({
            cardId: c.cardId,
            cardIndex: c.cardIndex,
            packIndex: c.packIndex,
            rarity: c.rarity,
            coinValue: c.coinValue,
            conversionValue: c.conversionValue,
          })),
        }),
      });

      const data = (await res.json()) as {
        newBalance?: number;
        totalCoins?: number;
        error?: string;
      };

      if (!res.ok) {
        toast({ type: "error", title: data.error ?? "Bulk conversion failed" });
        setBulkSubmitting(false);
        return;
      }

      // Mark all bulk cards as "convert" in local choices
      setChoices((prev) => {
        const next = new Map(prev);
        for (const c of bulkCardData) {
          next.set(c._idx, "convert");
        }
        return next;
      });

      setBulkConverted(true);

      if (data.newBalance !== undefined) {
        onCoinsChange(data.newBalance);
      }

      // Dispatch coin animation event
      if (data.totalCoins) {
        window.dispatchEvent(
          new CustomEvent("coin-balance-change", { detail: { delta: data.totalCoins } })
        );
      }

      toast({
        type: "success",
        title: isDe
          ? `${bulkCards.length} Karten umgewandelt (+50% Bonus!)`
          : `${bulkCards.length} cards converted (+50% bonus!)`,
      });
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setBulkSubmitting(false);
    }
  }

  async function handleConfirm() {
    setSubmitting(true);
    try {
      // Send decisions only for cards not already decided (bulk-converted or recovered)
      for (let i = 0; i < cards.length; i++) {
        if (recoveredIndices.has(i)) continue;
        if (bulkConverted && bulkIndices.has(i)) continue;

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

        {/* Bulk conversion banner */}
        {isBulkEligible && !bulkConverted && !bulkDismissed && (
          <div className="relative overflow-hidden rounded-xl border border-pa-green/30 bg-gradient-to-br from-pa-green/10 via-pa-lila/10 to-pa-green/5 p-4">
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-pa-green/5 blur-2xl" />
            <div className="relative space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pa-green/15">
                  <Sparkles className="h-4 w-4 text-pa-green" />
                </div>
                <div>
                  <p className="text-sm font-bold text-text-primary">
                    {isDe
                      ? `${bulkCards.length} Bulk-Karten direkt umwandeln`
                      : `Convert ${bulkCards.length} bulk cards instantly`}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {isDe
                      ? `für ${bulkTotalWithBonus} Coins (inkl. +${bulkBonusAmount} Bonus)`
                      : `for ${bulkTotalWithBonus} Coins (incl. +${bulkBonusAmount} bonus)`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg bg-white/4 px-3 py-2">
                <Coins className="h-4 w-4 shrink-0 text-pa-green" />
                <div className="flex-1 text-xs text-text-secondary">
                  <span className="text-text-muted line-through">{bulkTotalBase}</span>
                  {" → "}
                  <span className="font-bold text-pa-green">{bulkTotalWithBonus} Coins</span>
                  <span className="ml-1.5 inline-flex items-center rounded bg-pa-green/15 px-1.5 py-0.5 text-[10px] font-bold text-pa-green">
                    +50%
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="md"
                  className="flex-1"
                  loading={bulkSubmitting}
                  onClick={() => void handleBulkConvert()}
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  {isDe ? "Alle umwandeln" : "Convert all"}
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  disabled={bulkSubmitting}
                  onClick={() => setBulkDismissed(true)}
                >
                  {isDe ? "Nein danke" : "No thanks"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk conversion success indicator */}
        {bulkConverted && (
          <div className="flex items-center gap-2 rounded-xl border border-pa-green/20 bg-pa-green/8 px-4 py-3">
            <Sparkles className="h-4 w-4 shrink-0 text-pa-green" />
            <p className="text-sm text-pa-green">
              {isDe
                ? `${bulkCards.length} Bulk-Karten umgewandelt — +${bulkTotalWithBonus} Coins (inkl. 50% Bonus)`
                : `${bulkCards.length} bulk cards converted — +${bulkTotalWithBonus} Coins (incl. 50% bonus)`}
            </p>
          </div>
        )}

        {/* Card list with decision toggles */}
        <div className="space-y-2">
          {cards.map((c, i) => {
            const choice = choices.get(i);
            const isBulk = bulkIndices.has(i);
            const isBulkDone = bulkConverted && isBulk;
            const isRecovered = recoveredIndices.has(i);
            const bonusValue = isBulk
              ? Math.floor(c.conversionValue * (1 + BULK_CONVERSION_BONUS))
              : c.conversionValue;

            return (
              <div
                key={i}
                className={[
                  "flex items-center gap-3 rounded-xl border p-3",
                  isBulkDone
                    ? "border-pa-green/20 bg-pa-green/5"
                    : isRecovered
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

                {/* Decision toggle, bulk badge, or recovered status */}
                {isBulkDone ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-pa-green/15 px-2.5 py-1.5 text-xs font-medium text-pa-green">
                      <Coins className="h-3.5 w-3.5" />
                      {bonusValue}
                      <span className="text-[10px] opacity-70">+50%</span>
                    </span>
                  </div>
                ) : isRecovered ? (
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
                {convertedCount + (bulkConverted ? bulkCards.length : 0)}{" "}
                {isDe ? "Umwandlungen" : "Converts"}
              </span>
              {(coinsBack > 0 || bulkConverted) && (
                <span className="text-pa-green">
                  +{coinsBack + (bulkConverted ? bulkTotalWithBonus : 0)} Coins
                </span>
              )}
            </div>
            {!allDecided && (
              <span className="text-xs text-yellow-400">
                {isDe
                  ? `Noch ${cards.length - claimedCount - convertedCount - (bulkConverted ? bulkCards.length : 0) - recoveredIndices.size} offen`
                  : `${cards.length - claimedCount - convertedCount - (bulkConverted ? bulkCards.length : 0) - recoveredIndices.size} remaining`}
              </span>
            )}
          </div>
          {bulkConverted && (
            <p className="text-xs text-pa-green/70">
              {isDe
                ? `↳ davon ${bulkCards.length} Bulk-Karten mit +50% Bonus`
                : `↳ incl. ${bulkCards.length} bulk cards with +50% bonus`}
            </p>
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
          <button type="button" onClick={() => setRevealed(true)} className="w-full space-y-4">
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

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-text-primary">{currentCard.name}</h3>
              <Badge variant="info">{currentCard.rarity}</Badge>
            </div>

            <div className="flex items-center justify-center gap-4 text-sm">
              <span className="text-text-muted">
                {isDe ? "Wert" : "Value"}:{" "}
                <strong className="text-text-primary">{currentCard.coinValue} Coins</strong>
              </span>
              <span className="text-text-muted">
                {isDe ? "Umwandlung" : "Convert"}:{" "}
                <strong className="text-text-primary">
                  {currentCard.conversionValue} Coins
                </strong>
              </span>
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
                        onClick={() =>
                          setChoice(currentIndex, choice === "convert" ? null : "convert")
                        }
                      >
                        <Coins className="w-4 h-4 mr-1.5" />
                        {currentCard.conversionValue} Coins
                      </Button>
                    </div>
                    <Button variant="ghost" size="sm" className="w-full" onClick={advanceCard}>
                      <ArrowRight className="w-3.5 h-3.5 mr-1" />
                      {isLast
                        ? isDe
                          ? "Zur Übersicht"
                          : "Go to overview"
                        : choice
                          ? isDe
                            ? "Nächste Karte"
                            : "Next card"
                          : isDe
                            ? "Überspringen — später entscheiden"
                            : "Skip — decide later"}
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
