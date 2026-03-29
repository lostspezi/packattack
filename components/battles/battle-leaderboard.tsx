"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Loader2, Trophy, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ELO_RANKS } from "@/lib/battle-constants";

type Category = "elo" | "wins" | "streak";

interface LeaderboardUser {
  name: string;
  username?: string;
  image?: string;
  elo: number;
  battleStats: {
    wins: number;
    losses: number;
    streak: number;
    bestStreak: number;
    totalBattles: number;
  };
  badges?: string[];
}

interface LeaderboardEntry {
  rank: number;
  user: LeaderboardUser;
}

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  total: number;
  page: number;
  limit: number;
  myRank: number | null;
}

function getEloRank(elo: number) {
  let current = ELO_RANKS[0];
  for (const rank of ELO_RANKS) {
    if (elo >= rank.minElo) current = rank;
  }
  return current;
}

function StatValue({ entry, category }: { entry: LeaderboardEntry; category: Category }) {
  if (category === "elo") {
    return <span className="font-bold text-text-primary">{entry.user.elo}</span>;
  }
  if (category === "wins") {
    return <span className="font-bold text-text-primary">{entry.user.battleStats.wins}</span>;
  }
  return <span className="font-bold text-text-primary">{entry.user.battleStats.bestStreak}</span>;
}

const TABS: { key: Category; label: string }[] = [
  { key: "elo", label: "ELO" },
  { key: "wins", label: "Wins" },
  { key: "streak", label: "Streak" },
];

const LIMIT = 20;

export function BattleLeaderboard() {
  const [category, setCategory] = useState<Category>("elo");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/battles/leaderboard?category=${category}&page=${page}&limit=${LIMIT}`)
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [category, page]);

  function handleTab(cat: Category) {
    setCategory(cat);
    setPage(1);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1;

  return (
    <div className="space-y-4">
      {/* Category tabs */}
      <div className="flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTab(tab.key)}
            className={[
              "rounded-[10px] px-4 py-1.5 text-sm font-medium transition-colors",
              category === tab.key
                ? "bg-pa-green text-bg"
                : "bg-white/5 text-text-secondary hover:bg-white/10 hover:text-text-primary",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* My rank callout */}
      {data?.myRank != null && (
        <p className="text-sm text-text-secondary">
          Your rank:{" "}
          <span className="font-semibold text-pa-green">#{data.myRank}</span>
        </p>
      )}

      {/* Table */}
      <Card variant="soft" className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-text-secondary" />
          </div>
        ) : !data || data.leaderboard.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <Trophy className="h-12 w-12 text-text-secondary opacity-30" />
            <p className="text-text-secondary">No rankings yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {data.leaderboard.map((entry) => {
              const eloRank = getEloRank(entry.user.elo);
              const isMe = data.myRank != null && entry.rank === data.myRank;
              return (
                <li
                  key={entry.rank}
                  className={[
                    "flex items-center gap-4 px-4 py-3 transition-colors",
                    isMe ? "bg-pa-green/10" : "hover:bg-white/3",
                  ].join(" ")}
                >
                  {/* Rank */}
                  <span
                    className={[
                      "w-8 shrink-0 text-center text-sm font-bold",
                      entry.rank === 1
                        ? "text-yellow-400"
                        : entry.rank === 2
                        ? "text-slate-300"
                        : entry.rank === 3
                        ? "text-amber-600"
                        : "text-text-secondary",
                    ].join(" ")}
                  >
                    #{entry.rank}
                  </span>

                  {/* Avatar */}
                  <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white/10">
                    {entry.user.image ? (
                      <Image
                        src={entry.user.image}
                        alt={entry.user.name}
                        fill
                        className="object-cover"
                        sizes="32px"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xs font-bold text-text-secondary">
                        {(entry.user.name ?? "?")[0]?.toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Name */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text-primary">
                      {entry.user.name}
                    </p>
                    {entry.user.username && (
                      <p className="truncate text-xs text-text-secondary">
                        @{entry.user.username}
                      </p>
                    )}
                  </div>

                  {/* ELO rank badge */}
                  <span
                    className="shrink-0 rounded border border-white/8 bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-text-secondary"
                    title={`${eloRank.label.en} (${eloRank.minElo}+ ELO)`}
                  >
                    {eloRank.emoji} {eloRank.label.en}
                  </span>

                  {/* Stat value */}
                  <span className="shrink-0 w-16 text-right text-sm">
                    <StatValue entry={entry} category={category} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-text-secondary">
            Page {page} / {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
