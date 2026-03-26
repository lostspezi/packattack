"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Package, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { PackOpening } from "@/components/packs/pack-opening";
import { TopHits } from "@/components/packs/top-hits";
import { LiveEvents } from "@/components/packs/live-events";
import { MyPulls } from "@/components/packs/my-pulls";
import { CardPool } from "@/components/packs/card-pool";

interface CardInfo {
  cardId: string;
  name: string;
  image: string | null;
  rarity: string;
  setName: string;
  coinValue: number;
  marketPrice: number | null;
  chance: number;
  stock: number;
}

interface BoxDetail {
  _id: string;
  slug: string;
  name: { de: string; en: string };
  description: { de: string; en: string } | null;
  game: string;
  image: string | null;
  priceInCoins: number;
  cardsPerPack: number;
  totalCards: number;
  availableCards: number;
  packsOpened: number;
  rarityInfo: Array<{ rarity: string; percentage: number }>;
  coinConversionRate: number;
  cardPool: CardInfo[];
  topHits: CardInfo[];
  recentPulls: Array<{
    _id: string;
    card: { name?: string; image?: string | null } | null;
    rarity: string;
    coinValue: number;
    conversionValue: number;
    status: string;
    createdAt: string;
  }>;
  myPullCounts: Record<string, number>;
  liveEvents: Array<{
    user: { name?: string; username?: string; image?: string | null } | null;
    card: { name?: string; image?: string | null } | null;
    rarity: string;
    coinValue: number;
    status: string;
    createdAt: string;
  }>;
}

interface OpenResult {
  packGroupId: string;
  packCount: number;
  totalCost: number;
  newBalance: number;
  cards: Array<{
    cardId: string;
    name: string;
    rarity: string;
    coinValue: number;
    conversionValue: number;
    image: string | null;
    packIndex: number;
    cardIndex: number;
  }>;
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
  const [showBoxInfo, setShowBoxInfo] = useState(false);

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

