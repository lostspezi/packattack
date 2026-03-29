"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search, Plus, Loader2, X, ChevronDown, Check } from "lucide-react";
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
  tcgplayerSkuId?: string | null;
  variants?: Array<{ condition: string; printing: string; price: number }>;
}

export interface ShopAddCardPayload {
  justTcgId: string;
  name: string;
  game: string;
  set: string;
  setName: string;
  rarity: string;
  tcgplayerId: string | null;
  tcgplayerSkuId: string | null;
  condition: string;
  stock: number;
  variants: Array<{ condition: string; printing: string; price: number }>;
}

interface JustTCGGame {
  id: string;
  name: string;
}

interface JustTCGSet {
  id: string;
  slug: string;
  name: string;
}

interface ShopCardSearchProps {
  existingInventoryIds: Set<string>;
  onAdd: (payload: ShopAddCardPayload) => Promise<void>;
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

// --- Main Shop Card Search ---
export function ShopCardSearch({
  existingInventoryIds,
  onAdd,
  lang,
}: ShopCardSearchProps) {
  const isDe = lang === "de";
  const { toast } = useToast();

  const [games, setGames] = useState<JustTCGGame[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [selectedGame, setSelectedGame] = useState<string>("");
  const [gameDropdownOpen, setGameDropdownOpen] = useState(false);
  const gameContainerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [selectedSets, setSelectedSets] = useState<Set<string>>(new Set());
  const [sets, setSets] = useState<JustTCGSet[]>([]);
  const [setsLoading, setSetsLoading] = useState(false);
  const [results, setResults] = useState<JustTCGCardResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  // Fetch games on mount
  useEffect(() => {
    setGamesLoading(true);
    fetch("/api/justtcg/games")
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json() as { games?: JustTCGGame[] };
        const list = data.games ?? [];
        setGames(list);
        if (list.length > 0) setSelectedGame(list[0].id);
      })
      .catch(() => {})
      .finally(() => setGamesLoading(false));
  }, []);

