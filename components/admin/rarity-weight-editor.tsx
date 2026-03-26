"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Trash2, Plus, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export interface RarityWeight {
  rarity: string;
  weight: number;
}

interface SavedRarity {
  id: string;
  name: string;
  game: string;
}

interface RarityWeightEditorProps {
  weights: RarityWeight[];
  onChange: (weights: RarityWeight[]) => void;
  game?: string;
  lang?: string;
}

export function RarityWeightEditor({ weights, onChange, game, lang }: RarityWeightEditorProps) {
  const isDe = (lang ?? "de") === "de";
  const [newRarity, setNewRarity] = useState("");
  const [loadingRarities, setLoadingRarities] = useState(false);
  const [savedRarities, setSavedRarities] = useState<SavedRarity[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load saved rarities for this game
  useEffect(() => {
    if (!game) return;
    fetch(`/api/admin/rarities?game=${encodeURIComponent(game)}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json() as { rarities?: SavedRarity[] };
        setSavedRarities(data.rarities ?? []);
      })
      .catch(() => {});
  }, [game]);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Filter suggestions: saved rarities not already in the list, matching input
  const suggestions = useMemo(() => {
    const existing = new Set(weights.map((w) => w.rarity.toLowerCase()));
    const q = newRarity.toLowerCase().trim();
    return savedRarities.filter((r) => {
      if (existing.has(r.name.toLowerCase())) return false;
      if (q && !r.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [savedRarities, weights, newRarity]);

  function handleDelete(index: number) {
    onChange(weights.filter((_, i) => i !== index));
  }

  async function saveRarityToDb(name: string) {
    if (!game) return;
    try {
      await fetch("/api/admin/rarities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, game }),
      });
      // Refresh saved list
      const res = await fetch(`/api/admin/rarities?game=${encodeURIComponent(game)}`);
      if (res.ok) {
        const data = await res.json() as { rarities?: SavedRarity[] };
        setSavedRarities(data.rarities ?? []);
      }
    } catch {
      // Silent — saving is a convenience, not critical
    }
  }

  function addRarity(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (weights.some((w) => w.rarity.toLowerCase() === trimmed.toLowerCase())) return;
    onChange([...weights, { rarity: trimmed, weight: 0 }]);
    setNewRarity("");
    setShowSuggestions(false);
    void saveRarityToDb(trimmed);
  }

  function handleAddRarity() {
    addRarity(newRarity);
  }

  async function handleLoadFromApi() {
    if (!game) return;
    setLoadingRarities(true);
    try {
      const res = await fetch(`/api/justtcg/rarities?game=${encodeURIComponent(game)}`);
      if (!res.ok) {
        toast({ type: "error", title: isDe ? "Rarities konnten nicht geladen werden" : "Failed to load rarities" });
        return;
      }
      const data = await res.json() as { rarities?: string[] };
      const rarities = data.rarities;
      if (!rarities || rarities.length === 0) {
        toast({ type: "warning", title: isDe ? "Keine Rarities für dieses Spiel gefunden" : "No rarities found for this game" });
        return;
      }
      // Merge: keep existing, add new with weight 0
      const existingMap = new Map(weights.map((w) => [w.rarity.toLowerCase(), w]));
      const merged: RarityWeight[] = rarities
        .filter((r) => r && r !== "None")
        .map((r) => existingMap.get(r.toLowerCase()) ?? { rarity: r, weight: 0 });
      onChange(merged);

      // Save all to DB
      for (const r of rarities.filter((r) => r && r !== "None")) {
        void saveRarityToDb(r);
      }

      toast({ type: "success", title: `${merged.length} Rarities ${isDe ? "geladen" : "loaded"}` });
    } catch {
      toast({ type: "error", title: isDe ? "Fehler beim Laden der Rarities" : "Error loading rarities" });
    } finally {
      setLoadingRarities(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="block text-sm font-medium text-text-secondary">
          Rarities
        </label>
        {game && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleLoadFromApi}
            loading={loadingRarities}
            className="flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            {isDe ? "Vom Spiel laden" : "Load from game"}
          </Button>
        )}
      </div>

      {/* Rarity rows */}
      <div className="space-y-2">
        {weights.length === 0 ? (
          <p className="text-sm text-text-muted py-2">
            {isDe
              ? "Noch keine Rarities hinzugefügt. Füge eine hinzu oder lade vom Spiel."
              : "No rarities added yet. Add one or load from game."}
          </p>
        ) : (
          weights.map((w, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="flex-1 text-sm text-text-primary truncate min-w-0 bg-white/4 border border-border rounded-[10px] px-3 py-2">
                {w.rarity}
              </span>
              <Button
                type="button"
                variant="danger"
                size="sm"
                aria-label={`Remove ${w.rarity}`}
                onClick={() => handleDelete(i)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Add new rarity with autocomplete */}
      <div ref={containerRef} className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              placeholder={isDe ? "Rarity suchen oder neu erstellen…" : "Search or create rarity…"}
              value={newRarity}
              onChange={(e) => {
                setNewRarity(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddRarity();
                }
              }}
              className="w-full pl-9 pr-3 py-2 text-sm bg-surface-elevated border border-border rounded-[10px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-pa-green/50 transition-colors"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleAddRarity}
            disabled={!newRarity.trim()}
            className="shrink-0"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 mt-1 w-full max-h-[200px] overflow-y-auto bg-surface-elevated border border-border rounded-[12px] shadow-xl">
            {suggestions.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => addRarity(r.name)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm text-text-primary hover:bg-white/4 transition-colors border-b border-border/30 last:border-0"
              >
                <Plus className="w-3.5 h-3.5 text-pa-green shrink-0" />
                <span className="truncate">{r.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Saved rarities hint */}
      {savedRarities.length > 0 && newRarity === "" && !showSuggestions && (
        <p className="text-[11px] text-text-muted">
          {isDe
            ? `${savedRarities.length} gespeicherte Rarity/Rarities für dieses Spiel verfügbar`
            : `${savedRarities.length} saved rarity/rarities available for this game`}
        </p>
      )}
    </div>
  );
}
