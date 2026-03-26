"use client";

import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { SelectOption } from "@/components/ui/select";
import { RarityWeightEditor } from "@/components/admin/rarity-weight-editor";
import type { RarityWeight } from "@/components/admin/rarity-weight-editor";
import type { JustTCGGame } from "@/lib/justtcg";

export interface BoxFormData {
  name: { de: string; en: string };
  description: { de: string; en: string };
  game: string;
  priceInCoins: number;
  cardsPerPack: number;
  totalPacks: number | null;
  rarityWeights: RarityWeight[];
}

interface BoxFormProps {
  lang: string;
  dict: Record<string, string>;
  initialData?: Partial<BoxFormData>;
  onSave: (data: BoxFormData) => void;
  loading: boolean;
}

export function BoxForm({ lang, dict, initialData, onSave, loading }: BoxFormProps) {
  void dict;
  const isDe = lang === "de";

  const [nameDe, setNameDe] = useState(initialData?.name?.de ?? "");
  const [nameEn, setNameEn] = useState(initialData?.name?.en ?? "");
  const [descDe, setDescDe] = useState(initialData?.description?.de ?? "");
  const [descEn, setDescEn] = useState(initialData?.description?.en ?? "");
  const [game, setGame] = useState(initialData?.game ?? "");
  const [priceInCoins, setPriceInCoins] = useState<string>(
    initialData?.priceInCoins !== undefined ? String(initialData.priceInCoins) : ""
  );
  const [cardsPerPack, setCardsPerPack] = useState<string>(
    initialData?.cardsPerPack !== undefined ? String(initialData.cardsPerPack) : ""
  );
  const [totalPacksStr, setTotalPacksStr] = useState<string>(
    initialData?.totalPacks !== null && initialData?.totalPacks !== undefined
      ? String(initialData.totalPacks)
      : ""
  );
  const [rarityWeights, setRarityWeights] = useState<RarityWeight[]>(
    initialData?.rarityWeights ?? []
  );

  const [games, setGames] = useState<JustTCGGame[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/justtcg/games")
      .then((r) => r.json())
      .then((data: { games?: JustTCGGame[] }) => {
        if (Array.isArray(data.games)) setGames(data.games);
      })
      .catch(() => {/* silently ignore */})
      .finally(() => setGamesLoading(false));
  }, []);

  const gameOptions: SelectOption[] = [
    { label: isDe ? "Spiel auswählen…" : "Select game…", value: "" },
    ...games.map((g): SelectOption => ({ label: g.name, value: g.id })),
  ];

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!nameDe.trim()) errs.nameDe = isDe ? "Pflichtfeld" : "Required";
    if (!nameEn.trim()) errs.nameEn = isDe ? "Pflichtfeld" : "Required";
    if (!game) errs.game = isDe ? "Pflichtfeld" : "Required";
    const price = parseInt(priceInCoins, 10);
    if (isNaN(price) || price < 0) errs.priceInCoins = isDe ? "Ungültige Zahl" : "Invalid number";
    const cpp = parseInt(cardsPerPack, 10);
    if (isNaN(cpp) || cpp < 1) errs.cardsPerPack = isDe ? "Muss mind. 1 sein" : "Must be at least 1";
    if (rarityWeights.length === 0) errs.rarityWeights = isDe ? "Mind. eine Rarität nötig" : "At least one rarity required";
    const weightSum = rarityWeights.reduce((acc, w) => acc + w.weight, 0);
    if (rarityWeights.length > 0 && weightSum !== 100) errs.rarityWeights = isDe ? "Gewichte müssen 100 ergeben" : "Weights must sum to 100";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const totalPacksParsed = totalPacksStr.trim() ? parseInt(totalPacksStr, 10) : null;
    onSave({
      name: { de: nameDe.trim(), en: nameEn.trim() },
      description: { de: descDe.trim(), en: descEn.trim() },
      game,
      priceInCoins: parseInt(priceInCoins, 10),
      cardsPerPack: parseInt(cardsPerPack, 10),
      totalPacks: totalPacksParsed !== null && !isNaN(totalPacksParsed) ? totalPacksParsed : null,
      rarityWeights,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Names */}
      <div className="bg-surface border border-border rounded-[14px] p-6 space-y-5">
        <h3 className="text-base font-semibold text-text-primary">
          {isDe ? "Grundinformationen" : "Basic Information"}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">
              {isDe ? "Name (Deutsch)" : "Name (German)"}
            </label>
            <Input
              value={nameDe}
              onChange={(e) => setNameDe(e.target.value)}
              placeholder="z.B. Pokémon Booster Box"
              className="py-2 text-sm"
            />
            {errors.nameDe && <p className="text-xs text-red-400">{errors.nameDe}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">
              {isDe ? "Name (Englisch)" : "Name (English)"}
            </label>
            <Input
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder="e.g. Pokémon Booster Box"
              className="py-2 text-sm"
            />
            {errors.nameEn && <p className="text-xs text-red-400">{errors.nameEn}</p>}
          </div>
        </div>

        {/* Descriptions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">
              {isDe ? "Beschreibung (Deutsch)" : "Description (German)"}
            </label>
            <textarea
              value={descDe}
              onChange={(e) => setDescDe(e.target.value)}
              rows={3}
              placeholder="Deutschsprachige Beschreibung…"
              className="w-full bg-white/4 border border-white/8 text-text-primary text-sm rounded-[10px] px-3 py-2 outline-none focus:border-pa-green/35 resize-y"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">
              {isDe ? "Beschreibung (Englisch)" : "Description (English)"}
            </label>
            <textarea
              value={descEn}
              onChange={(e) => setDescEn(e.target.value)}
              rows={3}
              placeholder="English description…"
              className="w-full bg-white/4 border border-white/8 text-text-primary text-sm rounded-[10px] px-3 py-2 outline-none focus:border-pa-green/35 resize-y"
            />
          </div>
        </div>

        {/* Game */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-text-secondary">
            {isDe ? "Spiel" : "Game"}
          </label>
          <Select
            options={gameOptions}
            value={game}
            onChange={setGame}
            size="md"
            disabled={gamesLoading}
            className="w-full max-w-xs"
          />
          {errors.game && <p className="text-xs text-red-400">{errors.game}</p>}
        </div>
      </div>

      {/* Pricing & Pack config */}
      <div className="bg-surface border border-border rounded-[14px] p-6 space-y-5">
        <h3 className="text-base font-semibold text-text-primary">
          {isDe ? "Preis & Pack-Konfiguration" : "Pricing & Pack Configuration"}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">
              {isDe ? "Preis (Coins)" : "Price (Coins)"}
            </label>
            <Input
              type="number"
              min={0}
              value={priceInCoins}
              onChange={(e) => setPriceInCoins(e.target.value)}
              placeholder="e.g. 500"
              className="py-2 text-sm"
            />
            {errors.priceInCoins && <p className="text-xs text-red-400">{errors.priceInCoins}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">
              {isDe ? "Karten pro Pack" : "Cards per Pack"}
            </label>
            <Input
              type="number"
              min={1}
              value={cardsPerPack}
              onChange={(e) => setCardsPerPack(e.target.value)}
              placeholder="e.g. 5"
              className="py-2 text-sm"
            />
            {errors.cardsPerPack && <p className="text-xs text-red-400">{errors.cardsPerPack}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">
              {isDe ? "Gesamte Packs" : "Total Packs"}
            </label>
            <Input
              type="number"
              min={1}
              value={totalPacksStr}
              onChange={(e) => setTotalPacksStr(e.target.value)}
              placeholder={isDe ? "Unbegrenzt" : "Unlimited"}
              className="py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Rarity weights */}
      <div className="bg-surface border border-border rounded-[14px] p-6">
        <RarityWeightEditor weights={rarityWeights} onChange={setRarityWeights} game={game} />
        {errors.rarityWeights && (
          <p className="text-xs text-red-400 mt-2">{errors.rarityWeights}</p>
        )}
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="md" loading={loading}>
          {isDe ? "Speichern" : "Save Box"}
        </Button>
      </div>
    </form>
  );
}
