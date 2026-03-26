"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { SelectOption } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import type { JustTCGCard, JustTCGSet } from "@/lib/justtcg";

interface JustTCGCardSearchProps {
  game: string;
  existingCardIds: string[];
  onAddCard: (justTcgId: string) => void;
  lang: string;
}

const PAGE_LIMIT = 12;

export function JustTCGCardSearch({
  game,
  existingCardIds,
  onAddCard,
  lang,
}: JustTCGCardSearchProps) {
  const isDe = lang === "de";
  const { toast } = useToast();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [setFilter, setSetFilter] = useState("");
  const [page, setPage] = useState(1);

  const [sets, setSets] = useState<JustTCGSet[]>([]);
  const [cards, setCards] = useState<JustTCGCard[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());

  // Fetch sets for filter
  useEffect(() => {
    if (!game) return;
    fetch(`/api/justtcg/sets?game=${encodeURIComponent(game)}`)
      .then((r) => r.json())
      .then((data: { sets?: JustTCGSet[] }) => {
        if (Array.isArray(data.sets)) setSets(data.sets);
      })
      .catch(() => {/* silently ignore */});
  }, [game]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchCards = useCallback(async () => {
    if (!game) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("game", game);
      params.set("page", String(page));
      params.set("limit", String(PAGE_LIMIT));
      if (search) params.set("search", search);
      if (setFilter) params.set("set", setFilter);

      const res = await fetch(`/api/justtcg/cards?${params.toString()}`);
      if (!res.ok) {
        toast({ type: "error", title: "Failed to load cards" });
        return;
      }
      const data: { cards: JustTCGCard[]; total?: number } = await res.json();
      setCards(data.cards ?? []);
      setTotal(data.total ?? 0);
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setLoading(false);
    }
  }, [game, page, search, setFilter, toast]);

  useEffect(() => {
    void fetchCards();
  }, [fetchCards]);

  const setOptions: SelectOption[] = [
    { label: isDe ? "Alle Sets" : "All sets", value: "" },
    ...sets.map((s): SelectOption => ({ label: s.name, value: s.id })),
  ];

  const totalPages = Math.ceil(total / PAGE_LIMIT);

  async function handleAdd(justTcgId: string) {
    setAddingIds((prev) => new Set(prev).add(justTcgId));
    try {
      await onAddCard(justTcgId);
    } finally {
      setAddingIds((prev) => {
        const next = new Set(prev);
        next.delete(justTcgId);
        return next;
      });
    }
  }

  return (
    <div className="space-y-4">
      {/* Search controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          <Input
            placeholder={isDe ? "Karte suchen…" : "Search cards…"}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="py-2 text-sm pl-9"
          />
        </div>
        <Select
          options={setOptions}
          value={setFilter}
          onChange={(val) => { setSetFilter(val); setPage(1); }}
          size="md"
          className="w-full sm:w-52"
        />
      </div>

      {/* Results */}
      {loading ? (
        <div className="py-8 text-center text-text-muted text-sm">
          {isDe ? "Laden…" : "Loading…"}
        </div>
      ) : cards.length === 0 ? (
        <div className="py-8 text-center text-text-muted text-sm">
          {isDe ? "Keine Karten gefunden." : "No cards found."}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {cards.map((card) => {
            const alreadyAdded = existingCardIds.includes(card.id);
            const isAdding = addingIds.has(card.id);
            return (
              <div
                key={card.id}
                className="bg-surface border border-border rounded-[12px] overflow-hidden flex flex-col"
              >
                {/* Card image */}
                <div className="aspect-[2/3] bg-white/4 flex items-center justify-center overflow-hidden">
                  {(card.image || card.tcgplayerId) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={card.image || `https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayerId}_200w.jpg`}
                      alt={card.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <span className="text-text-muted text-xs text-center px-2">
                      {isDe ? "Kein Bild" : "No image"}
                    </span>
                  )}
                </div>

                {/* Card info */}
                <div className="p-2 flex flex-col gap-1 flex-1">
                  <p className="text-xs font-medium text-text-primary line-clamp-2 leading-tight">
                    {card.name}
                  </p>
                  <p className="text-xs text-text-muted truncate">{card.setName}</p>
                  <Badge variant="info" className="self-start text-xs">
                    {card.rarity}
                  </Badge>
                  {card.marketPrice !== null && card.marketPrice !== undefined && (
                    <p className="text-xs text-text-secondary">
                      ${card.marketPrice.toFixed(2)}
                    </p>
                  )}
                  <Button
                    type="button"
                    variant={alreadyAdded ? "secondary" : "primary"}
                    size="sm"
                    disabled={alreadyAdded}
                    loading={isAdding}
                    onClick={() => void handleAdd(card.id)}
                    className="mt-auto w-full text-xs"
                  >
                    {!isAdding && <Plus className="w-3.5 h-3.5" />}
                    {alreadyAdded
                      ? (isDe ? "Hinzugefügt" : "Added")
                      : (isDe ? "Hinzufügen" : "Add")}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            {isDe ? "Zurück" : "Prev"}
          </Button>
          <span className="text-sm text-text-muted">
            {page} / {totalPages}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            {isDe ? "Weiter" : "Next"}
          </Button>
        </div>
      )}
    </div>
  );
}
