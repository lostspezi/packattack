"use client";

import { useState, useEffect } from "react";
import { Flame, Clock, Coins, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface HitData {
  cardName: string;
  cardImage: string | null;
  rarity: string;
  setName: string;
  coinValue: number;
  marketPrice: number | null;
  username: string;
  userImage: string | null;
  userId: string;
  boxName: { de: string; en: string };
  pulledAt: string;
}

export function HitOfTheDay({ lang }: { lang: string }) {
  const isDe = lang === "de";
  const [hit, setHit] = useState<HitData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/hit-of-the-day")
      .then((r) => r.json())
      .then((data) => setHit(data.hit ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-[14px] border border-border bg-surface p-5 mb-4 animate-pulse">
        <div className="flex items-center gap-6">
          <div className="w-[140px] aspect-[63/88] rounded-xl bg-white/5 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-20 rounded bg-white/5" />
            <div className="h-5 w-48 rounded bg-white/5" />
            <div className="h-4 w-32 rounded bg-white/5" />
          </div>
        </div>
      </div>
    );
  }

  if (!hit) return null;

  const timeAgo = getTimeAgo(hit.pulledAt, isDe);
  const boxName = isDe
    ? hit.boxName.de || hit.boxName.en
    : hit.boxName.en || hit.boxName.de;

  return (
    <div className="group relative rounded-[14px] border border-pa-green/15 bg-gradient-to-r from-pa-green/[0.05] via-surface to-surface overflow-hidden mb-4 transition-all duration-300 hover:border-pa-green/30">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-pa-green/[0.06] blur-3xl" />

      <div className="relative flex items-center gap-6 p-5">
        {/* Card image — floating with edge glow */}
        <div className="relative shrink-0 hit-float-card">
          {hit.cardImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hit.cardImage}
              alt={hit.cardName}
              className="hit-card-glow w-[140px] rounded-xl"
              loading="lazy"
              draggable={false}
            />
          ) : (
            <div className="hit-card-glow w-[140px] aspect-[63/88] rounded-xl bg-white/5 flex items-center justify-center">
              <Trophy className="w-8 h-8 text-text-muted" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 shrink-0">
          {/* Label row */}
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-pa-green" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-pa-green">
                {isDe ? "Hit des Tages" : "Hit of the Day"}
              </span>
            </div>
            <span className="text-text-muted">·</span>
            <div className="flex items-center gap-1 text-[11px] text-text-muted">
              <Clock className="w-3 h-3" />
              {timeAgo}
            </div>
          </div>

          {/* Card name */}
          <h3 className="text-base font-bold text-text-primary leading-tight line-clamp-1">
            {hit.cardName}
          </h3>

          {/* Set + rarity */}
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="info" className="text-[10px]">{hit.rarity}</Badge>
            <span className="text-xs text-text-muted truncate">{hit.setName}</span>
          </div>

          {/* Value */}
          <div className="flex items-center gap-2 mt-2">
            <Coins className="w-3.5 h-3.5 text-pa-green" />
            <span className="text-lg font-extrabold tabular-nums text-pa-green leading-none">
              {hit.coinValue.toLocaleString()}
            </span>
            {hit.marketPrice != null && hit.marketPrice > 0 && (
              <span className="text-[11px] text-text-muted">
                · ~{hit.marketPrice.toFixed(2)} €
              </span>
            )}
          </div>

          {/* Puller */}
          <div className="flex items-center gap-1.5 mt-2">
            {hit.userImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hit.userImage}
                alt=""
                className="w-4 h-4 rounded-full border border-white/10"
                loading="lazy"
              />
            ) : (
              <div className="w-4 h-4 rounded-full bg-pa-green/15 flex items-center justify-center">
                <span className="text-[7px] font-bold text-pa-green">
                  {hit.username.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <span className="text-[11px] text-text-muted">
              {isDe ? "Gezogen von" : "Pulled by"}{" "}
              <span className="text-text-secondary font-medium">{hit.username}</span>
              {boxName && (
                <span className="text-text-muted"> · {boxName}</span>
              )}
            </span>
          </div>
        </div>

        {/* CTA text — fills remaining space, text centered within it */}
        <p className="hidden lg:block flex-1 text-center text-lg font-bold text-pa-green whitespace-nowrap">
          {isDe
            ? "Zeig der Community deinen Hit des Tages!"
            : "Show the community your Hit of the Day!"}
        </p>
      </div>
    </div>
  );
}

function getTimeAgo(dateStr: string, isDe: boolean): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return isDe ? "Gerade eben" : "Just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return isDe ? `vor ${hours}h` : `${hours}h ago`;
}
