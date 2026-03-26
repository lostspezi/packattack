"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";

interface PullInfo {
  _id: string;
  card: { name?: string; image?: string | null } | null;
  rarity: string;
  coinValue: number;
  conversionValue: number;
  status: string;
  createdAt: string;
}

export function MyPulls({ pulls, lang }: { pulls: PullInfo[]; lang: string }) {
  const isDe = lang === "de";

  if (pulls.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-[14px] p-4">
        <div className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-3">
          {isDe ? "Meine letzten Pulls" : "My Recent Pulls"}
        </div>
        <p className="text-xs text-text-muted py-4 text-center">
          {isDe ? "Noch keine Pulls — öffne ein Pack!" : "No pulls yet — open a pack!"}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-[14px] p-4">
      <div className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-3">
        {isDe ? "Meine letzten Pulls" : "My Recent Pulls"}
      </div>

      <div className="space-y-1.5">
        {pulls.map((pull) => {
          const card = pull.card as { name?: string; image?: string | null } | null;
          return (
            <div key={pull._id} className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
              {card?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={card.image} alt="" className="w-8 rounded shrink-0" loading="lazy" />
              ) : (
                <div className="w-8 aspect-[63/88] bg-white/4 rounded shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-text-primary truncate">{card?.name ?? "Unknown"}</p>
                <Badge variant="info">{pull.rarity}</Badge>
              </div>
              <Badge variant={pull.status === "claimed" ? "success" : "info"}>
                {pull.status === "claimed"
                  ? (isDe ? "Geclaimed" : "Claimed")
                  : `+${pull.conversionValue}`}
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}
