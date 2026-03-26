"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search, Plus, Loader2, X, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

interface JustTCGCardResult {
  id: string;
  name: string;
  rarity: string;
  set?: string;
  set_name?: string;
  setName?: string;
  tcgplayerId?: string | null;
  variants?: Array<{ condition: string; printing: string; price: number }>;
}

export interface AddCardPayload {
  justTcgId: string;
  name: string;
  game: string;
  set: string;
  setName: string;
  rarity: string;
  tcgplayerId: string | null;
  variants: Array<{ condition: string; printing: string; price: number }>;
}

interface JustTCGSet {
  id: string;
  slug: string;
  name: string;
}

interface JustTCGCardSearchProps {
  game: string;
  existingCardIds: string[];
  onAddCard: (payload: AddCardPayload) => void;
  lang: string;
}

// --- Set Multi-Select Autocomplete ---
function SetFilter({
  sets,
  selectedSets,
  onToggle,
  onClear,
  loading,
  lang,
}: {
  sets: JustTCGSet[];
  selectedSets: Set<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
  loading: boolean;
  lang: string;
}) {
  const isDe = lang === "de";
  const [setQuery, setSetQuery] = useState("");
  const [setDropdownOpen, setSetDropdownOpen] = useState(false);
  const setContainerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!setQuery.trim()) return sets;
    const q = setQuery.toLowerCase();
    return sets.filter((s) => s.name.toLowerCase().includes(q));
  }, [sets, setQuery]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (setContainerRef.current && !setContainerRef.current.contains(e.target as Node)) {
        setSetDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (loading) {
    return (
      <div className="h-[42px] flex items-center text-text-muted text-xs">
        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
        {isDe ? "Sets laden…" : "Loading sets…"}
      </div>
    );
  }

  const selectedList = sets.filter((s) => selectedSets.has(s.id));

  return (
    <div ref={setContainerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setSetDropdownOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm rounded-[10px] border border-border bg-surface-elevated text-left hover:border-white/15 transition-colors min-h-[42px]"
      >
        <span className="flex-1 min-w-0 truncate text-text-secondary">
          {selectedSets.size === 0
            ? (isDe ? "Sets filtern…" : "Filter by set…")
            : (isDe ? `${selectedSets.size} Set(s) ausgewählt` : `${selectedSets.size} set(s) selected`)}
        </span>
        <ChevronDown className={`w-4 h-4 text-text-muted shrink-0 transition-transform ${setDropdownOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Selected chips */}
      {selectedList.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedList.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-pa-green/10 text-pa-green border border-pa-green/20"
            >
              <span className="truncate max-w-[200px]">{s.name}</span>
              <button
                type="button"
                onClick={() => onToggle(s.id)}
                className="shrink-0 hover:text-white transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] text-text-muted hover:text-text-secondary transition-colors px-1"
          >
            {isDe ? "Alle entfernen" : "Clear all"}
          </button>
        </div>
      )}

      {/* Dropdown */}
      {setDropdownOpen && (
        <div className="absolute z-50 mt-1 w-full bg-surface-elevated border border-border rounded-[12px] shadow-xl overflow-hidden">
          {/* Search within sets */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
              <input
                type="text"
                value={setQuery}
                onChange={(e) => setSetQuery(e.target.value)}
                placeholder={isDe ? "Set suchen…" : "Search sets…"}
                className="w-full pl-8 pr-3 py-2 text-sm bg-white/4 border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-pa-green/50"
                autoFocus
              />
            </div>
          </div>

          {/* Set list */}
          <div className="max-h-[240px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-text-muted">
                {isDe ? "Keine Sets gefunden." : "No sets found."}
              </div>
            ) : (
              filtered.map((s) => {
                const isSelected = selectedSets.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onToggle(s.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/4 transition-colors border-b border-border/30 last:border-0"
                  >
                    <span className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center text-[10px] ${isSelected ? "bg-pa-green border-pa-green text-black" : "border-border"}`}>
                      {isSelected && "✓"}
                    </span>
                    <span className="text-sm text-text-primary truncate">{s.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main Card Search ---
export function JustTCGCardSearch({
  game,
  existingCardIds,
  onAddCard,
  lang,
}: JustTCGCardSearchProps) {
  const isDe = lang === "de";
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [selectedSets, setSelectedSets] = useState<Set<string>>(new Set());
  const [sets, setSets] = useState<JustTCGSet[]>([]);
  const [setsLoading, setSetsLoading] = useState(false);
  const [results, setResults] = useState<JustTCGCardResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch sets for the game
  useEffect(() => {
    if (!game) return;
    setSetsLoading(true);
    fetch(`/api/justtcg/sets?game=${encodeURIComponent(game)}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json() as { sets?: JustTCGSet[] };
        setSets(data.sets ?? []);
      })
      .catch(() => {})
      .finally(() => setSetsLoading(false));
  }, [game]);

  function toggleSet(id: string) {
    setSelectedSets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSets() {
    setSelectedSets(new Set());
  }

  // Debounced search
  useEffect(() => {
    const hasSearch = query.length >= 2;
    const hasSets = selectedSets.size > 0;

    if (!hasSearch && !hasSets) {
      setResults([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const setIds = Array.from(selectedSets);

        // If multiple sets selected, fire parallel requests and merge
        if (setIds.length > 1 && hasSearch) {
          const limit = Math.max(5, Math.floor(20 / setIds.length));
          const fetches = setIds.map(async (setId) => {
            const params = new URLSearchParams({ game, set: setId, limit: String(limit) });
            if (hasSearch) params.set("search", query);
            const res = await fetch(`/api/justtcg/cards?${params.toString()}`);
            if (!res.ok) return [];
            const data = await res.json() as { cards?: JustTCGCardResult[] };
            return data.cards ?? [];
          });
          const allResults = await Promise.all(fetches);
          // Merge and dedupe by id
          const seen = new Set<string>();
          const merged: JustTCGCardResult[] = [];
          for (const batch of allResults) {
            for (const card of batch) {
              if (!seen.has(card.id)) {
                seen.add(card.id);
                merged.push(card);
              }
            }
          }
          setResults(merged.slice(0, 20));
          setOpen(true);
        } else {
          // Single set or no set
          const params = new URLSearchParams({ game, limit: "20" });
          if (hasSearch) params.set("search", query);
          if (setIds.length === 1) params.set("set", setIds[0]);
          const res = await fetch(`/api/justtcg/cards?${params.toString()}`);
          if (!res.ok) {
            setResults([]);
            return;
          }
          const data = await res.json() as { cards?: JustTCGCardResult[] };
          setResults(data.cards ?? []);
          setOpen(true);
        }
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
  }, [query, selectedSets, game]);

  // Close card dropdown on click outside
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
      await onAddCard({
        justTcgId: card.id,
        name: card.name,
        game,
        set: card.set ?? "",
        setName: card.set_name ?? card.setName ?? "",
        rarity: card.rarity,
        tcgplayerId: card.tcgplayerId ?? null,
        variants: card.variants ?? [],
      });
      toast({ type: "success", title: `${card.name} ${isDe ? "hinzugefügt" : "added"}` });
    } catch {
      toast({ type: "error", title: isDe ? "Fehler beim Hinzufügen" : "Failed to add card" });
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* Filters row */}
      <div className="flex gap-3 flex-col sm:flex-row">
        {/* Card search input */}
        <div ref={containerRef} className="relative flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pa-green animate-spin" />
            )}
            <Input
              placeholder={isDe ? "Karte suchen (mind. 2 Zeichen)…" : "Search cards (min. 2 characters)…"}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => { if (results.length > 0) setOpen(true); }}
              className="py-2.5 text-sm pl-9 pr-9"
            />
          </div>

          {/* Card autocomplete dropdown */}
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
                    {/* Card image */}
                    {card.tcgplayerId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayerId}_200w.jpg`}
                        alt=""
                        className="w-16 h-22 object-cover rounded shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-16 h-22 bg-white/4 rounded shrink-0 flex items-center justify-center">
                        <span className="text-text-muted text-[10px]">?</span>
                      </div>
                    )}

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
          {open && (query.length >= 2 || selectedSets.size > 0) && !loading && results.length === 0 && (
            <div className="absolute z-50 mt-1 w-full bg-surface-elevated border border-border rounded-[12px] shadow-xl p-4 text-center text-sm text-text-muted">
              {isDe ? "Keine Karten gefunden." : "No cards found."}
            </div>
          )}
        </div>

        {/* Set filter */}
        <div className="sm:w-[300px]">
          <SetFilter
            sets={sets}
            selectedSets={selectedSets}
            onToggle={toggleSet}
            onClear={clearSets}
            loading={setsLoading}
            lang={lang}
          />
        </div>
      </div>
    </div>
  );
}
