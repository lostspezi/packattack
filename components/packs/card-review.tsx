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

  // Wrap onSetChoice to close confirm dialog on any change
  function handleSetChoice(idx: number, choice: CardChoice) {
    onSetChoice(idx, choice);
    setConfirmOpen(false);
  }

  // Bulk actions — apply to all non-recovered cards
  function setAllChoices(choice: "claim" | "convert") {
    cards.forEach((_, i) => {
      if (!recoveredIndices.has(i)) onSetChoice(i, choice);
    });
    setConfirmOpen(false);
  }

  // Set choice for all indices in a group (no deselect — only switch)
  function setGroupChoice(group: CardGroup, choice: "claim" | "convert") {
    for (const idx of group.indices) {
      if (!recoveredIndices.has(idx)) {
        onSetChoice(idx, choice);
      }
    }
    setConfirmOpen(false);
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
    <div className="max-w-5xl mx-auto py-6 px-3 sm:px-4">
      <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-6">
        {/* ─── Left: Card list (scrolls on desktop) ─── */}
        <div className="space-y-3">
          {/* Header — mobile only (desktop header is on the right) */}
          <div className="text-center space-y-1 lg:hidden">
            <h2 className="text-lg font-bold text-text-primary">
              {isDe ? "Deine Karten" : "Your Cards"}
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
                    ? `Pack-Opening fortgesetzt. ${recoveredIndices.size} von ${cards.length} bereits entschieden.`
                    : `Dein letztes Pack-Opening wurde unterbrochen. Deine Karten sind sicher.`
                  : recoveredIndices.size > 0
                    ? `Pack opening resumed. ${recoveredIndices.size} of ${cards.length} already decided.`
                    : `Your last pack opening was interrupted. Your cards are safe.`}
              </p>
            </div>
          )}

          {/* Card groups */}
          <div className="space-y-2 lg:max-h-[calc(100dvh-10rem)] lg:overflow-y-auto lg:pr-2">
            {groups.map((group) => (
              <CardGroupRow
                key={group.card.cardId}
                group={group}
                choices={choices}
                onSetChoice={handleSetChoice}
                onSetGroupChoice={setGroupChoice}
                isDe={isDe}
              />
            ))}
            {recoveredGroups.map((group) => (
              <CardGroupRow
                key={`recovered-${group.card.cardId}`}
                group={group}
                choices={choices}
                onSetChoice={handleSetChoice}
                onSetGroupChoice={() => {}}
                isDe={isDe}
                locked
              />
            ))}
          </div>
        </div>

        {/* ─── Right: Sidebar with actions (sticky on desktop) ─── */}
        <div className="lg:sticky lg:top-6 lg:self-start space-y-4 mt-4 lg:mt-0">
          {/* Header — desktop only */}
          <div className="hidden lg:block space-y-1">
            <h2 className="text-xl font-bold text-text-primary">
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

          {/* Summary */}
          <div className="bg-white/4 border border-border rounded-xl p-4">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">{isDe ? "Warenkorb" : "Cart"}</span>
                <span className="text-green-400 font-medium">
                  {claimedCount} {claimedCount === 1 ? (isDe ? "Karte" : "card") : (isDe ? "Karten" : "cards")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">{isDe ? "Umwandeln" : "Convert"}</span>
                <span className="text-blue-400 font-medium">
                  {convertedCount} → {coinsBack} Coins
                </span>
              </div>
              {undecidedCount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">{isDe ? "Offen" : "Remaining"}</span>
                  <span className="text-yellow-400 font-medium">{undecidedCount}</span>
                </div>
              )}
            </div>
          </div>

          {/* Confirm */}
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
      </div>
    </div>
  );
}

// ─── Card Group Row ───────────────────────────────────────────────────

