"use client";

import React, { useState } from "react";
import { Trash2, Plus, Wand2, Download } from "lucide-react";
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

const COMMON_RARITIES: RarityWeight[] = [
  { rarity: "Common", weight: 60 },
  { rarity: "Uncommon", weight: 25 },
  { rarity: "Rare", weight: 12 },
  { rarity: "Ultra Rare", weight: 3 },
];

export function RarityWeightEditor({ weights, onChange, game }: RarityWeightEditorProps) {
  const [newRarity, setNewRarity] = useState("");
  const [loadingRarities, setLoadingRarities] = useState(false);
  const { toast } = useToast();

  const total = weights.reduce((acc, w) => acc + (w.weight || 0), 0);
  const isExact = total === 100;

  function handleWeightChange(index: number, value: string) {
    const num = parseInt(value, 10);
    const updated = weights.map((w, i) =>
      i === index ? { ...w, weight: isNaN(num) ? 0 : Math.max(0, Math.min(100, num)) } : w
    );
    onChange(updated);
  }

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

  function handlePreset() {
    onChange(COMMON_RARITIES);
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
      // Merge: keep existing weights for rarities that already exist, add new ones with 0
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
          Rarity Weights
        </label>
        <div className="flex gap-2">
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
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handlePreset}
            className="flex items-center gap-1.5"
          >
            <Wand2 className="w-3.5 h-3.5" />
            Standard-Preset
          </Button>
        </div>
      </div>

      {/* Weight rows */}
      <div className="space-y-2">
        {weights.length === 0 ? (
          <p className="text-sm text-text-muted py-2">
            Noch keine Rarities hinzugefügt. Füge eine hinzu oder nutze einen Preset.
          </p>
        ) : (
          weights.map((w, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="flex-1 text-sm text-text-primary truncate min-w-0 bg-white/4 border border-border rounded-[10px] px-3 py-2">
                {w.rarity}
              </span>
              <div className="w-24 shrink-0">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={w.weight}
                  onChange={(e) => handleWeightChange(i, e.target.value)}
                  className="py-2 text-sm text-center"
                />
              </div>
              <span className="text-xs text-text-muted w-4 shrink-0">%</span>
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

      {/* Total indicator */}
      <div
        className={[
          "rounded-[10px] px-4 py-2.5 flex items-center justify-between",
          isExact
            ? "bg-green-500/10 border border-green-500/20"
            : "bg-red-500/10 border border-red-500/20",
        ].join(" ")}
      >
        <div
          className={[
            "h-2 rounded-full transition-all",
            isExact ? "bg-green-500" : "bg-red-500",
          ].join(" ")}
          style={{ width: `${Math.min(100, total)}%`, minWidth: total > 0 ? "4px" : "0" }}
        />
        <span
          className={[
            "text-sm font-semibold ml-3 shrink-0",
            isExact ? "text-green-400" : "text-red-400",
          ].join(" ")}
        >
          {isExact ? "100% ✓" : `${total} / 100%`}
        </span>
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
