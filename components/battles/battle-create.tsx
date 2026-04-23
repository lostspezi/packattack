"use client";

import React, { useState } from "react";
import { Swords, Globe, Lock, Loader2, ArrowDownToLine, ArrowUpToLine } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface BoxOption {
  _id: string;
  name: { de: string; en: string };
  game: string;
  image: string | null;
}

interface BattleCreateProps {
  boxes: BoxOption[];
  lang: string;
  onCreated: (battle: { slug: string }) => void;
}

const PLAYER_COUNTS = [2, 3, 4] as const;
const ROUND_OPTIONS = [3, 5, 7] as const;
const MODES = [
  { value: "lowest_card" as const, label: { de: "Niedrigste Karte", en: "Lowest Card" }, icon: <ArrowDownToLine className="h-5 w-5 text-blue-400" />, desc: { de: "Die niedrigste Karte gewinnt die Runde", en: "The lowest card wins the round" } },
  { value: "highest_card" as const, label: { de: "Höchste Karte", en: "Highest Card" }, icon: <ArrowUpToLine className="h-5 w-5 text-orange-400" />, desc: { de: "Die höchste Karte gewinnt die Runde", en: "The highest card wins the round" } },
];

export function BattleCreate({ boxes, lang, onCreated }: BattleCreateProps) {
  const isDe = lang === "de";
  const { toast } = useToast();

  const [selectedBox, setSelectedBox] = useState<string>("");
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(2);
  const [rounds, setRounds] = useState<3 | 5 | 7>(3);
  const [mode, setMode] = useState<string>("lowest_card");
  const [isPrivate, setIsPrivate] = useState(false);
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!selectedBox) {
      toast({ title: isDe ? "Bitte Box wählen" : "Please select a box", type: "error" });
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/battles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boxId: selectedBox, playerCount, rounds, mode, isPrivate }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || "Error", type: "error" });
        return;
      }

      onCreated(data.battle);
    } catch {
      toast({ title: isDe ? "Fehler beim Erstellen" : "Error creating battle", type: "error" });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-xl bg-zinc-900 border border-zinc-800 p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold text-yellow-400">
        <Swords className="h-5 w-5" />
        {isDe ? "Battle erstellen" : "Create Battle"}
      </h2>

      {/* Box Selection */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {isDe ? "Box wählen" : "Select Box"}
        </label>
        <div className="flex flex-wrap gap-2">
          {boxes.map((box) => (
            <button
              key={box._id}
              onClick={() => setSelectedBox(box._id)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all ${
                selectedBox === box._id
                  ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                  : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600"
              }`}
            >
              {box.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={box.image} alt="" className="h-8 w-8 rounded object-cover" />
              )}
              <span>{isDe ? box.name.de : box.name.en}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Player Count */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {isDe ? "Spieler" : "Players"}
        </label>
        <div className="flex gap-2">
          {PLAYER_COUNTS.map((count) => (
            <button
              key={count}
              onClick={() => setPlayerCount(count)}
              className={`rounded-lg border px-4 py-2 text-sm font-bold transition-all ${
                playerCount === count
                  ? "border-yellow-400 bg-yellow-400 text-black"
                  : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600"
              }`}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      {/* Rounds */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {isDe ? "Runden" : "Rounds"}
        </label>
        <div className="flex gap-2">
          {ROUND_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => setRounds(r)}
              className={`rounded-lg border px-4 py-2 text-sm font-bold transition-all ${
                rounds === r
                  ? "border-yellow-400 bg-yellow-400 text-black"
                  : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Mode */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {isDe ? "Modus" : "Mode"}
        </label>
        <div className="flex flex-col gap-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-all ${
                mode === m.value
                  ? "border-yellow-400 bg-yellow-400/10"
                  : "border-zinc-700 bg-zinc-800 hover:border-zinc-600"
              }`}
            >
              <span className="text-lg">{m.icon}</span>
              <div>
                <div className={mode === m.value ? "font-bold text-yellow-400" : "text-zinc-300"}>
                  {isDe ? m.label.de : m.label.en}
                </div>
                <div className="text-xs text-zinc-500">{isDe ? m.desc.de : m.desc.en}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Visibility */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {isDe ? "Sichtbarkeit" : "Visibility"}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setIsPrivate(false)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
              !isPrivate
                ? "border-yellow-400 bg-yellow-400 text-black"
                : "border-zinc-700 bg-zinc-800 text-zinc-300"
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            {isDe ? "Öffentlich" : "Public"}
          </button>
          <button
            onClick={() => setIsPrivate(true)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
              isPrivate
                ? "border-yellow-400 bg-yellow-400 text-black"
                : "border-zinc-700 bg-zinc-800 text-zinc-300"
            }`}
          >
            <Lock className="h-3.5 w-3.5" />
            {isDe ? "Privat" : "Private"}
          </button>
        </div>
      </div>

      {/* Create Button */}
      <button
        onClick={handleCreate}
        disabled={creating || !selectedBox}
        className="flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-6 py-3 font-bold text-black transition-all hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {creating ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <Swords className="h-5 w-5" />
            {isDe ? "Battle erstellen" : "Create Battle"}
          </>
        )}
      </button>
    </div>
  );
}
