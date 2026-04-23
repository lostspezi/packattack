"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Trophy, Medal, ChevronDown, Loader2, Flame, TrendingUp } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  elo: number;
  wins: number;
  losses: number;
  winRate: number;
  streak: number;
  bestStreak: number;
  totalBattles: number;
}

interface MyStats {
  rank: number;
  username: string;
  elo: number;
  eloRank: { name: string; minElo: number; color: string };
  wins: number;
  losses: number;
  winRate: number;
  streak: number;
  bestStreak: number;
  totalBattles: number;
}

interface Season {
  _id: string;
  name: { de: string; en: string };
  number: number;
  status: string;
  startsAt: string;
  endsAt: string;
}

const SORT_OPTIONS = [
  { value: "elo", label: { de: "ELO", en: "ELO" } },
  { value: "wins", label: { de: "Siege", en: "Wins" } },
  { value: "winrate", label: { de: "Winrate", en: "Win Rate" } },
  { value: "streak", label: { de: "Streak", en: "Streak" } },
] as const;

const RANK_COLORS: Record<string, string> = {
  Bronze: "text-amber-600",
  Silver: "text-zinc-400",
  Gold: "text-yellow-400",
  Diamond: "text-cyan-400",
  Champion: "text-purple-400",
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function LeaderboardPage() {
  const params = useParams<{ lang: string }>();
  const lang = params.lang ?? "en";
  const isDe = lang === "de";
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myStats, setMyStats] = useState<MyStats | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>("global");
  const [sort, setSort] = useState("elo");
  const [loading, setLoading] = useState(true);
  const [seasonDropdown, setSeasonDropdown] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort, limit: "50" });
      if (selectedSeason !== "global") {
        params.set("season", selectedSeason);
      }

      const [lbRes, meRes] = await Promise.all([
        fetch(`/api/leaderboard?${params}`),
        fetch("/api/leaderboard/me"),
      ]);

      if (lbRes.ok) {
        const data = await lbRes.json();
        setEntries(data.leaderboard ?? []);
      }
      if (meRes.ok) {
        const data = await meRes.json();
        setMyStats(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [sort, selectedSeason]);

  // Fetch seasons once
  useEffect(() => {
    fetch("/api/seasons")
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setSeasons(data.seasons ?? []);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const activeSeason = seasons.find((s) => s.status === "active");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-100">
          <Trophy className="h-6 w-6 text-yellow-400" />
          {isDe ? "Bestenliste" : "Leaderboard"}
        </h1>

        <div className="flex items-center gap-2">
          {/* Season Selector */}
          <div className="relative">
            <button
              onClick={() => setSeasonDropdown(!seasonDropdown)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-all hover:border-zinc-600"
            >
              {selectedSeason === "global"
                ? isDe ? "Global" : "Global"
                : isDe
                  ? seasons.find((s) => s._id === selectedSeason)?.name.de
                  : seasons.find((s) => s._id === selectedSeason)?.name.en}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {seasonDropdown && (
              <div className="absolute right-0 z-20 mt-1 min-w-[180px] rounded-lg border border-zinc-700 bg-zinc-800 p-1 shadow-xl">
                <button
                  onClick={() => { setSelectedSeason("global"); setSeasonDropdown(false); }}
                  className={`w-full rounded px-3 py-1.5 text-left text-xs ${
                    selectedSeason === "global" ? "bg-yellow-400/10 text-yellow-400" : "text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  {isDe ? "Global" : "Global"}
                </button>
                {seasons.map((season) => (
                  <button
                    key={season._id}
                    onClick={() => { setSelectedSeason(season._id); setSeasonDropdown(false); }}
                    className={`w-full rounded px-3 py-1.5 text-left text-xs ${
                      selectedSeason === season._id ? "bg-yellow-400/10 text-yellow-400" : "text-zinc-300 hover:bg-zinc-700"
                    }`}
                  >
                    {isDe ? season.name.de : season.name.en}
                    {season.status === "active" && (
                      <span className="ml-1 text-[10px] text-green-400">(Live)</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sort */}
          <div className="flex rounded-lg border border-zinc-700 bg-zinc-800">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSort(opt.value)}
                className={`px-2.5 py-1.5 text-[11px] font-medium transition-all first:rounded-l-lg last:rounded-r-lg ${
                  sort === opt.value
                    ? "bg-yellow-400 text-black"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {isDe ? opt.label.de : opt.label.en}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active Season Banner */}
      {activeSeason && selectedSeason === activeSeason._id && (
        <div className="mb-6 rounded-xl border border-yellow-400/20 bg-yellow-400/5 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-yellow-400">
                {isDe ? activeSeason.name.de : activeSeason.name.en}
              </div>
              <div className="text-xs text-zinc-500">
                {isDe ? "Endet am" : "Ends"}{" "}
                {new Date(activeSeason.endsAt).toLocaleDateString(isDe ? "de-DE" : "en-US")}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* My Stats Card */}
      {myStats && myStats.totalBattles > 0 && (
        <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {isDe ? "Deine Position" : "Your Position"}
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-yellow-400">#{myStats.rank}</span>
              <div>
                <div className="font-bold text-zinc-100">{myStats.username}</div>
                <div className={`text-xs font-medium ${RANK_COLORS[myStats.eloRank.name] ?? "text-zinc-400"}`}>
                  {myStats.eloRank.name} — {myStats.elo} ELO
                </div>
              </div>
            </div>
            <div className="flex gap-4 text-xs text-zinc-400">
              <span>
                <Medal className="mr-1 inline h-3.5 w-3.5 text-zinc-500" />
                {myStats.wins}W / {myStats.losses}L
              </span>
              <span>
                <TrendingUp className="mr-1 inline h-3.5 w-3.5 text-zinc-500" />
                {myStats.winRate}%
              </span>
              <span>
                <Flame className="mr-1 inline h-3.5 w-3.5 text-zinc-500" />
                {myStats.streak} ({isDe ? "Best" : "Best"}: {myStats.bestStreak})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Table */}
      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 py-16 text-center">
          <Trophy className="mb-3 h-10 w-10 text-zinc-700" />
          <p className="text-sm text-zinc-500">
            {isDe ? "Noch keine Battles gespielt." : "No battles played yet."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  {isDe ? "Spieler" : "Player"}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">ELO</th>
                <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 sm:table-cell">
                  W/L
                </th>
                <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 md:table-cell">
                  {isDe ? "Winrate" : "Win Rate"}
                </th>
                <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 md:table-cell">
                  Streak
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  {isDe ? "Battles" : "Battles"}
                </th>
              </tr>
            </thead>
            <tbody data-tour="leaderboard-list">
              {entries.map((entry) => {
                const isMe = myStats?.username === entry.username;
                return (
                  <tr
                    key={entry.userId}
                    className={`border-b border-zinc-800/50 transition-colors ${
                      isMe ? "bg-yellow-400/5" : "hover:bg-zinc-800/30"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span className={`font-bold ${entry.rank <= 3 ? "text-yellow-400" : "text-zinc-500"}`}>
                        {entry.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={isMe ? "font-bold text-yellow-400" : "text-zinc-200"}>
                        {entry.username}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-zinc-300">{entry.elo}</td>
                    <td className="hidden px-4 py-3 text-right text-zinc-400 sm:table-cell">
                      {entry.wins}/{entry.losses}
                    </td>
                    <td className="hidden px-4 py-3 text-right text-zinc-400 md:table-cell">
                      {entry.winRate}%
                    </td>
                    <td className="hidden px-4 py-3 text-right md:table-cell">
                      {entry.streak > 0 ? (
                        <span className="text-orange-400">{entry.streak}</span>
                      ) : (
                        <span className="text-zinc-600">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-500">{entry.totalBattles}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
