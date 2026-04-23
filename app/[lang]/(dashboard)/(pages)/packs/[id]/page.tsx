"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Package, ChevronDown, AlertTriangle, Coins, Layers } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { fetchProfile } from "@/lib/profile-client";
import { useMe } from "@/components/layout/me-provider";
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
  conditions: string[];
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
  packsOpenedBucket: string | null;
  rarityInfo: Array<{ rarity: string; percentage: number }>;
  conditionInfo: Array<{ condition: string; percentage: number }>;
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
  isRecovery?: boolean;
  cards: Array<{
    cardId: string;
    name: string;
    rarity: string;
    coinValue: number;
    conversionValue: number;
    image: string | null;
    packIndex: number;
    cardIndex: number;
    status?: string;
  }>;
}

export default function PackDetailPage() {
  const params = useParams<{ lang: string; id: string }>();
  const lang = params.lang ?? "en";
  const id = params.id;
  const isDe = lang === "de";
  const router = useRouter();
  const { toast } = useToast();
  const me = useMe();

  const [box, setBox] = useState<BoxDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [packCount, setPackCount] = useState(1);
  const [opening, setOpening] = useState(false);
  // Synchronous guard — React state is set asynchronously, so two fast clicks
  // can both enter handleOpen before `opening` flips to true.
  const openingRef = useRef(false);
  const [openResult, setOpenResult] = useState<OpenResult | null>(null);
  const [userCoins, setUserCoins] = useState<number | null>(null);
  const [showBoxInfo, setShowBoxInfo] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState<"normal" | "quick" | null>(null);
  const quickOpenRef = useRef(false);

  const [pendingOtherBox, setPendingOtherBox] = useState<{
    boxName: string;
    boxSlug: string;
    pendingCount: number;
  } | null>(null);

  // Load box + coins. /api/profile stays in place because fetchProfile
  // shares an in-flight promise with the header; /api/pulls/pending only
  // fires when the /api/me snapshot says something is pending, avoiding
  // the redundant fetch on every mount.
  useEffect(() => {
    Promise.all([
      fetch(`/api/packs/${id}`).then((r) => r.ok ? r.json() : null),
      fetchProfile(),
    ]).then(([boxData, profileData]) => {
      const typedBox = boxData as BoxDetail | null;
      const typedProfile = profileData as { coins?: number } | null;
      setBox(typedBox);
      setUserCoins(typedProfile?.coins ?? 0);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  // Cross-box pending banner — only fetch the detailed pending payload
  // when the shared /api/me snapshot says there is one. Skipping this
  // spares the /api/pulls/pending roundtrip on every pack-page mount for
  // the common case (nothing pending).
  useEffect(() => {
    if (!me?.pending.exists || !box) return;

    let cancelled = false;
    fetch("/api/pulls/pending")
      .then((r) => (r.ok ? r.json() : null))
      .then((pendingData) => {
        if (cancelled || !pendingData?.pending || !pendingData.cards) return;
        const isSameBox =
          pendingData.boxSlug === id ||
          pendingData.boxId === id ||
          pendingData.boxId === box._id;
        if (isSameBox) return; // Guard overlay handles same-box recovery
        const name = isDe
          ? (pendingData.boxName?.de || pendingData.boxName?.en || "Box")
          : (pendingData.boxName?.en || pendingData.boxName?.de || "Box");
        setPendingOtherBox({
          boxName: name,
          boxSlug: pendingData.boxSlug ?? pendingData.boxId,
          pendingCount: pendingData.pendingCount ?? 0,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [me?.pending.exists, box, id, isDe]);

  async function handleOpen() {
    if (!box) return;
    if (openingRef.current) return;
    openingRef.current = true;
    setOpening(true);
    try {
      const res = await fetch(`/api/packs/${id}/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packCount }),
      });
      const data = await res.json() as OpenResult & { error?: string; message?: string };
      if (!res.ok) {
        toast({ type: "error", title: data.message ?? data.error ?? "Failed to open pack" });
        return;
      }
      setOpenResult(data);
      setUserCoins(data.newBalance);
      window.dispatchEvent(new CustomEvent("coin-balance-change", { detail: { delta: -(box.priceInCoins * packCount) } }));
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setOpening(false);
      openingRef.current = false;
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
        quickOpen={quickOpenRef.current}
        onDone={() => {
          // Adjust the box state in place instead of refetching the full
          // box detail — newBalance and the drawn-card count are already
          // known from the open response, and the card pool chances don't
          // meaningfully shift between two consecutive opens.
          const drawn = openResult?.cards.length ?? 0;
          setOpenResult(null);
          setBox((prev) =>
            prev
              ? { ...prev, availableCards: Math.max(0, prev.availableCards - drawn) }
              : prev,
          );
        }}
      />
    );
  }

  const name = isDe ? (box.name.de || box.name.en) : (box.name.en || box.name.de);
  const desc = isDe ? (box.description?.de || box.description?.en) : (box.description?.en || box.description?.de);
  const totalCost = box.priceInCoins * packCount;
  const canAfford = (userCoins ?? 0) >= totalCost;

  // Map live events to the format LiveEvents expects
  const initialEvents = box.liveEvents.map((e) => ({
    userName: (e.user as { username?: string })?.username ?? "Anonymous",
    userImage: (e.user as { image?: string | null })?.image ?? null,
    cardName: (e.card as { name?: string })?.name ?? "Unknown",
    cardImage: (e.card as { image?: string | null })?.image ?? null,
    rarity: e.rarity,
    coinValue: e.coinValue,
    decision: e.status,
    timestamp: new Date(e.createdAt).getTime(),
  }));

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        type="button"
        onClick={() => router.push(`/${lang}/packs`)}
        className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {isDe ? "Zurück zu Packs" : "Back to Packs"}
      </button>

      {/* Pending session on another box — warning banner */}
      {pendingOtherBox && (
        <div className="flex items-center gap-3 rounded-xl border border-orange-500/30 bg-orange-500/8 px-4 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-orange-400" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-text-primary">
              {isDe
                ? `Du hast noch ${pendingOtherBox.pendingCount} offene Karten aus „${pendingOtherBox.boxName}".`
                : `You have ${pendingOtherBox.pendingCount} undecided cards from "${pendingOtherBox.boxName}".`}
            </p>
            <p className="text-text-muted">
              {isDe
                ? "Bitte entscheide zuerst über diese Karten, bevor du neue Packs öffnst."
                : "Please decide on those cards before opening new packs."}
            </p>
          </div>
          <Link
            href={`/${lang}/packs/${pendingOtherBox.boxSlug}`}
            className="shrink-0 rounded-lg bg-orange-500/15 px-3 py-1.5 text-xs font-medium text-orange-400 transition-colors hover:bg-orange-500/25"
          >
            {isDe ? "Jetzt entscheiden" : "Decide now"}
          </Link>
        </div>
      )}

      {/* ═══ HERO: PACK OPENING ═══ */}
      <div className="bg-surface border border-border rounded-2xl p-5 md:p-7 relative overflow-hidden">
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
                    <div className="w-full aspect-63/88 bg-white/4 rounded-xl flex items-center justify-center">
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
                      {box.packsOpenedBucket ? (
                        <span className="bg-pa-green/8 border border-pa-green/15 text-pa-green text-[10px] px-2 py-0.5 rounded-md">
                          🔥 {box.packsOpenedBucket}
                        </span>
                      ) : (
                        <span className="bg-white/4 border border-border text-text-muted text-[10px] px-2 py-0.5 rounded-md">
                          ✨ {isDe ? "Neu" : "New"}
                        </span>
                      )}
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
              {box.packsOpenedBucket ? (
                <span className="bg-pa-green/8 border border-pa-green/15 text-pa-green text-xs px-2.5 py-1 rounded-lg">
                  🔥 {box.packsOpenedBucket} {isDe ? "geöffnet" : "opened"}
                </span>
              ) : (
                <span className="bg-white/4 border border-border text-text-muted text-xs px-2.5 py-1 rounded-lg">
                  ✨ {isDe ? "Neu" : "New"}
                </span>
              )}
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

            {/* CTA + Balance inline */}
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="lg"
                  className="flex-1"
                  data-tour="pack-buy-button"
                  disabled={!canAfford || opening || box.availableCards === 0 || !!pendingOtherBox}
                  loading={opening}
                  onClick={() => setConfirmOpen("normal")}
                >
                  <Package className="w-4 h-4 mr-1.5" />
                  {isDe ? "Pack Öffnen" : "Open Pack"} — {totalCost} Coins
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  disabled={!canAfford || opening || box.availableCards === 0 || !!pendingOtherBox}
                  onClick={() => setConfirmOpen("quick")}
                >
                  {isDe ? "Schnell" : "Quick"}
                </Button>
              </div>
              <span className={`text-sm font-bold tabular-nums ${canAfford ? "text-pa-green" : "text-red-400"}`}>
                {(userCoins ?? 0).toLocaleString()} Coins
              </span>
              <span className="hidden lg:inline text-xs text-text-muted">
                {box.cardsPerPack} {isDe ? "Karten/Pack" : "cards/pack"} · {box.availableCards} {isDe ? "verfügbar" : "available"}
              </span>
            </div>
          </div>

          {/* Right: Description + Condition + Rarities */}
          <div className="lg:w-170 shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-3">
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

            {/* Condition distribution */}
            <div className="bg-white/4 rounded-xl p-3.5">
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">
                {isDe ? "Zustand" : "Condition"}
              </p>
              <div className="space-y-2">
                {(box.conditionInfo ?? []).map((c) => (
                  <div key={c.condition} className="flex items-center gap-2">
                    <span className="text-[9px] text-text-secondary min-w-12.5 truncate">{c.condition}</span>
                    <div className="flex-1 h-1.5 bg-white/6 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-pa-green/60"
                        style={{ width: `${Math.max(2, c.percentage)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-text-muted tabular-nums w-10 text-right">
                      {c.percentage < 1 ? c.percentage.toFixed(1) : Math.round(c.percentage)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rarity distribution */}
            <div className="bg-white/4 rounded-xl p-3.5">
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">
                {isDe ? "Raritäten" : "Rarities"}
              </p>
              <div className="space-y-2">
                {box.rarityInfo.map((r) => (
                  <div key={r.rarity} className="flex items-center gap-2">
                    <Badge variant="info" className="text-[9px] min-w-12.5 justify-center">{r.rarity}</Badge>
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
                      <div className="w-20 aspect-63/88 bg-white/4 rounded-lg mx-auto mb-2" />
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
                  <Badge variant="info" className="min-w-20 justify-center">{r.rarity}</Badge>
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
            className="w-full shadow-[0_0_24px_--theme(--color-pa-green/0.2)]"
            disabled={!canAfford || box.availableCards === 0}
            onClick={() => { setShowBoxInfo(false); setConfirmOpen("normal"); }}
          >
            🎴 {isDe ? "Pack öffnen" : "Open Pack"} — {totalCost} Coins
          </Button>
        </div>
      </Modal>

      {/* ─── Pack Opening Confirmation Dialog ─── */}
      <Modal
        open={confirmOpen !== null}
        onClose={() => setConfirmOpen(null)}
        title={isDe ? "Pack öffnen?" : "Open pack?"}
        size="sm"
      >
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-pa-green/10">
                <Package className="w-4 h-4 text-pa-green" />
              </div>
              <div>
                <p className="text-text-primary font-medium">
                  {packCount} {packCount === 1 ? "Booster" : "Booster"}
                </p>
                <p className="text-xs text-text-muted">{name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10">
                <Layers className="w-4 h-4 text-blue-400" />
              </div>
              <p className="text-text-primary">
                {packCount * box.cardsPerPack} {isDe ? "Karten" : "cards"}
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-yellow-500/10">
                <Coins className="w-4 h-4 text-yellow-400" />
              </div>
              <div>
                <p className="text-text-primary font-medium">
                  {totalCost.toLocaleString()} Coins
                </p>
                <p className="text-xs text-text-muted">
                  {isDe ? "Verbleibendes Guthaben" : "Remaining balance"}: {((userCoins ?? 0) - totalCost).toLocaleString()} Coins
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="ghost"
              size="md"
              className="flex-1"
              onClick={() => setConfirmOpen(null)}
            >
              {isDe ? "Abbrechen" : "Cancel"}
            </Button>
            <Button
              variant="primary"
              size="md"
              className="flex-1"
              loading={opening}
              onClick={() => {
                quickOpenRef.current = confirmOpen === "quick";
                setConfirmOpen(null);
                void handleOpen();
              }}
            >
              {isDe ? "Öffnen" : "Open"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
