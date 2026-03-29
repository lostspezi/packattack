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
  void loading;
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

  // Sync priceInCoins when parent updates it (e.g. auto-calculate)
  /* eslint-disable react-hooks/set-state-in-effect -- syncing derived state from prop */
  useEffect(() => {
    if (initialData?.priceInCoins !== undefined) {
      setPriceInCoins(String(initialData.priceInCoins));
    }
  }, [initialData?.priceInCoins]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
    <form id="box-form" onSubmit={handleSubmit} className="space-y-4">
      {/* Names & Descriptions */}
      <div className="bg-surface border border-border rounded-[14px] p-4 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">
          {isDe ? "Grundinformationen" : "Basic Information"}
        </h3>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-text-muted">
            {isDe ? "Name (DE)" : "Name (DE)"}
          </label>
          <Input value={nameDe} onChange={(e) => setNameDe(e.target.value)} placeholder="z.B. Pokémon Booster Box" className="py-1.5 text-sm" />
          {errors.nameDe && <p className="text-[11px] text-red-400">{errors.nameDe}</p>}
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-text-muted">
            {isDe ? "Name (EN)" : "Name (EN)"}
          </label>
          <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="e.g. Pokémon Booster Box" className="py-1.5 text-sm" />
          {errors.nameEn && <p className="text-[11px] text-red-400">{errors.nameEn}</p>}
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-text-muted">
            {isDe ? "Beschreibung (DE)" : "Description (DE)"}
          </label>
          <textarea
            value={descDe}
            onChange={(e) => setDescDe(e.target.value)}
            rows={2}
            placeholder={isDe ? "Optional…" : "Optional…"}
            className="w-full bg-white/4 border border-white/8 text-text-primary text-sm rounded-[10px] px-3 py-1.5 outline-none focus:border-pa-green/35 resize-y"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-text-muted">
            {isDe ? "Beschreibung (EN)" : "Description (EN)"}
          </label>
          <textarea
            value={descEn}
            onChange={(e) => setDescEn(e.target.value)}
            rows={2}
            placeholder="Optional…"
            className="w-full bg-white/4 border border-white/8 text-text-primary text-sm rounded-[10px] px-3 py-1.5 outline-none focus:border-pa-green/35 resize-y"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-text-muted">
            {isDe ? "Spiel" : "Game"}
          </label>
          <Select options={gameOptions} value={game} onChange={setGame} size="sm" disabled={gamesLoading} />
          {errors.game && <p className="text-[11px] text-red-400">{errors.game}</p>}
        </div>
      </div>

      {/* Pricing & Pack config — compact 2-col grid */}
      <div className="bg-surface border border-border rounded-[14px] p-4 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">
          {isDe ? "Preis & Packs" : "Pricing & Packs"}
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-text-muted">
              {isDe ? "Preis (Coins)" : "Price (Coins)"}
            </label>
            <Input type="number" min={0} value={priceInCoins} onChange={(e) => setPriceInCoins(e.target.value)} placeholder="500" className="py-1.5 text-sm" />
            {errors.priceInCoins && <p className="text-[11px] text-red-400">{errors.priceInCoins}</p>}
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-text-muted">
              {isDe ? "Karten/Pack" : "Cards/Pack"}
            </label>
            <Input type="number" min={1} value={cardsPerPack} onChange={(e) => setCardsPerPack(e.target.value)} placeholder="5" className="py-1.5 text-sm" />
            {errors.cardsPerPack && <p className="text-[11px] text-red-400">{errors.cardsPerPack}</p>}
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-text-muted">
              {isDe ? "Gesamte Packs" : "Total Packs"}
            </label>
            <Input type="number" min={1} value={totalPacksStr} onChange={(e) => setTotalPacksStr(e.target.value)} placeholder={isDe ? "Unbegrenzt" : "Unlimited"} className="py-1.5 text-sm" />
          </div>

        </div>
      </div>

      {/* Rarity weights */}
      <div className="bg-surface border border-border rounded-[14px] p-4">
        <RarityWeightEditor weights={rarityWeights} onChange={setRarityWeights} game={game} lang={lang} />
        {errors.rarityWeights && (
          <p className="text-[11px] text-red-400 mt-2">{errors.rarityWeights}</p>
        )}
      </div>

    </form>
  );
}

export function BoxFormSaveButton({ loading, lang }: { loading: boolean; lang: string }) {
  const isDe = lang === "de";
  return (
    <Button type="submit" form="box-form" variant="primary" size="md" loading={loading} className="w-full">
      {isDe ? "Speichern" : "Save Box"}
    </Button>
  );
}
