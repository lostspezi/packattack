"use client";

import React, { useState } from "react";
import { Trash2, Plus, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface RarityWeight {
  rarity: string;
  weight: number;
}

interface RarityWeightEditorProps {
  weights: RarityWeight[];
  onChange: (weights: RarityWeight[]) => void;
}

const COMMON_RARITIES: RarityWeight[] = [
  { rarity: "Common", weight: 60 },
  { rarity: "Uncommon", weight: 25 },
  { rarity: "Rare", weight: 12 },
  { rarity: "Ultra Rare", weight: 3 },
];

export function RarityWeightEditor({ weights, onChange }: RarityWeightEditorProps) {
  const [newRarity, setNewRarity] = useState("");

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

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <label className="block text-sm font-medium text-text-secondary">
          Rarity Weights
        </label>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handlePreset}
          className="flex items-center gap-1.5"
        >
          <Wand2 className="w-3.5 h-3.5" />
          Common Preset
        </Button>
      </div>

      {/* Weight rows */}
      <div className="space-y-2">
        {weights.length === 0 ? (
          <p className="text-sm text-text-muted py-2">
            No rarities added yet. Add one below or use the preset.
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
          placeholder="New rarity name…"
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
          Add Rarity
        </Button>
      </div>
    </div>
  );
}