  // Fetch sets when game changes
  useEffect(() => {
    if (!selectedGame) return;
    setSetsLoading(true);
    setSelectedSets(new Set());
    fetch(`/api/justtcg/sets?game=${encodeURIComponent(selectedGame)}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json() as { sets?: JustTCGSet[] };
        setSets(data.sets ?? []);
      })
      .catch(() => {})
      .finally(() => setSetsLoading(false));
  }, [selectedGame]);

  // Close game dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (gameContainerRef.current && !gameContainerRef.current.contains(e.target as Node)) {
        setGameDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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
      return;
    }

    if (!selectedGame) return;

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const setIds = Array.from(selectedSets);

        if (setIds.length > 1 && hasSearch) {
          const limit = Math.max(5, Math.floor(20 / setIds.length));
          const fetches = setIds.map(async (setId) => {
            const params = new URLSearchParams({ game: selectedGame, set: setId, limit: String(limit) });
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
        } else {
          const params = new URLSearchParams({ game: selectedGame, limit: "20" });
          if (hasSearch) params.set("search", query);
          if (setIds.length === 1) params.set("set", setIds[0]);
          const res = await fetch(`/api/justtcg/cards?${params.toString()}`);
          if (!res.ok) {
            setResults([]);
            return;
          }
          const data = await res.json() as { cards?: JustTCGCardResult[] };
          setResults(data.cards ?? []);
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
  }, [query, selectedSets, selectedGame]);

  async function handleAdd(card: JustTCGCardResult) {
    const key = `${card.id}_Near Mint`;
    if (existingInventoryIds.has(key)) return;

    setAddingId(card.id);
    try {
      await onAdd({
        justTcgId: card.id,
        name: card.name,
        game: selectedGame,
        set: card.set ?? "",
        setName: card.set_name ?? card.setName ?? "",
        rarity: card.rarity,
        tcgplayerId: card.tcgplayerId ?? null,
        tcgplayerSkuId: card.tcgplayerSkuId ?? null,
        condition: "Near Mint",
        stock: 0,
        variants: card.variants ?? [],
      });
      toast({ type: "success", title: `${card.name} ${isDe ? "hinzugefügt" : "added"}` });
    } catch {
      toast({ type: "error", title: isDe ? "Fehler beim Hinzufügen" : "Failed to add card" });
    } finally {
      setAddingId(null);
    }
  }

  const selectedGameName = games.find((g) => g.id === selectedGame)?.name ?? selectedGame;
  const hasResults = results.length > 0;
  const showEmpty = !loading && (query.length >= 2 || selectedSets.size > 0) && results.length === 0;

  return (
    <div className="space-y-3">
      {/* Game selector */}
      <div ref={gameContainerRef} className="relative">
        {gamesLoading ? (
          <div className="h-[42px] flex items-center text-text-muted text-xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
            {isDe ? "Spiele laden…" : "Loading games…"}
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setGameDropdownOpen((v) => !v)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm rounded-[10px] border border-border bg-surface-elevated text-left hover:border-white/15 transition-colors min-h-[42px]"
            >
              <span className="flex-1 min-w-0 truncate text-text-primary font-medium">
                {selectedGameName || (isDe ? "Spiel wählen…" : "Select game…")}
              </span>
              <ChevronDown className={`w-4 h-4 text-text-muted shrink-0 transition-transform ${gameDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {gameDropdownOpen && games.length > 0 && (
              <div className="absolute z-50 mt-1 w-full bg-surface-elevated border border-border rounded-[12px] shadow-xl overflow-hidden">
                <div className="max-h-[240px] overflow-y-auto">
                  {games.map((g) => {
                    const isSelected = g.id === selectedGame;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          setSelectedGame(g.id);
                          setGameDropdownOpen(false);
                          setResults([]);
                          setQuery("");
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/4 transition-colors border-b border-border/30 last:border-0"
                      >
                        <span className={`w-4 h-4 shrink-0 flex items-center justify-center ${isSelected ? "text-pa-green" : ""}`}>
                          {isSelected && <Check className="w-4 h-4" />}
                        </span>
                        <span className="text-sm text-text-primary truncate">{g.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Filters row */}
      <div className="flex gap-3 flex-col sm:flex-row">
        {/* Card search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pa-green animate-spin" />
          )}
          <Input
            placeholder={isDe ? "Karte suchen (mind. 2 Zeichen)…" : "Search cards (min. 2 characters)…"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="py-2.5 text-sm pl-9 pr-9"
          />
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

      {/* Results list — always visible, scrollable */}
      {(hasResults || showEmpty) && (
        <div className="border border-border rounded-[12px] bg-surface-elevated overflow-hidden">
          {showEmpty ? (
            <div className="px-4 py-6 text-center text-sm text-text-muted">
              {isDe ? "Keine Karten gefunden." : "No cards found."}
            </div>
          ) : (
            <div className="max-h-[480px] overflow-y-auto divide-y divide-border/50">
              {results.map((card) => {
                const nmVariant = card.variants?.find((v) => v.condition === "Near Mint");
                const nmPrice = nmVariant?.price ?? null;
                const key = `${card.id}_Near Mint`;
                const alreadyAdded = existingInventoryIds.has(key);
                const isAdding = addingId === card.id;
                const setName = card.set_name ?? card.setName ?? "";

                return (
                  <div
                    key={card.id}
                    className="flex items-center gap-3 px-3 py-2.5"
                  >
                    {/* Card thumbnail */}
                    {card.tcgplayerId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayerId}_200w.jpg`}
                        alt=""
                        width={36}
                        height={50}
                        className="w-9 rounded shrink-0 object-cover"
                        style={{ height: "50px" }}
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-9 shrink-0 rounded bg-white/4 flex items-center justify-center" style={{ height: "50px" }}>
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

                    {/* NM price */}
                    <span className="shrink-0 text-xs text-text-secondary tabular-nums">
                      {nmPrice != null
                        ? `$${nmPrice.toFixed(2)}`
                        : <span className="text-text-muted">—</span>}
                    </span>

                    {/* Add / checkmark button */}
                    <button
                      type="button"
                      disabled={alreadyAdded || isAdding}
                      onClick={() => void handleAdd(card)}
                      className={[
                        "shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                        alreadyAdded
                          ? "bg-white/4 text-pa-green cursor-not-allowed"
                          : isAdding
                          ? "bg-white/4 text-pa-green cursor-wait"
                          : "bg-pa-green/10 hover:bg-pa-green/20 text-pa-green cursor-pointer",
                      ].join(" ")}
                      title={alreadyAdded
                        ? (isDe ? "Bereits vorhanden" : "Already added")
                        : (isDe ? "Hinzufügen" : "Add")}
                    >
                      {isAdding ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : alreadyAdded ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
