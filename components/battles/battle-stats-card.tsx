"use client";

import { Swords, TrendingUp, Zap, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ELO_RANKS } from "@/lib/battle-constants";

interface BattleStats {
  wins: number;
  losses: number;
  streak: number;
  bestStreak: number;
  totalBattles: number;
}

interface BattleStatsCardProps {
  elo: number;
  battleStats: BattleStats;
}

function getEloRank(elo: number) {
  let current = ELO_RANKS[0];
  for (const rank of ELO_RANKS) {
    if (elo >= rank.minElo) current = rank;
  }
  return current;
}

export function BattleStatsCard({ elo, battleStats }: BattleStatsCardProps) {
  const rank = getEloRank(elo);
  const { wins, losses, streak, bestStreak, totalBattles } = battleStats;
  const winRate =
    totalBattles > 0 ? Math.round((wins / totalBattles) * 100) : 0;

  return (
    <Card variant="soft" className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Swords className="h-5 w-5 text-pa-green" />
        <h3 className="font-semibold text-text-primary">Battle Stats</h3>
      </div>

      {/* ELO + rank badge */}
      <div className="flex items-center gap-3">
        <span className="text-3xl font-bold text-text-primary">{elo}</span>
        <span className="rounded border border-white/10 bg-white/5 px-2 py-1 text-sm font-semibold text-text-secondary">
          {rank.emoji} {rank.label.en}
        </span>
        <span className="text-xs text-text-secondary">ELO</span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Win/Loss */}
        <div className="rounded-[10px] bg-white/3 border border-white/6 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
            <Trophy className="h-3.5 w-3.5" />
            W / L
          </div>
          <p className="text-lg font-bold text-text-primary">
            {wins}
            <span className="text-text-secondary font-normal"> / </span>
            {losses}
          </p>
        </div>

        {/* Win rate */}
        <div className="rounded-[10px] bg-white/3 border border-white/6 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
            <TrendingUp className="h-3.5 w-3.5" />
            Win Rate
          </div>
          <p className="text-lg font-bold text-text-primary">{winRate}%</p>
        </div>

        {/* Current streak */}
        <div className="rounded-[10px] bg-white/3 border border-white/6 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
            <Zap className="h-3.5 w-3.5" />
            Streak
          </div>
          <p className="text-lg font-bold text-text-primary">
            {streak}
            <span className="ml-1 text-xs text-text-secondary font-normal">
              (best: {bestStreak})
            </span>
          </p>
        </div>

        {/* Total battles */}
        <div className="rounded-[10px] bg-white/3 border border-white/6 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
            <Swords className="h-3.5 w-3.5" />
            Battles
          </div>
          <p className="text-lg font-bold text-text-primary">{totalBattles}</p>
        </div>
      </div>
    </Card>
  );
}
