"use client";

import { useState } from "react";
import { ShoppingCart, Coins, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

type CardChoice = "claim" | "convert" | null;

interface CardGroup {
  /** Representative card (first occurrence) */
  card: DrawnCard;
  /** Original indices in the cards array */
  indices: number[];
}

interface CardReviewProps {
  cards: DrawnCard[];
  boxName: string;
  lang: string;
  isRecovery: boolean;
  recoveredIndices: Set<number>;
  choices: Map<number, CardChoice>;
  onSetChoice: (idx: number, choice: CardChoice) => void;
  onConfirm: () => void;
  submitting: boolean;
}

function groupCards(cards: DrawnCard[], recoveredIndices: Set<number>): {
  groups: CardGroup[];
  recoveredGroups: CardGroup[];
} {
  const normalMap = new Map<string, CardGroup>();
  const recoveredMap = new Map<string, CardGroup>();

  cards.forEach((card, i) => {
    const key = card.cardId;
    const isRecovered = recoveredIndices.has(i);
    const map = isRecovered ? recoveredMap : normalMap;

    const existing = map.get(key);
    if (existing) {
      existing.indices.push(i);
    } else {
      map.set(key, { card, indices: [i] });
    }
  });

  return {
    groups: [...normalMap.values()],
    recoveredGroups: [...recoveredMap.values()],
  };
}

export function CardReview({
  cards, boxName, lang, isRecovery, recoveredIndices,
  choices, onSetChoice, onConfirm, submitting,
}: CardReviewProps) {
  const isDe = lang === "de";
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { groups, recoveredGroups } = groupCards(cards, recoveredIndices);

  // Bulk actions — apply to all non-recovered cards
  function setAllChoices(choice: "claim" | "convert") {
    cards.forEach((_, i) => {
      if (!recoveredIndices.has(i)) onSetChoice(i, choice);
    });
  }

  // Set choice for all indices in a group
  function setGroupChoice(group: CardGroup, choice: "claim" | "convert") {
    for (const idx of group.indices) {
      if (!recoveredIndices.has(idx)) {
        onSetChoice(idx, choices.get(idx) === choice ? null : choice);
      }
    }
  }

  // Stats
  const allDecided = cards.every(
    (_, i) =>
      recoveredIndices.has(i) ||
      choices.get(i) === "claim" ||
      choices.get(i) === "convert",
  );
  const claimedCount = [...choices.entries()].filter(
    ([, c]) => c === "claim",
  ).length;
  const convertedCount = [...choices.entries()].filter(
    ([, c]) => c === "convert",
  ).length;
  const undecidedCount = cards.length - claimedCount - convertedCount - recoveredIndices.size;
  const coinsBack = cards.reduce(
    (sum, c, i) => (choices.get(i) === "convert" ? sum + c.conversionValue : sum),
    0,
  );
  const totalValue = cards.reduce((sum, c) => sum + c.conversionValue, 0);

  return (
    <div className="max-w-2xl mx-auto space-y-4 py-6 px-3 sm:px-4">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-lg sm:text-xl font-bold text-text-primary">
          {isDe ? "Deine Karten" : "Your Cards"}
        </h2>
        <p className="text-sm text-text-secondary">
          {boxName} · {cards.length} {isDe ? "Karten" : "cards"}
          {groups.length < cards.length - recoveredIndices.size && (
            <span className="text-text-muted">
              {" "}({groups.length} {isDe ? "einzigartige" : "unique"})
            </span>
          )}
        </p>
      </div>

      {/* Recovery banner */}
      {isRecovery && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/8 px-4 py-3">
          <RotateCcw className="h-4 w-4 shrink-0 text-blue-400" />
          <p className="text-sm text-blue-300">
            {isDe
              ? recoveredIndices.size > 0
                ? `Pack-Opening fortgesetzt. ${recoveredIndices.size} von ${cards.length} bereits entschieden.`
                : `Dein letztes Pack-Opening wurde unterbrochen. Deine Karten sind sicher.`
              : recoveredIndices.size > 0
                ? `Pack opening resumed. ${recoveredIndices.size} of ${cards.length} already decided.`
                : `Your last pack opening was interrupted. Your cards are safe.`}
          </p>
        </div>
      )}

      {/* Bulk action buttons */}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="md"
          className="flex-1"
          onClick={() => setAllChoices("claim")}
        >
          <ShoppingCart className="w-4 h-4 mr-1.5" />
          {isDe ? "Alle in Warenkorb" : "All to Cart"}
        </Button>
        <Button
          variant="secondary"
          size="md"
          className="flex-1"
          onClick={() => setAllChoices("convert")}
        >
          <Coins className="w-4 h-4 mr-1.5" />
          {isDe ? `Alle umwandeln (${totalValue})` : `Convert all (${totalValue})`}
        </Button>
      </div>

      {/* Card groups */}
      <div className="space-y-2">
        {groups.map((group) => (
          <CardGroupRow
            key={group.card.cardId}
            group={group}
            choices={choices}
            onSetGroupChoice={setGroupChoice}
            isDe={isDe}
          />
        ))}

        {/* Recovered groups (locked) */}
        {recoveredGroups.map((group) => (
          <CardGroupRow
            key={`recovered-${group.card.cardId}`}
            group={group}
            choices={choices}
            onSetGroupChoice={() => {}}
            isDe={isDe}
            locked
          />
        ))}
      </div>

      {/* Summary */}
      <div className="bg-white/4 border border-border rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          {claimedCount > 0 && (
            <span className="flex items-center gap-1.5 text-green-400">
              <ShoppingCart className="w-3.5 h-3.5" />
              {claimedCount} {isDe ? "Warenkorb" : "Cart"}
            </span>
          )}
          {convertedCount > 0 && (
            <span className="flex items-center gap-1.5 text-blue-400">
              <Coins className="w-3.5 h-3.5" />
              {convertedCount} → {coinsBack} Coins
            </span>
          )}
          {undecidedCount > 0 && (
            <span className="text-yellow-400 text-xs">
              {undecidedCount} {isDe ? "offen" : "remaining"}
            </span>
          )}
        </div>
      </div>

      {/* Confirm / show confirmation dialog */}
      {!confirmOpen ? (
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={!allDecided}
          onClick={() => setConfirmOpen(true)}
        >
          {allDecided
            ? isDe ? "Weiter" : "Continue"
            : isDe ? "Bitte alle Karten entscheiden" : "Please decide all cards"}
        </Button>
      ) : (
        <ConfirmDialog
          claimedCount={claimedCount}
          convertedCount={convertedCount}
          coinsBack={coinsBack}
          isDe={isDe}
          submitting={submitting}
          onConfirm={onConfirm}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Card Group Row ───────────────────────────────────────────────────

function CardGroupRow({ group, choices, onSetGroupChoice, isDe, locked }: {
  group: CardGroup;
  choices: Map<number, CardChoice>;
  onSetGroupChoice: (g: CardGroup, c: "claim" | "convert") => void;
  isDe: boolean;
  locked?: boolean;
}) {
  const { card, indices } = group;
  const count = indices.length;
  // Use first index's choice as representative (all should be the same for a group toggle)
  const choice = choices.get(indices[0]) ?? null;
  // Check if all indices in group have the same choice
  const allSame = indices.every((i) => choices.get(i) === choice);
  const effectiveChoice = allSame ? choice : null;

  return (
    <div
      className={[
        "flex items-center gap-3 rounded-xl border p-2.5 sm:p-3",
        locked ? "border-white/8 bg-white/3 opacity-60" : "border-border bg-surface",
      ].join(" ")}
    >
      {/* Image + count badge */}
      <div className="relative shrink-0">
        {card.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.image}
            alt=""
            className="w-11 sm:w-14 rounded"
            loading="lazy"
            draggable={false}
          />
        ) : (
          <div className="w-11 sm:w-14 aspect-[63/88] bg-white/4 rounded" />
        )}
        {count > 1 && (
          <span className="absolute -top-1.5 -right-1.5 bg-pa-green text-bg text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {count}x
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{card.name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <Badge variant="info" className="text-[10px]">{card.rarity}</Badge>
          <span className="text-[11px] text-text-muted">{card.coinValue} Coins</span>
          {count > 1 && (
            <span className="text-[11px] text-text-muted">
              · {card.conversionValue * count} {isDe ? "gesamt" : "total"}
            </span>
          )}
        </div>
      </div>

      {/* Decision toggle */}
      {locked ? (
        <LockedBadge choice={effectiveChoice} conversionValue={card.conversionValue * count} isDe={isDe} />
      ) : (
        <div className="flex gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onSetGroupChoice(group, "claim")}
            className={`px-2 sm:px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              effectiveChoice === "claim"
                ? "bg-green-500/15 text-green-400 border-green-500/30"
                : "bg-white/4 text-text-muted border-border hover:bg-white/6"
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5 inline mr-0.5 sm:mr-1" />
            <span className="hidden sm:inline">{isDe ? "Warenkorb" : "Cart"}</span>
          </button>
          <button
            type="button"
            onClick={() => onSetGroupChoice(group, "convert")}
            className={`px-2 sm:px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              effectiveChoice === "convert"
                ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                : "bg-white/4 text-text-muted border-border hover:bg-white/6"
            }`}
          >
            <Coins className="w-3.5 h-3.5 inline mr-0.5 sm:mr-1" />
            {card.conversionValue * count}
          </button>
        </div>
      )}
    </div>
  );
}

function LockedBadge({ choice, conversionValue, isDe }: {
  choice: CardChoice; conversionValue: number; isDe: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium shrink-0 ${
      choice === "claim"
        ? "bg-green-500/15 text-green-400"
        : "bg-blue-500/15 text-blue-400"
    }`}>
      {choice === "claim" ? (
        <><ShoppingCart className="h-3.5 w-3.5" /> {isDe ? "Warenkorb" : "Cart"}</>
      ) : (
        <><Coins className="h-3.5 w-3.5" /> {conversionValue}</>
      )}
      <Check className="h-3 w-3 opacity-50" />
    </span>
  );
}

// ─── Confirmation Dialog ──────────────────────────────────────────────

function ConfirmDialog({ claimedCount, convertedCount, coinsBack, isDe, submitting, onConfirm, onCancel }: {
  claimedCount: number;
  convertedCount: number;
  coinsBack: number;
  isDe: boolean;
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 sm:p-5 space-y-4">
      <h3 className="text-base font-bold text-text-primary text-center">
        {isDe ? "Bist du sicher?" : "Are you sure?"}
      </h3>
      <div className="space-y-2 text-sm">
        {claimedCount > 0 && (
          <div className="flex items-center gap-2 text-green-400">
            <ShoppingCart className="w-4 h-4 shrink-0" />
            <span>
              {claimedCount} {claimedCount === 1
                ? (isDe ? "Karte wird in den Warenkorb gelegt" : "card will be added to cart")
                : (isDe ? "Karten werden in den Warenkorb gelegt" : "cards will be added to cart")}
            </span>
          </div>
        )}
        {convertedCount > 0 && (
          <div className="flex items-center gap-2 text-blue-400">
            <Coins className="w-4 h-4 shrink-0" />
            <span>
              {convertedCount} {convertedCount === 1
                ? (isDe ? "Karte wird umgewandelt" : "card will be converted")
                : (isDe ? "Karten werden umgewandelt" : "cards will be converted")}
              {" → "}
              <strong className="text-pa-green">+{coinsBack} Coins</strong>
            </span>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="md"
          className="flex-1"
          onClick={onCancel}
          disabled={submitting}
        >
          {isDe ? "Zurück" : "Back"}
        </Button>
        <Button
          variant="primary"
          size="md"
          className="flex-1"
          loading={submitting}
          onClick={onConfirm}
        >
          {isDe ? "Bestätigen" : "Confirm"}
        </Button>
      </div>
    </div>
  );
}