function CardGroupRow({ group, choices, onSetChoice, onSetGroupChoice, isDe, locked }: {
  group: CardGroup;
  choices: Map<number, CardChoice>;
  onSetChoice: (idx: number, choice: CardChoice) => void;
  onSetGroupChoice: (g: CardGroup, c: "claim" | "convert") => void;
  isDe: boolean;
  locked?: boolean;
}) {
  const { card, indices } = group;
  const count = indices.length;
  const isSingle = count === 1;

  // For single cards, use the direct choice
  const singleChoice = isSingle ? (choices.get(indices[0]) ?? null) : null;

  // For multi cards: check if all have the same choice (for header highlight)
  const allClaim = !isSingle && indices.every((i) => choices.get(i) === "claim");
  const allConvert = !isSingle && indices.every((i) => choices.get(i) === "convert");

  return (
    <div
      className={[
        "rounded-xl border overflow-hidden",
        locked ? "border-white/8 bg-white/3 opacity-60" : "border-border bg-surface",
      ].join(" ")}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 p-2.5 sm:p-3">
        {/* Image + count badge */}
        <div className="relative shrink-0">
          {card.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.image}
              alt={card.name}
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
          </div>
        </div>

        {/* Decision toggle — single card or locked */}
        {locked ? (
          <LockedBadge choice={choices.get(indices[0]) ?? null} conversionValue={card.conversionValue * count} isDe={isDe} />
        ) : isSingle ? (
          <ChoiceButtons
            choice={singleChoice}
            conversionValue={card.conversionValue}
            onClaim={() => onSetChoice(indices[0], "claim")}
            onConvert={() => onSetChoice(indices[0], "convert")}
            isDe={isDe}
          />
        ) : (
          /* Multi: "All to" buttons for the group */
          <ChoiceButtons
            choice={allClaim ? "claim" : allConvert ? "convert" : null}
            conversionValue={card.conversionValue * count}
            onClaim={() => onSetGroupChoice(group, "claim")}
            onConvert={() => onSetGroupChoice(group, "convert")}
            isDe={isDe}
            label={isDe ? "Alle" : "All"}
          />
        )}
      </div>

      {/* Per-copy rows for multi cards */}
      {!locked && !isSingle && (
        <div className="border-t border-border/50">
          {indices.map((idx, copyIdx) => {
            const copyChoice = choices.get(idx) ?? null;
            return (
              <div
                key={idx}
                className={[
                  "flex items-center justify-between gap-3 px-3 sm:px-4 py-2",
                  copyIdx < indices.length - 1 ? "border-b border-border/30" : "",
                ].join(" ")}
              >
                <span className="text-xs text-text-muted">
                  {isDe ? "Kopie" : "Copy"} {copyIdx + 1}
                </span>
                <ChoiceButtons
                  choice={copyChoice}
                  conversionValue={card.conversionValue}
                  onClaim={() => onSetChoice(idx, "claim")}
                  onConvert={() => onSetChoice(idx, "convert")}
                  isDe={isDe}
                  small
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Reusable Choice Buttons ──────────────────────────────────────────

function ChoiceButtons({ choice, conversionValue, onClaim, onConvert, isDe, label, small }: {
  choice: CardChoice;
  conversionValue: number;
  onClaim: () => void;
  onConvert: () => void;
  isDe: boolean;
  label?: string;
  small?: boolean;
}) {
  const size = small ? "px-1.5 py-1 text-[11px]" : "px-2 sm:px-2.5 py-1.5 text-xs";
  const iconSize = small ? "w-3 h-3" : "w-3.5 h-3.5";

  return (
    <div className="flex gap-1.5 shrink-0">
      <button
        type="button"
        onClick={onClaim}
        className={`${size} font-medium rounded-lg border transition-all ${
          choice === "claim"
            ? "bg-green-500/15 text-green-400 border-green-500/30"
            : "bg-white/4 text-text-muted border-border hover:bg-white/6"
        }`}
      >
        <ShoppingCart className={`${iconSize} inline mr-0.5 sm:mr-1`} />
        {label && <span className="hidden sm:inline mr-0.5">{label} </span>}
        <span className="hidden sm:inline">{isDe ? "Warenkorb" : "Cart"}</span>
      </button>
      <button
        type="button"
        onClick={onConvert}
        className={`${size} font-medium rounded-lg border transition-all ${
          choice === "convert"
            ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
            : "bg-white/4 text-text-muted border-border hover:bg-white/6"
        }`}
      >
        <Coins className={`${iconSize} inline mr-0.5 sm:mr-1`} />
        {conversionValue}
      </button>
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
