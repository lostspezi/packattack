"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, Plus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

interface JustTCGCardResult {
  id: string;
  name: string;
  rarity: string;
  set_name?: string;
  setName?: string;
  tcgplayerId?: string | null;
}

interface JustTCGCardSearchProps {
  game: string;
  existingCardIds: string[];
  onAddCard: (justTcgId: string) => void;
  lang: string;
}

export function JustTCGCardSearch({
  game,
  existingCardIds,
  onAddCard,
  lang,
}: JustTCGCardSearchProps) {
  const isDe = lang === "de";
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<JustTCGCardResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search — fires after 400ms, minimum 3 chars
  useEffect(() => {
    if (query.length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          game,
          search: query,
          limit: "20",
        });
        const res = await fetch(`/api/justtcg/cards?${params.toString()}`);
        if (!res.ok) {
          setResults([]);
          return;
        }
        const data = await res.json() as { cards?: JustTCGCardResult[] };
        setResults(data.cards ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      setLoading(false);
    };
  }, [query, game]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleAdd(card: JustTCGCardResult) {
    if (existingCardIds.includes(card.id)) return;
    setAddingId(card.id);
    try {
      await onAddCard(card.id);
      toast({ type: "success", title: `${card.name} ${isDe ? "hinzugefügt" : "added"}` });
      // Don't close — user might want to add more
    } catch {
      toast({ type: "error", title: isDe ? "Fehler beim Hinzufügen" : "Failed to add card" });
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pa-green animate-spin" />
        )}
        <Input
          placeholder={isDe ? "Karte suchen (mind. 3 Zeichen)…" : "Search cards (min. 3 characters)…"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          className="py-2.5 text-sm pl-9 pr-9"
        />
      </div>

      {/* Autocomplete dropdown */}
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-[320px] overflow-y-auto bg-surface-elevated border border-border rounded-[12px] shadow-xl">
          {results.map((card) => {
            const alreadyAdded = existingCardIds.includes(card.id);
            const isAdding = addingId === card.id;
            const setName = card.set_name ?? card.setName ?? "";

            return (
              <button
                key={card.id}
                type="button"
                disabled={alreadyAdded || isAdding}
                onClick={() => void handleAdd(card)}
                className={[
                  "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b border-border/50 last:border-b-0",
                  alreadyAdded
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-white/4 cursor-pointer",
                ].join(" ")}
              >
                {/* Card info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {card.name}
                  </p>
                  <p className="text-xs text-text-muted truncate">
                    {setName}{setName && card.rarity ? " · " : ""}{card.rarity}
                  </p>
                </div>

                {/* Rarity badge */}
                <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded bg-white/6 text-text-secondary border border-border">
                  {card.rarity || "—"}
                </span>

                {/* Add indicator */}
                <span className="shrink-0 w-6 h-6 flex items-center justify-center">
                  {isAdding ? (
                    <Loader2 className="w-4 h-4 text-pa-green animate-spin" />
                  ) : alreadyAdded ? (
                    <span className="text-xs text-text-muted">✓</span>
                  ) : (
                    <Plus className="w-4 h-4 text-pa-green" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* No results message */}
      {open && query.length >= 3 && !loading && results.length === 0 && (
        <div className="absolute z-50 mt-1 w-full bg-surface-elevated border border-border rounded-[12px] shadow-xl p-4 text-center text-sm text-text-muted">
          {isDe ? "Keine Karten gefunden." : "No cards found."}
        </div>
      )}
    </div>
  );
}
