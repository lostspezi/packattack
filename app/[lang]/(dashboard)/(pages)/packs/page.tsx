"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Package, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  packsOpened: number;
  rarities: string[];
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

  // Handle return from Stripe Checkout
  useEffect(() => {
    const purchase = searchParams.get("purchase");
    const sessionId = searchParams.get("session_id");

    if (purchase === "success" && sessionId) {
      pollPurchaseStatus(sessionId);
    }
  }, [searchParams]);

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

  return (
    <div className="space-y-6">
      {/* Coin chest animation overlay */}
      {showAnimation && (
        <CoinChestAnimation
          coinsGranted={animationCoins}
          onClose={() => setShowAnimation(false)}
        />
      )}

      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {isDe ? "Packs" : "Packs"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {isDe
            ? "Wähle eine Box und öffne Packs!"
            : "Choose a box and open packs!"}
        </p>
      </div>

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {boxes.map((box) => {
            const name = isDe
              ? box.name.de || box.name.en
              : box.name.en || box.name.de;
            return (
              <button
                key={box._id}
                type="button"
                onClick={() => router.push(`/${lang}/packs/${box.slug}`)}
                className="bg-surface border border-border rounded-[14px] p-4 text-left hover:border-pa-green/30 transition-all group"
              >
                {/* Box image */}
                {box.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={box.image}
                    alt={name}
                    className="w-full h-40 object-cover rounded-xl mb-3"
                  />
                ) : (
                  <div className="w-full h-40 bg-white/4 rounded-xl mb-3 flex items-center justify-center">
                    <Package className="w-10 h-10 text-text-muted" />
                  </div>
                )}

                {/* Info */}
                <h3 className="text-base font-semibold text-text-primary group-hover:text-pa-green transition-colors">
                  {name}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">{box.game}</p>

                {/* Stats */}
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-lg font-bold text-pa-green">
                    {box.priceInCoins} Coins
                  </span>
                  <span className="text-xs text-text-muted">
                    {box.cardsPerPack}{" "}
                    {isDe ? "Karten/Pack" : "cards/pack"}
                  </span>
                </div>

                {/* Rarities */}
                {box.rarities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {box.rarities.slice(0, 4).map((r) => (
                      <Badge key={r} variant="info">
                        {r}
                      </Badge>
                    ))}
                    {box.rarities.length > 4 && (
                      <Badge variant="user">
                        +{box.rarities.length - 4}
                      </Badge>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
