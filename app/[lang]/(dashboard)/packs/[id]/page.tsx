"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { PackOpening } from "@/components/packs/pack-opening";

interface BoxDetail {
  _id: string;
  name: { de: string; en: string };
  description: { de: string; en: string } | null;
  game: string;
  image: string | null;
  priceInCoins: number;
  cardsPerPack: number;
  totalCards: number;
  availableCards: number;
  packsOpened: number;
  rarities: string[];
  rarityInfo: Array<{ rarity: string; percentage: number }>;
  coinConversionRate: number;
  claimDeadlineHours: number;
}

interface DrawnCard {
  cardId: string;
  name: string;
  rarity: string;
  coinValue: number;
  conversionValue: number;
  image: string | null;
  packIndex: number;
  cardIndex: number;
}

interface OpenResult {
  packGroupId: string;
  packCount: number;
  totalCost: number;
  newBalance: number;
  cards: DrawnCard[];
}

export default function PackDetailPage() {
  const params = useParams<{ lang: string; id: string }>();
  const lang = params.lang ?? "en";
  const id = params.id;
  const isDe = lang === "de";
  const router = useRouter();
  const { toast } = useToast();

  const [box, setBox] = useState<BoxDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [packCount, setPackCount] = useState(1);
  const [opening, setOpening] = useState(false);
  const [openResult, setOpenResult] = useState<OpenResult | null>(null);
  const [userCoins, setUserCoins] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/packs/${id}`).then((r) => r.ok ? r.json() : null),
      fetch("/api/profile").then((r) => r.ok ? r.json() : null),
    ]).then(([boxData, profileData]) => {
      setBox(boxData as BoxDetail | null);
      setUserCoins((profileData as { coins?: number })?.coins ?? 0);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  async function handleOpen() {
    if (!box) return;
    setOpening(true);
    try {
      const res = await fetch(`/api/packs/${id}/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packCount }),
      });
      const data = await res.json() as OpenResult & { error?: string };
      if (!res.ok) {
        toast({ type: "error", title: data.error ?? "Failed to open pack" });
        return;
      }
      setOpenResult(data);
      setUserCoins(data.newBalance);
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setOpening(false);
    }
  }

  if (loading) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-pa-green" />
      </div>
    );
  }

  if (!box) {
    return (
      <div className="py-16 text-center">
        <p className="text-text-muted">{isDe ? "Box nicht gefunden." : "Box not found."}</p>
      </div>
    );
  }

  // If we have an open result, show the opening flow
  if (openResult) {
    return (
      <PackOpening
        result={openResult}
        box={box}
        lang={lang}
        onDone={() => {
          setOpenResult(null);
          // Reload box to get updated stock
          fetch(`/api/packs/${id}`).then((r) => r.ok ? r.json() : null).then((d) => { if (d) setBox(d as BoxDetail); }).catch(() => {});
        }}
        onCoinsChange={(coins) => setUserCoins(coins)}
      />
    );
  }

  const name = isDe ? (box.name.de || box.name.en) : (box.name.en || box.name.de);
  const desc = isDe ? (box.description?.de || box.description?.en) : (box.description?.en || box.description?.de);
  const totalCost = box.priceInCoins * packCount;
  const canAfford = (userCoins ?? 0) >= totalCost;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back */}
      <button
        type="button"
        onClick={() => router.push(`/${lang}/packs`)}
        className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {isDe ? "Zurück zu Packs" : "Back to Packs"}
      </button>

      {/* Box header */}
      <div className="flex flex-col sm:flex-row gap-5">
        {box.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={box.image} alt={name} className="w-full sm:w-48 h-48 object-cover rounded-xl" />
        ) : (
          <div className="w-full sm:w-48 h-48 bg-white/4 rounded-xl flex items-center justify-center">
            <Package className="w-12 h-12 text-text-muted" />
          </div>
        )}
        <div className="flex-1 space-y-2">
          <h2 className="text-2xl font-bold text-text-primary">{name}</h2>
          <p className="text-xs text-text-muted">{box.game}</p>
          {desc && <p className="text-sm text-text-secondary">{desc}</p>}
          <div className="flex flex-wrap gap-3 text-sm text-text-secondary">
            <span><strong className="text-pa-green">{box.priceInCoins}</strong> Coins/Pack</span>
            <span>{box.cardsPerPack} {isDe ? "Karten/Pack" : "cards/pack"}</span>
            <span>{box.availableCards} {isDe ? "verfügbar" : "available"}</span>
          </div>
          {box.rarityInfo.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {box.rarityInfo.map((r) => (
                <Badge key={r.rarity} variant="info">{r.rarity} ~{r.percentage}%</Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pack opening controls */}
      <div className="bg-surface border border-border rounded-[14px] p-5 space-y-4">
        <h3 className="text-base font-semibold text-text-primary">
          {isDe ? "Packs öffnen" : "Open Packs"}
        </h3>

        {/* Pack count selector */}
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 5, 10].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPackCount(n)}
              className={`px-4 py-2 text-sm font-medium rounded-xl border transition-colors ${
                packCount === n
                  ? "bg-pa-green/10 text-pa-green border-pa-green/20"
                  : "bg-white/4 text-text-secondary border-border hover:bg-white/6"
              }`}
            >
              {n} Pack{n > 1 ? "s" : ""}
            </button>
          ))}
        </div>

        {/* Cost summary */}
        <div className="flex items-center justify-between bg-white/4 border border-border rounded-xl p-4">
          <div>
            <p className="text-xs text-text-muted">{isDe ? "Gesamtkosten" : "Total Cost"}</p>
            <p className="text-xl font-bold text-text-primary">{totalCost.toLocaleString()} Coins</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-text-muted">{isDe ? "Dein Guthaben" : "Your Balance"}</p>
            <p className={`text-xl font-bold ${canAfford ? "text-pa-green" : "text-red-400"}`}>
              {(userCoins ?? 0).toLocaleString()} Coins
            </p>
          </div>
        </div>

        {/* Open button */}
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          loading={opening}
          disabled={!canAfford || box.availableCards === 0}
          onClick={() => void handleOpen()}
        >
          {!canAfford
            ? (isDe ? "Nicht genug Coins" : "Not enough coins")
            : box.availableCards === 0
            ? (isDe ? "Keine Karten verfügbar" : "No cards available")
            : (isDe ? `${packCount} Pack${packCount > 1 ? "s" : ""} öffnen` : `Open ${packCount} Pack${packCount > 1 ? "s" : ""}`)}
        </Button>

        {/* Info */}
        <p className="text-[11px] text-text-muted text-center">
          {isDe
            ? `Umwandlungsrate: ${box.coinConversionRate}%`
            : `Conversion rate: ${box.coinConversionRate}%`}
        </p>
      </div>
    </div>
  );
}
