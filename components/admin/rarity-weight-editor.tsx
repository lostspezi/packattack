"use client";

import React, { useState } from "react";
import { Trash2, Plus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

export interface RarityWeight {
  rarity: string;
  weight: number;
}

interface RarityWeightEditorProps {
  weights: RarityWeight[];
  onChange: (weights: RarityWeight[]) => void;
  game?: string;
}

export function RarityWeightEditor({ weights, onChange, game }: RarityWeightEditorProps) {
  const [newRarity, setNewRarity] = useState("");
  const [loadingRarities, setLoadingRarities] = useState(false);
  const { toast } = useToast();

  function handleDelete(index: number) {
    onChange(weights.filter((_, i) => i !== index));
  }

  function handleAddRarity() {
    const trimmed = newRarity.trim();
    if (!trimmed) return;
    if (weights.some((w) => w.rarity.toLowerCase() === trimmed.toLowerCase())) return;
    onChange([...weights, { rarity: trimmed, weight: 0 }]);
    setNewRarity("");
  }

  async function handleLoadFromApi() {
    if (!game) return;
    setLoadingRarities(true);
    try {
      const res = await fetch(`/api/justtcg/rarities?game=${encodeURIComponent(game)}`);
      if (!res.ok) {
        toast({ type: "error", title: "Rarities konnten nicht geladen werden" });
        return;
      }
      const data = await res.json() as { rarities?: string[] };
      const rarities = data.rarities;
      if (!rarities || rarities.length === 0) {
        toast({ type: "warning", title: "Keine Rarities für dieses Spiel gefunden" });
        return;
      }
      // Merge: keep existing entries for rarities that already exist, add new ones with weight 0
      const existingMap = new Map(weights.map((w) => [w.rarity.toLowerCase(), w]));
      const merged: RarityWeight[] = rarities
        .filter((r) => r && r !== "None")
        .map((r) => existingMap.get(r.toLowerCase()) ?? { rarity: r, weight: 0 });
      onChange(merged);
      toast({ type: "success", title: `${merged.length} Rarities geladen` });
    } catch {
      toast({ type: "error", title: "Fehler beim Laden der Rarities" });
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
            Vom Spiel laden
          </Button>
        )}
      </div>

      {/* Rarity rows */}
      <div className="space-y-2">
        {weights.length === 0 ? (
          <p className="text-sm text-text-muted py-2">
            Noch keine Rarities hinzugefügt. Füge eine hinzu oder lade vom Spiel.
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

      {/* Add new rarity */}
      <div className="flex gap-2">
        <Input
          placeholder="Neue Rarity…"
          value={newRarity}
          onChange={(e) => setNewRarity(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddRarity(); } }}
          className="flex-1 py-2 text-sm"
        />
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
    </div>
  );
}
