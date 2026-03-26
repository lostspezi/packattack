"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  set?: string;
  setName?: string;
  tcgplayerId?: string | null;
  variants?: JustTCGCardVariant[];
}

interface BoxCardManagerProps {
  boxId: string;
  game: string;
  rarityWeights: RarityWeight[];
  lang: string;
  dict: Record<string, string>;
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
  const [loading, setLoading] = useState(false);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [internalPrices, setInternalPrices] = useState<Record<string, string>>({});
  const [selectedCard, setSelectedCard] = useState<BoxCard | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const existingCardIds = cards.map((c) => c.justTcgId);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/boxes/${boxId}/cards`);
      if (!res.ok) {
        toast({ type: "error", title: "Failed to load cards" });
        return;
      }
      const data: { cards: BoxCard[] } = await res.json();
      const fetched = data.cards ?? [];
      setCards(fetched);
      // Initialize internal price inputs
      const priceMap: Record<string, string> = {};
      for (const card of fetched) {
        priceMap[card._id] = card.internalPrice !== null && card.internalPrice !== undefined
          ? String(card.internalPrice)
          : "";
      }
      setInternalPrices(priceMap);
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

  function formatDrawChance(chance: number) {
    if (chance === 0) return "0%";
    return `${chance.toFixed(2)}%`;
  }

  function handleRowClick(card: BoxCard) {
    setSelectedCard(card);
    setModalOpen(true);
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
          {rarityWeights.length > 0 && (
            <span className="text-xs text-text-muted">
              {isDe ? "Ziehchance basiert auf Rarität" : "Draw chance based on rarity"}
            </span>
          )}
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
                {cards.map((card) => (
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

                    {/* Rarity */}
                    <td className="px-3 py-2">
                      <Badge variant="info">{card.rarity}</Badge>
                    </td>

                    {/* Market price (average from variants) */}
                    <td className="px-3 py-2 text-sm text-text-secondary">
                      {card.marketPrice !== null && card.marketPrice !== undefined
                        ? (
                          <span className="text-pa-green font-medium">
                            ${card.marketPrice.toFixed(2)}
                          </span>
                        )
                        : "—"}
                    </td>

                    {/* Internal price (editable, accepts , and . for decimals) */}
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={internalPrices[card._id] ?? ""}
                        onChange={(e) => {
                          // Allow digits, dots, and commas
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