  if (openResult) {
    return (
      <PackOpening
        result={openResult}
        box={box}
        lang={lang}
        onDone={() => {
          setOpenResult(null);
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

  // Map live events to the format LiveEvents expects
  const initialEvents = box.liveEvents.map((e) => ({
    userName: (e.user as { name?: string })?.name ?? (e.user as { username?: string })?.username ?? "User",
    userImage: (e.user as { image?: string | null })?.image ?? null,
    cardName: (e.card as { name?: string })?.name ?? "Unknown",
    cardImage: (e.card as { image?: string | null })?.image ?? null,
    rarity: e.rarity,
    coinValue: e.coinValue,
    decision: e.status,
    timestamp: new Date(e.createdAt).getTime(),
  }));

  return (
    <div className="space-y-4">
      {/* Back */}
      <button
        type="button"
        onClick={() => router.push(`/${lang}/packs`)}
        className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {isDe ? "Zurück zu Packs" : "Back to Packs"}
      </button>

      {/* ═══ HERO: PACK OPENING ═══ */}
      <div className="bg-surface border border-border rounded-[16px] p-5 md:p-7 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-radial from-pa-green/5 to-transparent pointer-events-none" />

        <div className="flex flex-col lg:flex-row gap-5 relative">
          {/* Mobile: Card + Title row / Desktop: Card standalone */}
          {(() => {
            const bestHit = box.topHits[0];
            const hitImage = bestHit?.image;
            const cardElement = (
              <div className="relative w-20 sm:w-28 lg:w-40 shrink-0">
                <div className="animate-[goldPulse_2s_ease-in-out_infinite] rounded-xl">
                  {hitImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={hitImage}
                      alt={bestHit?.name ?? name}
                      className="w-full rounded-xl border-2 border-yellow-500/30 shadow-[0_0_20px_rgba(234,179,8,0.15)]"
                    />
                  ) : box.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={box.image} alt={name} className="w-full rounded-xl" />
                  ) : (
                    <div className="w-full aspect-[63/88] bg-white/4 rounded-xl flex items-center justify-center">
                      <Package className="w-8 h-8 text-text-muted" />
                    </div>
                  )}
                </div>
                {bestHit && (
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 z-20 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-md text-center whitespace-nowrap">
                    <p className="text-[8px] sm:text-[9px] text-yellow-400 font-bold">{isDe ? "Seltenste Karte" : "Rarest Card"}</p>
                  </div>
                )}
              </div>
            );

            return (
              <>
                {/* Mobile: card + name side by side */}
                <div className="flex gap-4 items-start lg:hidden">
                  {cardElement}
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-lg font-extrabold text-text-primary">{name}</h1>
                      <span className="bg-pa-green/8 border border-pa-green/15 text-pa-green text-[10px] px-2 py-0.5 rounded-md">
                        🔥 {box.packsOpened.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">{box.game}</p>
                    <div className="flex gap-3 mt-2 text-[11px] text-text-muted flex-wrap">
                      <span>{box.cardsPerPack} {isDe ? "Karten/Pack" : "cards/pack"}</span>
                      <span>{box.availableCards} {isDe ? "verfügbar" : "available"}</span>
                    </div>
                  </div>
                </div>
                {/* Desktop: card standalone */}
                <div className="hidden lg:block">{cardElement}</div>
              </>
            );
          })()}

          {/* Middle: CTA */}
          <div className="flex-1 min-w-0">
            {/* Desktop only title (mobile title is in the card row above) */}
            <div className="hidden lg:flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-extrabold text-text-primary">{name}</h1>
              <span className="bg-pa-green/8 border border-pa-green/15 text-pa-green text-xs px-2.5 py-1 rounded-lg">
                🔥 {box.packsOpened.toLocaleString()} {isDe ? "geöffnet" : "opened"}
              </span>
            </div>
            <p className="hidden lg:block text-xs text-text-muted mt-0.5">{box.game}</p>

            {/* Pack selector */}
            <div className="lg:mt-5">
              <p className="text-xs text-text-muted mb-2">{isDe ? "Wie viele Packs?" : "How many packs?"}</p>
              <div className="flex gap-2 flex-wrap">
                {[1, 2, 3, 5, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPackCount(n)}
                    className={`px-5 py-2.5 text-sm font-bold rounded-xl border transition-all ${
                      packCount === n
                        ? "bg-pa-green/15 text-pa-green border-pa-green/40"
                        : "bg-white/4 text-text-muted border-border hover:bg-white/6"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* CTA + Balance */}
            <div className="flex items-center gap-4 mt-4 flex-wrap">
              <Button
                variant="primary"
                size="lg"
                loading={opening}
                disabled={!canAfford || box.availableCards === 0}
                onClick={() => void handleOpen()}
                className="shadow-[0_0_24px_theme(colors.pa-green/0.2)]"
              >
                🎴 {isDe ? "Pack öffnen" : "Open Pack"} — {totalCost} Coins
              </Button>
              <div className="text-center">
                <p className="text-[10px] text-text-muted">{isDe ? "Guthaben" : "Balance"}</p>
                <p className={`text-xl font-extrabold tabular-nums ${canAfford ? "text-pa-green" : "text-red-400"}`}>
                  {(userCoins ?? 0).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="hidden lg:flex gap-4 mt-3 text-xs text-text-muted flex-wrap">
              <span>{box.cardsPerPack} {isDe ? "Karten/Pack" : "cards/pack"}</span>
              <span>·</span>
              <span>{box.availableCards} {isDe ? "verfügbar" : "available"}</span>
              <span>·</span>
              <span>{box.coinConversionRate}% {isDe ? "Umwandlung" : "conversion"}</span>
            </div>
          </div>

          {/* Right: Description + Rarities side by side */}
          <div className="lg:w-[480px] shrink-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Description */}
            <div className="bg-white/4 rounded-xl p-3.5">
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">
                {isDe ? "Beschreibung" : "Description"}
              </p>
              <div className="text-xs text-text-secondary leading-relaxed max-h-24 overflow-hidden">
                {desc || (isDe ? "Keine Beschreibung" : "No description")}
              </div>
              {desc && desc.length > 80 && (
                <button
                  type="button"
                  onClick={() => setShowBoxInfo(true)}
                  className="text-[10px] text-pa-green mt-1.5 flex items-center gap-0.5 hover:underline"
                >
                  {isDe ? "Mehr anzeigen" : "Show more"}
                  <ChevronDown className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Rarity distribution */}
            <div className="bg-white/4 rounded-xl p-3.5">
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">
                {isDe ? "Raritäten" : "Rarities"}
              </p>
              <div className="space-y-2">
                {box.rarityInfo.map((r) => (
                  <div key={r.rarity} className="flex items-center gap-2">
                    <Badge variant="info" className="text-[9px] min-w-[50px] justify-center">{r.rarity}</Badge>
                    <div className="flex-1 h-1.5 bg-white/6 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max(2, r.percentage)}%`,
                          backgroundColor: r.percentage < 1 ? "#EF4444" : r.percentage < 10 ? "#F59E0B" : "#60A5FA",
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-text-muted tabular-nums w-12 text-right">{r.percentage < 0.01 ? r.percentage.toFixed(3) : r.percentage < 1 ? r.percentage.toFixed(2) : r.percentage.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ THREE COLUMNS ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TopHits cards={box.topHits} lang={lang} pullCounts={box.myPullCounts} />
        <LiveEvents boxId={box._id} initialEvents={initialEvents} cardPool={box.cardPool} lang={lang} />
        <MyPulls pulls={box.recentPulls} lang={lang} />
      </div>

      {/* ═══ CARD POOL ═══ */}
      <CardPool cards={box.cardPool} lang={lang} pullCounts={box.myPullCounts} />

      {/* ═══ BOX INFO MODAL ═══ */}
      <Modal open={showBoxInfo} onClose={() => setShowBoxInfo(false)} title={name} size="xl">
        <div className="space-y-6">
          {/* Description full */}
          {desc && (
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider mb-2">
                {isDe ? "Beschreibung" : "Description"}
              </p>
              <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                {desc}
              </div>
            </div>
          )}

          {/* Top 3 Hits */}
          {box.topHits.length > 0 && (
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider mb-3">🏆 Top Hits</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {box.topHits.map((card, i) => (
                  <div
                    key={card.cardId}
                    className={`rounded-xl p-4 text-center ${
                      i === 0
                        ? "bg-pa-green/5 border border-pa-green/20"
                        : "bg-white/4 border border-border"
                    }`}
                  >
                    {card.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={card.image} alt="" className="w-20 mx-auto rounded-lg mb-2" loading="lazy" />
                    ) : (
                      <div className="w-20 aspect-[63/88] bg-white/4 rounded-lg mx-auto mb-2" />
                    )}
                    <p className="text-sm font-bold text-text-primary">{card.name}</p>
                    <Badge variant="info" className="mt-1">{card.rarity}</Badge>
                    <p className={`text-lg font-extrabold mt-2 ${i === 0 ? "text-pa-green" : "text-text-primary"}`}>
                      {card.coinValue.toLocaleString()} Coins
                    </p>
                    <p className="text-xs text-yellow-400">
                      ⚡ {card.chance < 0.01 ? card.chance.toFixed(3) : card.chance < 1 ? card.chance.toFixed(2) : card.chance.toFixed(1)}% Chance
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rarity breakdown */}
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wider mb-2">
              {isDe ? "Raritäten-Verteilung" : "Rarity Distribution"}
            </p>
            <div className="space-y-2">
              {box.rarityInfo.map((r) => (
                <div key={r.rarity} className="flex items-center gap-3">
                  <Badge variant="info" className="min-w-[80px] justify-center">{r.rarity}</Badge>
                  <div className="flex-1 h-2 bg-white/6 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(2, r.percentage)}%`,
                        backgroundColor: r.percentage < 1 ? "#EF4444" : r.percentage < 10 ? "#F59E0B" : "#60A5FA",
                      }}
                    />
                  </div>
                  <span className="text-sm text-text-secondary tabular-nums w-14 text-right">{r.percentage < 0.01 ? r.percentage.toFixed(3) : r.percentage < 1 ? r.percentage.toFixed(2) : r.percentage.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <Button
            variant="primary"
            size="lg"
            className="w-full shadow-[0_0_24px_theme(colors.pa-green/0.2)]"
            disabled={!canAfford || box.availableCards === 0}
            onClick={() => { setShowBoxInfo(false); void handleOpen(); }}
          >
            🎴 {isDe ? "Pack öffnen" : "Open Pack"} — {totalCost} Coins
          </Button>
        </div>
      </Modal>
    </div>
  );
}
