"use client";

import { Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ELO_RANKS } from "@/lib/battle-constants";

interface BattlePlayer {
  user: {
    _id: string;
    name: string;
    username?: string;
    image?: string;
    elo: number;
  };
  score: number;
  placement: number | null;
  eloChange: number | null;
  eloAtStart: number;
}

interface BattleScoreboardProps {
  players: BattlePlayer[];
  scores: Record<string, number>;
  dict: Record<string, string>;
}

function getEloRank(elo: number): typeof ELO_RANKS[number] {
  let rank: typeof ELO_RANKS[number] = ELO_RANKS[0];
  for (const r of ELO_RANKS) {
    if (elo >= r.minElo) rank = r;
  }
  return rank;
}

export function BattleScoreboard({ players, scores, dict }: BattleScoreboardProps) {
  const sorted = [...players].sort((a, b) => (scores[b.user._id] ?? 0) - (scores[a.user._id] ?? 0));

  return (
    <Card variant="soft" className="p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
        {dict.scoreboard || "Scoreboard"}
      </p>
      <div className="space-y-2">
        {sorted.map((p, idx) => {
          const score = scores[p.user._id] ?? 0;
          const isLeader = idx === 0;
          const rank = getEloRank(p.eloAtStart);

          return (
            <div
              key={p.user._id}
              className={[
                "flex items-center gap-2.5 rounded-[10px] px-2 py-1.5 transition-colors",
                isLeader ? "bg-yellow-500/8 border border-yellow-500/20" : "",
              ].join(" ")}
            >
              <span
                className={[
                  "w-5 text-center text-xs font-bold shrink-0",
                  isLeader ? "text-yellow-400" : "text-text-secondary",
                ].join(" ")}
              >
                #{idx + 1}
              </span>

              {p.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.user.image}
                  alt={p.user.name}
                  className="h-7 w-7 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-pa-lila/30 shrink-0">
                  <Users className="h-3.5 w-3.5 text-text-secondary" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-text-primary">
                  {p.user.username ?? p.user.name}
                </p>
                <p className="text-[10px] text-text-secondary">
                  {rank.emoji} {rank.label["en"]}
                </p>
              </div>

              <span
                className={[
                  "shrink-0 text-sm font-bold tabular-nums",
                  isLeader ? "text-yellow-400" : "text-text-primary",
                ].join(" ")}
              >
                {score}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
