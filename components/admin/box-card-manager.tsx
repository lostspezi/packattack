"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Trash2, HelpCircle, CheckCircle2, AlertTriangle, XCircle, Lightbulb } from "lucide-react";
import { validateBoxWeights, type ValidationItem, type ValidationLevel } from "@/lib/box-validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import type { SelectOption } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { JustTCGCardSearch } from "@/components/admin/justtcg-card-search";
import { CardDetailModal } from "@/components/admin/card-detail-modal";
import type { AddCardPayload } from "@/components/admin/justtcg-card-search";
import type { RarityWeight } from "@/components/admin/rarity-weight-editor";
import type { JustTCGCardVariant } from "@/lib/justtcg";
import { AutoWeightCalculator } from "@/components/admin/auto-weight-calculator";

export interface BoxCard {
  _id: string;
  justTcgId: string;
  name: string;
  rarity: string;
  image: string | null;
  marketPrice: number | null;
  internalPrice: number | null;
  drawChance: number;
  weight: number;
  stock: number;
  minStock: number;
  condition: string;
  set?: string;
  setName?: string;
  tcgplayerId?: string | null;
  variants?: JustTCGCardVariant[];
  priceChange7d?: number | null;
  priceChange30d?: number | null;
}

interface RarityBreakdownEntry {
  rarity: string;
  weight: number;
  percentage: number;
}

interface BoxCardManagerProps {
  boxId: string;
  game: string;
  cardsPerPack: number;
  rarityWeights: RarityWeight[];
  lang: string;
  dict: Record<string, string>;
  onValidationChange?: (items: ValidationItem[]) => void;
  onBreakdownChange?: (breakdown: RarityBreakdownEntry[]) => void;
  onCardsChange?: (cards: BoxCard[]) => void;
  onPackPriceSuggestion?: (price: number) => void;
}

export type { RarityBreakdownEntry };

const validationIconMap: Record<ValidationLevel, React.ReactNode> = {
  error: <XCircle className="w-4 h-4 text-red-400 shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />,
  tip: <Lightbulb className="w-4 h-4 text-blue-400 shrink-0" />,
  ok: <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />,
};
const validationBgMap: Record<ValidationLevel, string> = {
  error: "bg-red-500/5 border-red-500/15",
  warning: "bg-yellow-500/5 border-yellow-500/15",
  tip: "bg-blue-500/5 border-blue-500/15",
  ok: "bg-green-500/5 border-green-500/15",
};
const validationTextMap: Record<ValidationLevel, string> = {
  error: "text-red-300",
  warning: "text-yellow-300",
  tip: "text-blue-300",
  ok: "text-green-300",
};

