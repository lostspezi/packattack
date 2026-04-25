"use client";

import { Star, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { VotingItem } from "@/components/votes/upvote-item-tile";

interface Props {
  lang: string;
  dict: Record<string, string>;
  items: VotingItem[];
  ranked: Array<{ itemRefId: string; voteCount: number }>;
  totalVoters: number;
  myPicks: string[];
}

export function UpvoteReveal({ lang, dict, items, ranked, totalVoters, myPicks }: Props) {
  const isDe = lang === "de";
  const itemById = new Map(items.map((c) => [c._id, c]));
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
          const item = itemById.get(row.itemRefId);
          if (!item) return null;
          const wasPicked = myPickSet.has(row.itemRefId);
          const widthPct = (row.voteCount / maxCount) * 100;
          const label = isDe ? item.label.de || item.label.en : item.label.en || item.label.de;
          return (
            <li
              key={row.itemRefId}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                wasPicked ? "border-pa-green/40 bg-pa-green/5" : "border-border bg-surface"
              }`}
            >
              <span className="text-lg font-bold text-text-muted w-7 text-right">{idx + 1}</span>
              {item.image ? (
                <img
                  src={item.image}
                  alt=""
                  className="w-12 h-16 object-cover rounded bg-surface-2"
                />
              ) : (
                <div className="w-12 h-16 bg-surface-2 rounded flex items-center justify-center text-text-muted">
                  {item.kind === "box" ? <Package className="w-5 h-5" /> : null}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary truncate">{label}</span>
                  {wasPicked && (
                    <span className="inline-flex items-center gap-1 text-xs text-pa-green">
                      <Star className="w-3 h-3 fill-current" />
                      {dict["revealMyPick"] ?? "Your pick"}
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-muted truncate flex items-center gap-1">
                  {item.kind === "card" && item.setName ? (
                    <>
                      {item.setName}
                      {item.rarity && <Badge variant="info">{item.rarity}</Badge>}
                    </>
                  ) : item.kind === "box" ? (
                    <>
                      <Package className="w-3 h-3" />
                      {item.game ?? "Box"}
                    </>
                  ) : null}
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
