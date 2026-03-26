"use client";

import React, { useState, useEffect } from "react";
import { Check, Coins, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

interface PendingPull {
  _id: string;
  card: { name?: string; image?: string | null; rarity?: string; setName?: string } | null;
  box: { name?: { de: string; en: string } } | null;
  rarity: string;
  coinValue: number;
  conversionValue: number;
  claimDeadline: string;
  packGroupId: string;
  cardIndex: number;
  createdAt: string;
}

interface PendingCardsProps {
  lang: string;
  onDecision: () => void;
}

function timeLeft(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return "Abgelaufen";
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function PendingCards({ lang, onDecision }: PendingCardsProps) {
  const isDe = lang === "de";
  const { toast } = useToast();

  const [pulls, setPulls] = useState<PendingPull[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/pulls?status=pending&limit=100")
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json() as { pulls?: PendingPull[] };
        setPulls(data.pulls ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Refresh countdown every minute
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  async function handleDecision(pull: PendingPull, decision: "claim" | "convert") {
    setProcessingId(pull._id);
    try {
      const res = await fetch("/api/pulls/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packGroupId: pull.packGroupId,
          cardIndex: pull.cardIndex,
          decision,
        }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        toast({ type: "error", title: data.error ?? "Failed" });
        return;
      }
      setPulls((prev) => prev.filter((p) => p._id !== pull._id));
      toast({
        type: "success",
        title: decision === "claim"
          ? (isDe ? "Karte geclaimed!" : "Card claimed!")
          : (isDe ? `${pull.conversionValue} Coins erhalten` : `${pull.conversionValue} coins received`),
      });
      onDecision();
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setProcessingId(null);
    }
  }

  if (loading) {
    return (
      <div className="py-4 text-center">
        <Loader2 className="w-5 h-5 animate-spin mx-auto text-pa-green" />
      </div>
    );
  }

  if (pulls.length === 0) return null;

  return (
    <div className="bg-surface border border-yellow-500/20 rounded-[14px] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-yellow-400" />
        <h3 className="text-sm font-semibold text-text-primary">
          {isDe ? `Ausstehende Karten (${pulls.length})` : `Pending Cards (${pulls.length})`}
        </h3>
      </div>

      <div className="space-y-2">
        {pulls.map((pull) => {
          const card = pull.card;
          const isProcessing = processingId === pull._id;
          const expired = new Date(pull.claimDeadline).getTime() <= Date.now();

          return (
            <div
              key={pull._id}
              className={`flex items-center gap-3 bg-white/3 border border-border rounded-xl p-3 ${expired ? "opacity-50" : ""}`}
            >
              {/* Card image */}
              {card?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={card.image} alt="" className="w-12 rounded shrink-0" loading="lazy" />
              ) : (
                <div className="w-12 aspect-[63/88] bg-white/4 rounded shrink-0" />
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{card?.name ?? "Unknown"}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="info">{pull.rarity}</Badge>
                  <span className="text-xs text-text-muted">{pull.coinValue} Coins</span>
                </div>
              </div>

              {/* Countdown */}
              <div className="text-right shrink-0">
                <p className={`text-xs font-medium tabular-nums ${expired ? "text-red-400" : "text-yellow-400"}`}>
                  {expired ? (isDe ? "Abgelaufen" : "Expired") : timeLeft(pull.claimDeadline)}
                </p>
              </div>

              {/* Actions */}
              {!expired && (
                <div className="flex gap-1.5 shrink-0">
                  <Button
                    variant="primary"
                    size="sm"
                    loading={isProcessing}
                    onClick={() => void handleDecision(pull, "claim")}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={isProcessing}
                    onClick={() => void handleDecision(pull, "convert")}
                  >
                    <Coins className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
