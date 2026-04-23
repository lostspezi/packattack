"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Package, Loader2, Coins, ChevronRight } from "lucide-react";

import { HitOfTheDay } from "@/components/dashboard/hit-of-the-day";
import { CoinChestAnimation } from "@/components/balance/coin-chest-animation";
import { useToast } from "@/components/ui/toast";

interface BoxItem {
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
  rarities: string[];
  isTutorial?: boolean;
  previewCards?: Array<{
    image: string;
    name: string;
    price: number | null;
  }>;
}

export default function PacksPage() {
  const params = useParams<{ lang: string }>();
  const lang = params.lang ?? "en";
  const isDe = lang === "de";
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [boxes, setBoxes] = useState<BoxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAnimation, setShowAnimation] = useState(false);
  const [animationCoins, setAnimationCoins] = useState(0);

  useEffect(() => {
    fetch("/api/packs")
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { boxes?: BoxItem[] };
        setBoxes(data.boxes ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const pollPurchaseStatus = useCallback(
    async (sessionId: string) => {
      const maxAttempts = 10;
      for (let i = 0; i < maxAttempts; i++) {
        const res = await fetch(
          `/api/coins/purchases?sessionId=${sessionId}`
        );
        const data = await res.json();
        if (data.purchase?.status === "completed") {
          setAnimationCoins(data.purchase.coinsGranted);
          setShowAnimation(true);
          window.dispatchEvent(new CustomEvent("coin-balance-refresh"));
          // Clean up URL params
          router.replace(`/${lang}/packs`, { scroll: false });
          return;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      toast({
        type: "info",
        title: isDe
          ? "Zahlung wird verarbeitet..."
          : "Payment is being processed...",
        message: isDe
          ? "Deine Münzen werden in Kürze gutgeschrieben."
          : "Your coins will be credited shortly.",
      });
    },
    [toast, isDe, lang, router]
  );

  // Handle return from Stripe Checkout
  /* eslint-disable react-hooks/set-state-in-effect -- pollPurchaseStatus is async, setState happens in callbacks */
  useEffect(() => {
    const purchase = searchParams.get("purchase");
    const sessionId = searchParams.get("session_id");

    if (purchase === "success" && sessionId) {
      pollPurchaseStatus(sessionId);
    }
  }, [searchParams, pollPurchaseStatus]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <div className="space-y-6">
      {/* Coin chest animation overlay */}
      {showAnimation && (
        <CoinChestAnimation
          coinsGranted={animationCoins}
          onClose={() => setShowAnimation(false)}
        />
      )}

      <HitOfTheDay lang={lang} />

      {loading ? (
        <div className="py-16 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-pa-green mb-2" />
          <p className="text-sm text-text-muted">
            {isDe ? "Laden…" : "Loading…"}
          </p>
        </div>
      ) : boxes.length === 0 ? (
        <div className="py-16 text-center">
          <Package className="w-10 h-10 mx-auto text-text-muted mb-3" />
          <p className="text-text-muted">
            {isDe
              ? "Noch keine Boxen verfügbar."
              : "No boxes available yet."}
          </p>
        </div>
      ) : (
        <>
        <div>
          <h2 className="text-2xl font-bold text-text-primary">
            {isDe ? "Packs" : "Packs"}
          </h2>
          <p className="text-text-secondary mt-1 text-sm mb-4">
            {isDe
              ? "Wähle eine Box und öffne Packs!"
              : "Choose a box and open packs!"}
          </p>
        </div>
        <div
          data-tour="packs-grid"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {boxes.map((box, boxIdx) => {
            const name = isDe
              ? box.name.de || box.name.en
              : box.name.en || box.name.de;
            return (
              <button
                key={box._id}
                type="button"
                data-tour={boxIdx === 0 ? "pack-buy" : undefined}
                data-tour-tutorial-box={box.isTutorial ? "true" : undefined}
                onClick={() => router.push(`/${lang}/packs/${box.slug}`)}
                className="bg-surface border border-border rounded-[14px] p-4 text-left hover:border-pa-green/30 transition-all duration-300 group hover:-translate-y-2 hover:shadow-[0_8px_30px_rgba(155,255,0,0.08)] block w-full relative overflow-hidden flex flex-col"
              >
                {/* Box image or Preview Cards */}
                {box.previewCards && box.previewCards.length >= 3 ? (
                  <div className="relative h-[220px] bg-white/4 rounded-xl mb-4 flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent z-40 pointer-events-none opacity-80"></div>
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider z-50 bg-red-600 text-white shadow-sm border border-red-500/50">
                      {box.game}
                    </div>

                    <div className="relative h-full w-full flex items-center justify-center mt-6">
                      {/* Left Card */}
                      <div className="absolute transition-all duration-[600ms] ease-[cubic-bezier(0.23,1,0.32,1)] -rotate-12 -translate-x-[20px] z-10 group-hover:rotate-0 group-hover:-translate-x-[85px] group-hover:-translate-y-2 group-hover:scale-105 origin-bottom">
                        <div className="relative w-[100px] h-[140px] rounded-lg overflow-hidden border-2 border-white/10 shadow-2xl group-hover:border-pa-green/50 transition-all duration-500 bg-surface">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={box.previewCards[2].image} alt="" className="object-cover w-full h-full" />
                        </div>
                      </div>
                      
                      {/* Right Card */}
                      <div className="absolute transition-all duration-[600ms] ease-[cubic-bezier(0.23,1,0.32,1)] rotate-12 translate-x-[20px] z-20 group-hover:rotate-0 group-hover:translate-x-[85px] group-hover:-translate-y-2 group-hover:scale-105 origin-bottom">
                        <div className="relative w-[100px] h-[140px] rounded-lg overflow-hidden border-2 border-white/10 shadow-2xl group-hover:border-pa-green/50 transition-all duration-500 bg-surface">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={box.previewCards[1].image} alt="" className="object-cover w-full h-full" />
                        </div>
                      </div>

                      {/* Center Card */}
                      <div className="absolute transition-all duration-[600ms] ease-[cubic-bezier(0.23,1,0.32,1)] -translate-y-[6px] z-30 group-hover:rotate-0 group-hover:translate-x-0 group-hover:-translate-y-[8px] group-hover:scale-105 origin-bottom">
                        <div className="relative w-[100px] h-[140px] rounded-lg overflow-hidden border-2 border-white/10 shadow-2xl group-hover:border-pa-green/50 transition-all duration-500 bg-surface">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={box.previewCards[0].image} alt="" className="object-cover w-full h-full" />
                          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-black/85 border border-pa-green/30 flex items-center gap-1 whitespace-nowrap shadow-md">
                            <Coins className="w-2.5 h-2.5 text-pa-green" />
                            <span className="text-[10px] font-bold text-pa-green">
                              {box.previewCards[0].price?.toFixed(2) ?? "0.00"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : box.image ? (
                  <div className="relative h-[220px] bg-white/4 rounded-xl mb-4 overflow-hidden flex items-center justify-center">
                    <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent z-40 pointer-events-none opacity-80"></div>
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider z-50 bg-red-600 text-white shadow-sm border border-red-500/50">
                      {box.game}
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={box.image}
                      alt={name}
                      className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105 relative z-10"        
                    />
                  </div>
                ) : (
                  <div className="relative h-[220px] bg-white/4 rounded-xl mb-4 flex items-center justify-center">
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider z-50 bg-red-600 text-white shadow-sm border border-red-500/50">
                      {box.game}
                    </div>
                    <Package className="w-10 h-10 text-text-muted" />
                  </div>
                )}

                <div className="bg-surface relative z-10 space-y-1">
                  {/* Info */}
                  <h3 className="text-[17px] font-bold text-text-primary group-hover:text-pa-green transition-colors line-clamp-1">
                    {name}
                  </h3>
                  <p className="text-[13px] text-text-muted mb-5">
                    {box.cardsPerPack} {isDe ? "Karten/Pack" : "cards/pack"} · {box.totalCards} total cards
                  </p>

                  {/* Stats Bottom Bar */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-pa-green/10 border border-pa-green/20">
                        <Coins className="w-4 h-4 text-pa-green" />
                      </div>
                      <span className="text-2xl font-extrabold text-pa-green">
                        {box.priceInCoins.toFixed(2)}
                      </span>
                    </div>

                    <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-pa-green text-surface text-sm font-bold rounded-xl shadow-[0_2px_12px_rgba(155,255,0,0.2)] group-hover:shadow-[0_4px_24px_rgba(155,255,0,0.35)] transition-all">
                      {isDe ? "Öffnen" : "Open"} <ChevronRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}
