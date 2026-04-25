"use client";

import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CampaignCard {
  _id: string;
  source: "internal" | "justtcg";
  name: string;
  game: string;
  set: string;
  setName: string;
  rarity: string;
  image: string | null;
  tcgplayerId: string | null;
  position: number;
}

interface Props {
  lang: string;
  dict: Record<string, string>;
  cards: CampaignCard[];
  ranked: Array<{ cardRefId: string; voteCount: number }>;
  totalVoters: number;
  myPicks: string[];
}

export function UpvoteReveal({ dict, cards, ranked, totalVoters, myPicks }: Props) {
  const cardById = new Map(cards.map((c) => [c._id, c]));
  const myPickSet = new Set(myPicks);
  const maxCount = ranked.length > 0 ? Math.max(...ranked.map((r) => r.voteCount), 1) : 1;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-text-primary">
          {dict["revealHeadline"] ?? "Here is how the community voted"}
        </h2>
        <p className="text-sm text-text-secondary mt-1">
          {totalVoters === 1
            ? dict["voterCountSingular"] ?? "1 voter"
            : (dict["voterCountPlural"] ?? "{{count}} voters").replace(
                "{{count}}",
                String(totalVoters)
              )}
        </p>
      </div>

      {myPicks.length === 0 ? (
        <p className="text-sm text-text-muted italic">{dict["myVotesEmpty"] ?? "You did not vote here."}</p>
      ) : null}

      {ranked.length === 0 && (
        <p className="text-sm text-text-muted">
          {dict["revealNoVotes"] ?? "No votes yet."}
        </p>
      )}

      <ul className="space-y-2">
        {ranked.map((row, idx) => {
          const card = cardById.get(row.cardRefId);
          if (!card) return null;
          const wasPicked = myPickSet.has(row.cardRefId);
          const widthPct = (row.voteCount / maxCount) * 100;
          return (
            <li
              key={row.cardRefId}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                wasPicked ? "border-pa-green/40 bg-pa-green/5" : "border-border bg-surface"
              }`}
            >
              <span className="text-lg font-bold text-text-muted w-7 text-right">{idx + 1}</span>
              {card.image ? (
                <img
                  src={card.image}
                  alt=""
                  className="w-12 h-16 object-cover rounded bg-surface-2"
                />
              ) : (
                <div className="w-12 h-16 bg-surface-2 rounded" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary truncate">{card.name}</span>
                  {wasPicked && (
                    <span className="inline-flex items-center gap-1 text-xs text-pa-green">
                      <Star className="w-3 h-3 fill-current" />
                      {dict["revealMyPick"] ?? "Your pick"}
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-muted truncate flex items-center gap-1">
                  {card.setName} · <Badge variant="info">{card.rarity}</Badge>
                </div>
                <div className="mt-2 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-pa-green transition-all"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
              <div className="text-right tabular-nums">
                <div className="text-sm font-bold text-text-primary">{row.voteCount}</div>
                <div className="text-[10px] text-text-muted uppercase tracking-wide">
                  {row.voteCount === 1
                    ? dict["voteLabelSingular"] ?? "vote"
                    : dict["voteLabelPlural"] ?? "votes"}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
