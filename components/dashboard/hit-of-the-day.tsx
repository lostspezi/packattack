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

  if (loading || !hit) return null;

  const timeAgo = getTimeAgo(hit.pulledAt, isDe);
  const boxName = isDe
    ? hit.boxName.de || hit.boxName.en
    : hit.boxName.en || hit.boxName.de;

  return (
    <div className="flex flex-col items-center">
      {/* Card + details row */}
      {/* Title — spans across card + details */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-px w-8 bg-gradient-to-r from-transparent to-pa-green/40" />
        <span
          className="text-sm font-bold uppercase tracking-widest bg-gradient-to-r from-pa-green via-white/90 to-pa-green bg-clip-text text-transparent"
          style={{ textShadow: "0 0 20px rgba(155,255,0,0.3)" }}
        >
          {isDe ? "Hit des Tages" : "Hit of the Day"}
        </span>
        <div className="h-px w-8 bg-gradient-to-l from-transparent to-pa-green/40" />
      </div>

      <div className="flex items-stretch gap-5">
        {/* Card image */}
        <div className="shrink-0">
          <div className="relative hit-float-card">
            {hit.cardImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hit.cardImage}
                alt={hit.cardName}
                className="hit-card-glow w-[200px] rounded-xl"
                loading="lazy"
                draggable={false}
              />
            ) : (
              <div className="hit-card-glow w-[200px] aspect-[63/88] rounded-xl bg-white/5 flex items-center justify-center">
                <Trophy className="w-10 h-10 text-text-muted" />
              </div>
            )}
          </div>
        </div>

        {/* Details — vertically centered next to the card */}
        <div className="min-w-0 flex flex-col justify-center">
          <h3 className="text-base font-bold text-text-primary leading-tight line-clamp-2">
            {hit.cardName}
          </h3>

          <div className="flex items-center gap-2 mt-1.5">
            <Badge variant="info" className="text-[10px]">{hit.rarity}</Badge>
            <span className="text-xs text-text-muted truncate">{hit.setName}</span>
          </div>

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
              <span className="text-text-secondary font-medium">{hit.username}</span>
              {boxName && <span> · {boxName}</span>}
            </span>
          </div>

          <div className="flex items-center gap-1 mt-1.5 text-[11px] text-text-muted">
            <Clock className="w-3 h-3" />
            <span>{timeAgo}</span>
          </div>
        </div>
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