export function ValidationRow({ item, lang }: { item: ValidationItem; lang: string }) {
  const msg = lang === "de" ? item.message.de : item.message.en;
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${validationBgMap[item.level]}`}>
      {validationIconMap[item.level]}
      <span className={`text-[13px] leading-relaxed ${validationTextMap[item.level]}`}>{msg}</span>
    </div>
  );
}

function formatDrawChance(chance: number): string {
  if (chance === 0) return "0%";
  if (chance < 0.01) return `${chance.toFixed(4)}%`;
  if (chance < 0.1) return `${chance.toFixed(3)}%`;
  if (chance < 1) return `${chance.toFixed(3)}%`;
  return `${chance.toFixed(2)}%`;
}

export function BoxCardManager({
  boxId,
  game,
  cardsPerPack,
  rarityWeights,
  lang,
  dict,
  onValidationChange,
  onBreakdownChange,
  onCardsChange,
  onPackPriceSuggestion,
}: BoxCardManagerProps) {
  void dict;
  const isDe = lang === "de";
  const { toast } = useToast();

  const [cards, setCards] = useState<BoxCard[]>([]);
  const [rarityBreakdown, setRarityBreakdown] = useState<RarityBreakdownEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [internalPrices, setInternalPrices] = useState<Record<string, string>>({});
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [selectedCard, setSelectedCard] = useState<BoxCard | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [usdToEur, setUsdToEur] = useState<number | null>(null);
  const [stocks, setStocks] = useState<Record<string, string>>({});
  const [minStocks, setMinStocks] = useState<Record<string, string>>({});

  const existingCardIds = cards.map((c) => c.justTcgId);

  // Debounce timers for PATCH calls
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/boxes/${boxId}/cards`);
      if (!res.ok) {
        toast({ type: "error", title: "Failed to load cards" });
        return;
      }
      const data: { cards: BoxCard[]; rarityBreakdown?: RarityBreakdownEntry[]; usdToEur?: number } = await res.json();
      const fetched = data.cards ?? [];
      setCards(fetched);
      setRarityBreakdown(data.rarityBreakdown ?? []);
      if (data.usdToEur) setUsdToEur(data.usdToEur);

      const priceMap: Record<string, string> = {};
      const weightMap: Record<string, string> = {};
      const stockMap: Record<string, string> = {};
      const minStockMap: Record<string, string> = {};
      for (const card of fetched) {
        priceMap[card._id] = card.internalPrice !== null && card.internalPrice !== undefined
          ? String(card.internalPrice)
          : "";
        weightMap[card._id] = card.weight !== undefined ? String(card.weight) : "1";
        stockMap[card._id] = String(card.stock ?? 0);
        minStockMap[card._id] = String(card.minStock ?? 5);
      }
      setInternalPrices(priceMap);
      setWeights(weightMap);
      setStocks(stockMap);
      setMinStocks(minStockMap);
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setLoading(false);
    }
  }, [boxId, toast]);

  useEffect(() => {
    void fetchCards();
  }, [fetchCards]);

  async function handleAddCard(payload: AddCardPayload) {
    const res = await fetch(`/api/admin/boxes/${boxId}/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast({
        type: "error",
        title: (data as { error?: string }).error ?? "Failed to add card",
      });
      return;
    }
    toast({ type: "success", title: isDe ? "Karte hinzugefügt" : "Card added" });
    await fetchCards();
  }

  async function handleRemoveCard(cardId: string) {
    setRemovingIds((prev) => new Set(prev).add(cardId));
    try {
      const res = await fetch(`/api/admin/boxes/${boxId}/cards`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({
          type: "error",
          title: (data as { error?: string }).error ?? "Failed to remove card",
        });
        return;
      }
      setCards((prev) => prev.filter((c) => c._id !== cardId));
      toast({ type: "success", title: isDe ? "Karte entfernt" : "Card removed" });
      // Refresh to update draw chances and breakdown
      await fetchCards();
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(cardId);
        return next;
      });
    }
  }

  // Recompute draw chances and rarity breakdown locally (no refetch needed)
  function recomputeLocal(updatedCards: BoxCard[]) {
    const totalWeight = updatedCards.reduce((a, c) => a + c.weight, 0);
    const withChances = updatedCards.map((c) => ({
      ...c,
      drawChance: totalWeight > 0 ? (c.weight / totalWeight) * 100 : 0,
    }));
    setCards(withChances);

    const rarityMap = new Map<string, number>();
    for (const c of withChances) {
      rarityMap.set(c.rarity, (rarityMap.get(c.rarity) ?? 0) + c.weight);
    }
    setRarityBreakdown(
      Array.from(rarityMap.entries()).map(([rarity, weight]) => ({
        rarity,
        weight,
        percentage: totalWeight > 0 ? (weight / totalWeight) * 100 : 0,
      }))
    );
  }

  const conditionOptions: SelectOption[] = [
    { label: "Mint", value: "Mint" },
    { label: "Near Mint", value: "Near Mint" },
    { label: "Lightly Played", value: "Lightly Played" },
    { label: "Moderately Played", value: "Moderately Played" },
    { label: "Heavily Played", value: "Heavily Played" },
  ];

  function patchCard(cardId: string, patch: { weight?: number; rarity?: string; internalPrice?: number; stock?: number; minStock?: number; condition?: string }) {
    // Optimistic local update for weight/rarity
    if (patch.weight !== undefined || patch.rarity !== undefined) {
      setCards((prev) => {
        const updated = prev.map((c) =>
          c._id === cardId
            ? { ...c, ...(patch.weight !== undefined ? { weight: patch.weight } : {}), ...(patch.rarity !== undefined ? { rarity: patch.rarity } : {}) }
            : c
        );
        // Schedule recompute after state update
        setTimeout(() => recomputeLocal(updated), 0);
        return updated;
      });
    }

    fetch(`/api/admin/boxes/${boxId}/cards`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, ...patch }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast({
            type: "error",
            title: (data as { error?: string }).error ?? "Failed to update card",
          });
          // Revert on error
          await fetchCards();
        }
      })
      .catch(() => {
        toast({ type: "error", title: "Network error" });
      });
  }

  const WEIGHT_MIN = 0.001;
  const WEIGHT_MAX = 1000;

  function handleWeightChange(cardId: string, value: string) {
    // Allow digits, dots, commas
    const sanitised = value.replace(/[^0-9.,]/g, "");
    setWeights((prev) => ({ ...prev, [cardId]: sanitised }));

    // Debounce PATCH
    if (debounceTimers.current[cardId]) clearTimeout(debounceTimers.current[cardId]);
    debounceTimers.current[cardId] = setTimeout(() => {
      const num = parseFloat(sanitised.replace(",", "."));
      if (isNaN(num) || num < WEIGHT_MIN || num > WEIGHT_MAX) {
        toast({
          type: "error",
          title: isDe
            ? `Gewicht muss zwischen ${WEIGHT_MIN} und ${WEIGHT_MAX} liegen`
            : `Weight must be between ${WEIGHT_MIN} and ${WEIGHT_MAX}`,
        });
        return;
      }
      patchCard(cardId, { weight: num });
    }, 600);
  }

  function handleCoinChange(cardId: string, value: string) {
    const sanitised = value.replace(/[^0-9]/g, "");
    setInternalPrices((prev) => ({ ...prev, [cardId]: sanitised }));

    if (debounceTimers.current[`coin_${cardId}`]) clearTimeout(debounceTimers.current[`coin_${cardId}`]);
    debounceTimers.current[`coin_${cardId}`] = setTimeout(() => {
      const num = parseInt(sanitised, 10);
      if (isNaN(num) || num < 1) {
        toast({
          type: "error",
          title: isDe ? "Coin-Wert muss mindestens 1 sein" : "Coin value must be at least 1",
        });
        return;
      }
      patchCard(cardId, { internalPrice: num });
    }, 600);
  }

  function handleStockChange(cardId: string, value: string) {
    const sanitised = value.replace(/[^0-9]/g, "");
    setStocks((prev) => ({ ...prev, [cardId]: sanitised }));
    // Optimistic local update for row coloring
    const num = parseInt(sanitised, 10);
    if (!isNaN(num) && num >= 0) {
      setCards((prev) => prev.map((c) => c._id === cardId ? { ...c, stock: num } : c));
    }

    if (debounceTimers.current[`stock_${cardId}`]) clearTimeout(debounceTimers.current[`stock_${cardId}`]);
    debounceTimers.current[`stock_${cardId}`] = setTimeout(() => {
      if (isNaN(num) || num < 0) return;
      patchCard(cardId, { stock: num });
    }, 600);
  }

  function handleMinStockChange(cardId: string, value: string) {
    const sanitised = value.replace(/[^0-9]/g, "");
    setMinStocks((prev) => ({ ...prev, [cardId]: sanitised }));
    // Optimistic local update for row coloring
    const num = parseInt(sanitised, 10);
    if (!isNaN(num) && num >= 0) {
      setCards((prev) => prev.map((c) => c._id === cardId ? { ...c, minStock: num } : c));
    }

    if (debounceTimers.current[`mstock_${cardId}`]) clearTimeout(debounceTimers.current[`mstock_${cardId}`]);
    debounceTimers.current[`mstock_${cardId}`] = setTimeout(() => {
      if (isNaN(num) || num < 0) return;
      patchCard(cardId, { minStock: num });
    }, 600);
  }

  async function handleAutoWeightApply(
    updates: { cardId: string; weight: number; coinValue: number }[],
    suggestedPackPrice: number
  ) {
    // Apply all weight + coin updates via PATCH
    const promises = updates.map((u) =>
      fetch(`/api/admin/boxes/${boxId}/cards`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: u.cardId, weight: u.weight, internalPrice: u.coinValue }),
      })
    );
    await Promise.all(promises);

    // Notify parent about suggested pack price
    onPackPriceSuggestion?.(suggestedPackPrice);

    // Refresh cards to show updated values
    await fetchCards();
    toast({ type: "success", title: isDe ? "Gewichte & Coins übernommen" : "Weights & coins applied" });
  }

  function handleRarityChange(cardId: string, rarity: string) {
    setCards((prev) =>
      prev.map((c) => (c._id === cardId ? { ...c, rarity } : c))
    );
    patchCard(cardId, { rarity });
  }

  function handleRowClick(card: BoxCard) {
    setSelectedCard(card);
    setModalOpen(true);
  }

  // Build rarity options: box rarities + card's own rarity
  function buildRarityOptions(cardRarity: string): SelectOption[] {
    // Preserve order from rarityWeights (drag & drop order)
    const ordered = rarityWeights.map((rw) => rw.rarity);
    if (cardRarity && !ordered.includes(cardRarity)) {
      ordered.push(cardRarity);
    }
    return ordered.map((r) => ({ label: r, value: r }));
  }

  const [showHelp, setShowHelp] = useState(false);

  // --- Weight Distribution Validator (shared logic) ---
  const validationResults = useMemo(() => {
    if (cards.length === 0) return [];

    const results = validateBoxWeights({
      cards: cards.map((c) => ({ name: c.name, weight: c.weight, rarity: c.rarity })),
      rarityWeights,
      cardsPerPack,
    });

    // If no issues, show "all good"
    if (results.length === 0) {
      return [{
        level: "ok" as ValidationLevel,
        message: {
          de: "Die Gewichtung sieht gut aus — keine Probleme gefunden.",
          en: "Weight distribution looks good — no issues found.",
        },
      }] satisfies ValidationItem[];
    }

    return results;
  }, [cards, rarityWeights, cardsPerPack]);

  // Notify parent about validation state and breakdown
  useEffect(() => {
    onValidationChange?.(validationResults);
  }, [validationResults, onValidationChange]);

  useEffect(() => {
    onBreakdownChange?.(rarityBreakdown);
  }, [rarityBreakdown, onBreakdownChange]);

  useEffect(() => {
    onCardsChange?.(cards);
  }, [cards, onCardsChange]);

  return (
    <div className="space-y-4">
      {selectedCard && (
        <CardDetailModal
          card={selectedCard}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          lang={lang}
          game={game}
        />
      )}

      {/* Card search section */}
      <div className="bg-surface border border-border rounded-[14px] p-4 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">
          {isDe ? "Karten hinzufügen" : "Add Cards"}
        </h3>
        <JustTCGCardSearch
          game={game}
          existingCardIds={existingCardIds}
          onAddCard={handleAddCard}
          lang={lang}
        />
      </div>

      {/* Current cards section */}
      <div className="bg-surface border border-border rounded-[14px] p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-text-primary shrink-0">
            {isDe ? `Aktuelle Karten (${cards.length})` : `Current Cards (${cards.length})`}
          </h3>
          <div className="flex items-center gap-2">
            <AutoWeightCalculator
              cards={cards}
              cardsPerPack={cardsPerPack}
              lang={lang}
              onApply={handleAutoWeightApply}
            />
            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              {isDe ? "?" : "?"}
            </button>
          </div>
        </div>

        {showHelp && (
          <div className="bg-white/4 border border-border rounded-xl p-4 text-sm text-text-secondary space-y-3">
            <p className="font-medium text-text-primary">
              {isDe ? "So funktioniert die Gewichtung:" : "How weighting works:"}
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-[13px]">
              <li>
                {isDe
                  ? "Jede Karte bekommt ein Gewicht — je höher, desto wahrscheinlicher wird sie gezogen."
                  : "Each card gets a weight — the higher it is, the more likely it will be drawn."}
              </li>
              <li>
                {isDe
                  ? "Die Ziehchance berechnet sich automatisch: Gewicht der Karte geteilt durch die Summe aller Gewichte."
                  : "Draw chance is calculated automatically: card weight divided by the sum of all weights."}
              </li>
              <li>
                {isDe
                  ? "Erlaubte Werte: 0.001 (extrem selten) bis 1000 (sehr häufig)."
                  : "Allowed values: 0.001 (extremely rare) to 1000 (very common)."}
              </li>
              <li>
                {isDe
                  ? "Es zählt nur das Verhältnis — ob du 1, 10 oder 100 als Basis nutzt, ist egal."
                  : "Only the ratio matters — whether you use 1, 10, or 100 as your base doesn't matter."}
              </li>
            </ul>
            <div className="bg-white/4 rounded-lg p-3 text-[13px] space-y-1">
              <p className="font-medium text-text-primary">{isDe ? "Beispiel:" : "Example:"}</p>
              <p>
                {isDe
                  ? "3 Karten mit Gewicht 80, 15 und 5 → Ziehchancen: 80%, 15% und 5%."
                  : "3 cards with weight 80, 15 and 5 → draw chances: 80%, 15% and 5%."}
              </p>
              <p>
                {isDe
                  ? "Die gleichen Chancen bekommst du auch mit 8, 1.5 und 0.5 — das Verhältnis bleibt gleich."
                  : "You get the same chances with 8, 1.5 and 0.5 — the ratio stays the same."}
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-text-muted text-sm">
            {isDe ? "Laden…" : "Loading…"}
          </div>
        ) : cards.length === 0 ? (
          <div className="py-8 text-center text-text-muted text-sm">
            {isDe ? "Noch keine Karten in dieser Box." : "No cards in this box yet."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider w-10">
                    {isDe ? "Bild" : "Image"}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    {isDe ? "Name" : "Name"}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    {isDe ? "Rarität" : "Rarity"}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    {isDe ? "Gewicht" : "Weight"}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    {isDe ? "Marktpreis" : "Market Price"}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    {isDe ? "Coins" : "Coins"}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    {isDe ? "Bestand" : "Stock"}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    {isDe ? "Min." : "Min."}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    {isDe ? "Zustand" : "Condition"}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    {isDe ? "Ziehchance" : "Draw Chance"}
                  </th>
                  <th className="px-3 py-2 w-10" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {[...cards].sort((a, b) => (a.marketPrice ?? 0) - (b.marketPrice ?? 0)).map((card) => {
                  const rarityOptions = buildRarityOptions(card.rarity);
                  return (
                    <tr
                      key={card._id}
                      className={[
                        "border-b border-border last:border-0 cursor-pointer hover:bg-white/3 transition-colors",
                        (card.stock ?? 0) === 0 ? "bg-red-500/5" : (card.stock ?? 0) <= (card.minStock ?? 5) ? "bg-yellow-500/5" : "",
                      ].join(" ")}
                      onClick={() => handleRowClick(card)}
                    >
                      {/* Image */}
                      <td className="px-3 py-2">
                        {card.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={card.image}
                            alt={card.name}
                            className="w-20 min-w-20 shrink-0 rounded"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-20 min-w-20 shrink-0 aspect-[63/88] bg-white/4 rounded flex items-center justify-center">
                            <span className="text-text-muted text-xs">?</span>
                          </div>
                        )}
                      </td>

                      {/* Name + Set */}
                      <td className="px-3 py-2 max-w-[200px]">
                        <p className="text-sm text-text-primary font-medium line-clamp-2">{card.name}</p>
                        {card.setName && (
                          <p className="text-xs text-text-muted truncate">{card.setName}</p>
                        )}
                      </td>

                      {/* Rarity dropdown */}
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        {rarityOptions.length > 0 ? (
                          <Select
                            options={rarityOptions}
                            value={card.rarity}
                            onChange={(val) => handleRarityChange(card._id, val)}
                            size="sm"
                            className="min-w-[120px]"
                          />
                        ) : (
                          <Badge variant="info">{card.rarity}</Badge>
                        )}
                      </td>

                      {/* Weight input */}
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={weights[card._id] ?? "1"}
                          onChange={(e) => handleWeightChange(card._id, e.target.value)}
                          placeholder="1"
                          className="py-1 text-sm w-20"
                        />
                      </td>

                      {/* Market price + trend indicator */}
                      <td className="px-3 py-2 text-sm">
                        {card.marketPrice !== null && card.marketPrice !== undefined ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-pa-green font-medium">
                              {isDe && usdToEur
                                ? `${(card.marketPrice * usdToEur).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`
                                : `$${card.marketPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            </span>
                            {card.priceChange7d !== null && card.priceChange7d !== undefined && (
                              <span className={[
                                "inline-flex items-center gap-1 text-[11px] font-medium",
                                card.priceChange7d > 0 ? "text-green-400" : card.priceChange7d < 0 ? "text-red-400" : "text-text-muted",
                              ].join(" ")}>
                                <span>{card.priceChange7d > 0 ? "▲" : card.priceChange7d < 0 ? "▼" : "•"}</span>
                                {card.priceChange7d > 0 ? "+" : ""}{card.priceChange7d.toFixed(1)}% {isDe ? "7 Tage" : "7 days"}
                              </span>
                            )}
                          </div>
                        ) : "—"}
                      </td>

                      {/* Internal price in Coins (whole numbers only) */}
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={internalPrices[card._id] ?? ""}
                          onChange={(e) => handleCoinChange(card._id, e.target.value)}
                          placeholder="—"
                          className="py-1 text-sm w-24"
                        />
                      </td>

                      {/* Stock */}
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const stockVal = parseInt(stocks[card._id] ?? "0", 10) || 0;
                          const minStockVal = parseInt(minStocks[card._id] ?? "5", 10) || 0;
                          return (
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={stocks[card._id] ?? "0"}
                              onChange={(e) => handleStockChange(card._id, e.target.value)}
                              placeholder="0"
                              className={[
                                "py-1 text-sm w-16",
                                stockVal === 0
                                  ? "!border-red-500/40 !text-red-400"
                                  : stockVal <= minStockVal
                                  ? "!border-yellow-500/40 !text-yellow-400"
                                  : "",
                              ].join(" ")}
                            />
                          );
                        })()}
                      </td>

                      {/* Min Stock */}
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={minStocks[card._id] ?? "5"}
                          onChange={(e) => handleMinStockChange(card._id, e.target.value)}
                          placeholder="5"
                          className="py-1 text-sm w-14"
                        />
                      </td>

                      {/* Condition */}
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <Select
                          options={conditionOptions}
                          value={card.condition ?? "Near Mint"}
                          onChange={(val) => {
                            setCards((prev) => prev.map((c) => c._id === card._id ? { ...c, condition: val } : c));
                            patchCard(card._id, { condition: val });
                          }}
                          size="sm"
                          className="min-w-[100px]"
                        />
                      </td>

                      {/* Draw chance */}
                      <td className="px-3 py-2">
                        <Badge variant={card.drawChance > 0 && (card.stock ?? 0) > 0 ? "success" : "user"}>
                          {(card.stock ?? 0) === 0 ? "—" : formatDrawChance(card.drawChance)}
                        </Badge>
                      </td>

                      {/* Remove */}
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          aria-label={isDe ? "Karte entfernen" : "Remove card"}
                          loading={removingIds.has(card._id)}
                          onClick={() => void handleRemoveCard(card._id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
