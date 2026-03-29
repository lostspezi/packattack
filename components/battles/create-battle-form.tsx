"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Coins, Users, Package, Eye, EyeOff, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface Box {
  _id: string;
  name: { de?: string; en?: string; [key: string]: string | undefined };
  image?: string;
  priceInCoins: number;
  cardsPerPack?: number;
}

interface CreateBattleFormProps {
  lang: string;
  dict: Record<string, string>;
}

export function CreateBattleForm({ lang, dict }: CreateBattleFormProps) {
  const router = useRouter();

  const [boxes, setBoxes] = useState<Box[]>([]);
  const [loadingBoxes, setLoadingBoxes] = useState(true);

  const [selectedBoxId, setSelectedBoxId] = useState<string>("");
  const [packsPerPlayer, setPacksPerPlayer] = useState(1);
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [enableMinElo, setEnableMinElo] = useState(false);
  const [minElo, setMinElo] = useState<number>(0);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    fetch("/api/boxes?status=published")
      .then((res) => res.json())
      .then((data) => {
        const list: Box[] = data.boxes ?? [];
        setBoxes(list);
        if (list.length > 0) setSelectedBoxId(list[0]._id);
      })
      .catch(() => setBoxes([]))
      .finally(() => setLoadingBoxes(false));
  }, []);

  const selectedBox = boxes.find((b) => b._id === selectedBoxId) ?? null;
  const costPreview = selectedBox ? selectedBox.priceInCoins * packsPerPlayer : 0;

  function getBoxName(box: Box): string {
    return (
      box.name[lang] ??
      box.name["en"] ??
      box.name["de"] ??
      Object.values(box.name).find(Boolean) ??
      "—"
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBoxId) {
      setError(dict.error_select_box || "Bitte wähle eine Box aus.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/battles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boxId: selectedBoxId,
          packsPerPlayer,
          maxPlayers,
          visibility,
          minElo: enableMinElo ? minElo : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || dict.error_generic || "Fehler beim Erstellen des Battles.");
        return;
      }

      router.push(`/${lang}/battles/${data.battle.slug}`);
    } catch {
      setError(dict.error_generic || "Fehler beim Erstellen des Battles.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingBoxes) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-text-secondary" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {/* Box Selector */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-text-secondary">
          {dict.select_box || "Box auswählen"}
        </p>
        {boxes.length === 0 ? (
          <Card variant="soft" className="p-6 text-center">
            <Package className="h-10 w-10 mx-auto text-text-secondary opacity-40 mb-2" />
            <p className="text-sm text-text-secondary">
              {dict.no_boxes || "Keine Boxen verfügbar."}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {boxes.map((box) => {
              const isSelected = box._id === selectedBoxId;
              return (
                <button
                  key={box._id}
                  type="button"
                  onClick={() => setSelectedBoxId(box._id)}
                  className={[
                    "flex flex-col gap-2 rounded-[14px] border p-3 text-left transition-colors",
                    isSelected
                      ? "border-pa-green bg-pa-green/8"
                      : "border-white/8 bg-white/3 hover:bg-white/5",
                  ].join(" ")}
                >
                  {box.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={box.image}
                      alt={getBoxName(box)}
                      className="h-20 w-full rounded-[8px] object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-full items-center justify-center rounded-[8px] bg-white/5">
                      <Package className="h-8 w-8 text-text-secondary opacity-40" />
                    </div>
                  )}
                  <p className="truncate text-sm font-semibold text-text-primary">
                    {getBoxName(box)}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-pa-green">
                    <Coins className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="font-medium">{box.priceInCoins}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Packs per Player & Max Players */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          type="number"
          label={dict.packs_per_player || "Packs pro Spieler"}
          min={1}
          max={10}
          value={packsPerPlayer}
          onChange={(e) =>
            setPacksPerPlayer(Math.min(10, Math.max(1, Number(e.target.value))))
          }
        />
        <Input
          type="number"
          label={dict.max_players || "Max. Spieler"}
          min={2}
          max={20}
          value={maxPlayers}
          onChange={(e) =>
            setMaxPlayers(Math.min(20, Math.max(2, Number(e.target.value))))
          }
        />
      </div>

      {/* Visibility Toggle */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-text-secondary">
          {dict.visibility || "Sichtbarkeit"}
        </p>
        <div className="flex rounded-[10px] border border-white/8 overflow-hidden w-fit">
          <button
            type="button"
            onClick={() => setVisibility("public")}
            className={[
              "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors",
              visibility === "public"
                ? "bg-pa-green text-bg"
                : "bg-transparent text-text-secondary hover:text-text-primary",
            ].join(" ")}
          >
            <Eye className="h-4 w-4" />
            {dict.public || "Öffentlich"}
          </button>
          <button
            type="button"
            onClick={() => setVisibility("private")}
            className={[
              "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors",
              visibility === "private"
                ? "bg-pa-green text-bg"
                : "bg-transparent text-text-secondary hover:text-text-primary",
            ].join(" ")}
          >
            <EyeOff className="h-4 w-4" />
            {dict.private || "Privat"}
          </button>
        </div>
      </div>

      {/* Min ELO (optional) */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setEnableMinElo((v) => !v)}
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronDown
            className={[
              "h-4 w-4 transition-transform",
              enableMinElo ? "rotate-180" : "",
            ].join(" ")}
          />
          {dict.min_elo_toggle || "Min. ELO festlegen (optional)"}
        </button>
        {enableMinElo && (
          <Input
            type="number"
            label={dict.min_elo || "Min. ELO"}
            min={0}
            value={minElo}
            onChange={(e) => setMinElo(Math.max(0, Number(e.target.value)))}
            className="max-w-xs"
          />
        )}
      </div>

      {/* Cost Preview */}
      {selectedBox && (
        <Card variant="accent" className="flex items-center gap-3 p-4">
          <Coins className="h-5 w-5 flex-shrink-0 text-pa-green" />
          <div>
            <p className="text-sm text-text-secondary">
              {dict.cost_preview_label || "Kosten pro Spieler"}
            </p>
            <p className="text-lg font-bold text-pa-green">
              {costPreview} {dict.coins || "Coins"}
            </p>
          </div>
          <p className="ml-auto text-xs text-text-secondary">
            {selectedBox.priceInCoins} × {packsPerPlayer} {dict.packs || "Packs"}
          </p>
        </Card>
      )}

      {/* Error */}
      {error && (
        <p className="rounded-[10px] border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}

      {/* Submit */}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={submitting}
        disabled={!selectedBoxId || submitting}
      >
        {dict.create_battle || "Battle erstellen"}
      </Button>
    </form>
  );
}
