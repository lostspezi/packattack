"use client";

import { useState } from "react";
import { ShoppingCart, Coins, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface DistributedCard {
  pullId: string;
  card: { _id: string; name: string; image?: string };
  rarity: string;
  coinValue: number;
  conversionValue?: number;
  decided?: boolean;
  decision?: "claim" | "convert";
}

interface BattleDecideProps {
  battleId: string;
  cards: DistributedCard[];
  dict: Record<string, string>;
}

const RARITY_BADGE: Record<string, string> = {
  Common: "bg-gray-500/20 text-gray-300",
  Uncommon: "bg-green-500/20 text-green-300",
  Rare: "bg-blue-500/20 text-blue-300",
  "Rare Holo": "bg-blue-500/20 text-blue-300",
  Epic: "bg-purple-500/20 text-purple-300",
  Legendary: "bg-yellow-500/20 text-yellow-300",
  "Ultra Rare": "bg-gradient-to-r from-pink-500/30 via-yellow-400/30 to-blue-500/30 text-white",
};

export function BattleDecide({ battleId, cards, dict }: BattleDecideProps) {
  const [decisions, setDecisions] = useState<Record<string, { status: "claim" | "convert"; loading: boolean }>>({});

  async function handleDecide(pullId: string, action: "claim" | "convert") {
    setDecisions((prev) => ({ ...prev, [pullId]: { status: action, loading: true } }));
    try {
      const res = await fetch(`/api/battles/${battleId}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ battlePullId: pullId, decision: action }),
      });
      if (!res.ok) {
        setDecisions((prev) => {
          const copy = { ...prev };
          delete copy[pullId];
          return copy;
        });
      }
    } catch {
      setDecisions((prev) => {
        const copy = { ...prev };
        delete copy[pullId];
        return copy;
      });
    } finally {
      setDecisions((prev) => ({
        ...prev,
        [pullId]: { ...prev[pullId], loading: false },
      }));
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-text-primary">
        {dict.yourCards || "Your Cards"} ({cards.length})
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => {
          const dec = decisions[c.pullId];
          const isDecided = dec?.status !== undefined || c.decided;
          const decision = dec?.status ?? c.decision;
          const isLoading = dec?.loading;
          const badgeClass = RARITY_BADGE[c.rarity] ?? RARITY_BADGE["Common"];
          const conversion = c.conversionValue ?? c.coinValue;

          return (
            <Card key={c.pullId} variant="soft" className="flex flex-col gap-2 overflow-hidden p-0">
              {/* Image */}
              {c.card.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.card.image}
                  alt={c.card.name}
                  className="h-36 w-full object-cover"
                />
              ) : (
                <div className="flex h-36 w-full items-center justify-center bg-white/5">
                  <span className="text-3xl">🃏</span>
                </div>
              )}

              {/* Info */}
              <div className="space-y-1.5 px-3 pb-3">
                <p className="truncate text-sm font-semibold text-text-primary">{c.card.name}</p>
                <div className="flex items-center justify-between gap-1">
                  <span className={["rounded px-1.5 py-0.5 text-[10px] font-bold", badgeClass].join(" ")}>
                    {c.rarity}
                  </span>
                  <span className="text-xs text-pa-green font-medium">{c.coinValue} 🪙</span>
                </div>

                {/* Decision */}
                {isDecided ? (
                  <div
                    className={[
                      "rounded-[8px] px-3 py-2 text-center text-xs font-bold",
                      decision === "claim"
                        ? "bg-pa-green/10 text-pa-green border border-pa-green/20"
                        : "bg-blue-500/10 text-blue-300 border border-blue-500/20",
                    ].join(" ")}
                  >
                    {decision === "claim"
                      ? `✓ ${dict.claimed || "Claimed"}`
                      : `↑ ${dict.converted || "Converted"} (+${conversion}🪙)`}
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <Button
                      variant="accent"
                      size="sm"
                      className="flex-1 text-xs"
                      disabled={isLoading}
                      onClick={() => handleDecide(c.pullId, "claim")}
                    >
                      {isLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <ShoppingCart className="h-3 w-3" />
                      )}
                      {dict.claim || "Claim"}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1 text-xs"
                      disabled={isLoading}
                      onClick={() => handleDecide(c.pullId, "convert")}
                    >
                      <Coins className="h-3 w-3 text-pa-green" />
                      {dict.convert || "Convert"}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
