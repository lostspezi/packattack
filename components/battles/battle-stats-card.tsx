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
  lang: string;
  elo: number;
  battleStats: BattleStats;
  dict: Record<string, string>;
}

function getEloRank(elo: number) {
  let current: (typeof ELO_RANKS)[number] = ELO_RANKS[0];
  for (const rank of ELO_RANKS) {
    if (elo >= rank.minElo) current = rank;
  }
  return current;
}

export function BattleStatsCard({ lang, elo, battleStats, dict }: BattleStatsCardProps) {
  const rank = getEloRank(elo);
  const { wins, losses, streak, bestStreak, totalBattles } = battleStats;
  const winRate =
    totalBattles > 0 ? Math.round((wins / totalBattles) * 100) : 0;
  const rankLabel = rank.label[lang as "de" | "en"] ?? rank.label.de;

  return (
    <Card variant="soft" className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Swords className="h-5 w-5 text-pa-green" />
        <h3 className="font-semibold text-text-primary">
          {dict["battleStats"] ?? "Battle-Statistiken"}
        </h3>
      </div>

      {/* ELO + rank badge */}
      <div className="flex items-center gap-3">
        <span className="text-3xl font-bold text-text-primary">{elo}</span>
        <span className="rounded border border-white/10 bg-white/5 px-2 py-1 text-sm font-semibold text-text-secondary">
          {rank.emoji} {rankLabel}
        </span>
        <span className="text-xs text-text-secondary">ELO</span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Win/Loss */}
        <div className="rounded-[10px] bg-white/3 border border-white/6 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
            <Trophy className="h-3.5 w-3.5" />
            {dict["winLoss"] ?? "S / N"}
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
            {dict["winRate"] ?? "Siegquote"}
          </div>
          <p className="text-lg font-bold text-text-primary">{winRate}%</p>
        </div>

        {/* Current streak */}
        <div className="rounded-[10px] bg-white/3 border border-white/6 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
            <Zap className="h-3.5 w-3.5" />
            {dict["streak"] ?? "Serie"}
          </div>
          <p className="text-lg font-bold text-text-primary">
            {streak}
            <span className="ml-1 text-xs text-text-secondary font-normal">
              ({dict["best"] ?? "Beste"}: {bestStreak})
            </span>
          </p>
        </div>

        {/* Total battles */}
        <div className="rounded-[10px] bg-white/3 border border-white/6 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
            <Swords className="h-3.5 w-3.5" />
            {dict["battles"] ?? "Battles"}
          </div>
          <p className="text-lg font-bold text-text-primary">{totalBattles}</p>
        </div>
      </div>
    </Card>
  );
}
