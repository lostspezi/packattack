"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

interface SetEntry {
  set: string;
  setName: string;
  cardCount: number;
}
interface GameEntry {
  game: string;
  sets: SetEntry[];
}

export interface SetTemplateSelection {
  game: string;
  set: string;
  setName: string;
  cardCount: number;
}

export function SetTemplatePicker({
  value,
  onChange,
  isDe,
}: {
  value: SetTemplateSelection | null;
  onChange: (next: SetTemplateSelection | null) => void;
  isDe: boolean;
}) {
  const [games, setGames] = useState<GameEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<string>("");

  useEffect(() => {
    fetch("/api/binders/template-options")
      .then(async (res) => {
        if (!res.ok) throw new Error("fetch");
        return (await res.json()) as { games: GameEntry[] };
      })
      .then((data) => {
        setGames(data.games);
      })
      .catch(() => setError(isDe ? "Konnte nicht laden." : "Could not load."))
      .finally(() => setLoading(false));
  }, [isDe]);

  const sets = useMemo(() => {
    const found = games.find((g) => g.game === selectedGame);
    return found ? found.sets : [];
  }, [games, selectedGame]);

  if (loading) {
    return (
      <div className="py-8 text-center">
        <Loader2 className="w-5 h-5 animate-spin mx-auto text-pa-green" />
      </div>
    );
  }
  if (error) {
    return <p className="text-error text-sm">{error}</p>;
  }
  if (games.length === 0) {
    return (
      <p className="text-text-muted text-sm">
        {isDe
          ? "Keine Sets verfügbar. Es gibt noch keine Karten im System."
          : "No sets available. The card catalog is empty."}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          {isDe ? "TCG" : "TCG"}
        </label>
        <div className="flex flex-wrap gap-2">
          {games.map((g) => {
            const active = selectedGame === g.game;
            return (
              <button
                key={g.game}
                type="button"
                onClick={() => {
                  setSelectedGame(g.game);
                  if (value && value.game !== g.game) onChange(null);
                }}
                className={[
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-pa-green text-bg"
                    : "bg-white/5 text-text-primary hover:bg-white/10",
                ].join(" ")}
              >
                {g.game}
              </button>
            );
          })}
        </div>
      </div>

      {selectedGame && (
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            {isDe ? "Set" : "Set"}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
            {sets.map((s) => {
              const active = value?.set === s.set;
              return (
                <button
                  key={s.set}
                  type="button"
                  onClick={() =>
                    onChange({
                      game: selectedGame,
                      set: s.set,
                      setName: s.setName,
                      cardCount: s.cardCount,
                    })
                  }
                  className={[
                    "text-left px-3 py-2 rounded-lg border transition-colors flex items-center justify-between gap-3",
                    active
                      ? "border-pa-green bg-pa-green/10"
                      : "border-white/8 hover:border-white/20",
                  ].join(" ")}
                >
                  <span className="text-sm text-text-primary line-clamp-1">
                    {s.setName}
                  </span>
                  <span className="text-[11px] text-text-muted whitespace-nowrap">
                    {s.cardCount} {isDe ? "Karten" : "cards"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
