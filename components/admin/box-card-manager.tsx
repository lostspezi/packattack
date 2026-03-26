"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Trash2 } from "lucide-react";
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

interface BoxCard {
  _id: string;
  justTcgId: string;
  name: string;
  rarity: string;
  image: string | null;
  marketPrice: number | null;
  internalPrice: number | null;
  drawChance: number;
  weight: number;
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
  rarityWeights: RarityWeight[];
  lang: string;
  dict: Record<string, string>;
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
  rarityWeights,
  lang,
  dict,
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
      const data: { cards: BoxCard[]; rarityBreakdown?: RarityBreakdownEntry[] } = await res.json();
      const fetched = data.cards ?? [];
      setCards(fetched);
      setRarityBreakdown(data.rarityBreakdown ?? []);

      const priceMap: Record<string, string> = {};
      const weightMap: Record<string, string> = {};
      for (const card of fetched) {
        priceMap[card._id] = card.internalPrice !== null && card.internalPrice !== undefined
          ? String(card.internalPrice)
          : "";
        weightMap[card._id] = card.weight !== undefined ? String(card.weight) : "1";
      }
      setInternalPrices(priceMap);
      setWeights(weightMap);
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

  function patchCard(cardId: string, patch: { weight?: number; rarity?: string }) {
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
        } else {
          // Refresh to get updated draw chances
          await fetchCards();
        }
      })
      .catch(() => {
        toast({ type: "error", title: "Network error" });
      });
  }

  function handleWeightChange(cardId: string, value: string) {
    // Allow digits, dots, commas
    const sanitised = value.replace(/[^0-9.,]/g, "");
    setWeights((prev) => ({ ...prev, [cardId]: sanitised }));

    // Debounce PATCH
    if (debounceTimers.current[cardId]) clearTimeout(debounceTimers.current[cardId]);
    debounceTimers.current[cardId] = setTimeout(() => {
      const num = parseFloat(sanitised.replace(",", "."));
      if (!isNaN(num) && num >= 0) {
        patchCard(cardId, { weight: num });
      }
    }, 600);
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
    const raritySet = new Set<string>(rarityWeights.map((rw) => rw.rarity));
    if (cardRarity) raritySet.add(cardRarity);
    return Array.from(raritySet).map((r) => ({ label: r, value: r }));
  }

  return (
    <div className="space-y-6">
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
      <div className="bg-surface border border-border rounded-[14px] p-6 space-y-4">
        <h3 className="text-base font-semibold text-text-primary">
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
      <div className="bg-surface border border-border rounded-[14px] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-text-primary">
            {isDe ? `Aktuelle Karten (${cards.length})` : `Current Cards (${cards.length})`}
          </h3>
          <span className="text-xs text-text-muted">
            {isDe ? "Ziehchance = Gewicht / Gesamtgewicht" : "Draw chance = weight / total weight"}
          </span>
        </div>

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
                    {isDe ? "Int. Preis" : "Int. Price"}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    {isDe ? "Ziehchance" : "Draw Chance"}
                  </th>
                  <th className="px-3 py-2 w-10" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {cards.map((card) => {
                  const rarityOptions = buildRarityOptions(card.rarity);
                  return (
                    <tr
                      key={card._id}
                      className="border-b border-border last:border-0 cursor-pointer hover:bg-white/3 transition-colors"
                      onClick={() => handleRowClick(card)}
                    >
                      {/* Image */}
                      <td className="px-3 py-2">
                        {card.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={card.image}
                            alt={card.name}
                            className="w-8 h-11 object-cover rounded"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-8 h-11 bg-white/4 rounded flex items-center justify-center">
                            <span className="text-text-muted text-xs">?</span>
                          </div>
                        )}
                      </td>

                      {/* Name */}
                      <td className="px-3 py-2 text-sm text-text-primary font-medium max-w-[200px]">
                        <span className="line-clamp-2">{card.name}</span>
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
                              ${card.marketPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

                      {/* Internal price (editable) */}
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={internalPrices[card._id] ?? ""}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9.,]/g, "");
                            setInternalPrices((prev) => ({
                              ...prev,
                              [card._id]: val,
                            }));
                          }}
                          placeholder="—"
                          className="py-1 text-sm w-24"
                        />
                      </td>

                      {/* Draw chance */}
                      <td className="px-3 py-2">
                        <Badge variant={card.drawChance > 0 ? "success" : "user"}>
                          {formatDrawChance(card.drawChance)}
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

      {/* Rarity Summary */}
      {rarityBreakdown.length > 0 && (
        <div className="bg-surface border border-border rounded-[14px] p-6 space-y-4">
          <h3 className="text-base font-semibold text-text-primary">
            {isDe ? "Rarität-Zusammenfassung" : "Rarity Summary"}
          </h3>
          <div className="space-y-3">
            {rarityBreakdown.map((entry) => (
              <div key={entry.rarity} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-primary font-medium">{entry.rarity}</span>
                  <span className="text-text-secondary tabular-nums">
                    {entry.percentage < 0.01
                      ? `${entry.percentage.toFixed(4)}%`
                      : entry.percentage < 1
                      ? `${entry.percentage.toFixed(3)}%`
                      : `${entry.percentage.toFixed(2)}%`}
                  </span>
                </div>
                <div className="h-2 bg-white/6 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-pa-green/70 rounded-full transition-all"
                    style={{ width: `${Math.min(100, entry.percentage)}%`, minWidth: entry.percentage > 0 ? "2px" : "0" }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end">
            <span className="text-xs text-text-muted">
              {isDe ? "Gesamt" : "Total"}: {rarityBreakdown.reduce((a, e) => a + e.percentage, 0).toFixed(2)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
