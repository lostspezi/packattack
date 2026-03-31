"use client";

import React from "react";

interface ScoreboardPlayer {
  userId: string;
  username: string;
  roundsWon: number;
}

interface BattleScoreboardProps {
  players: ScoreboardPlayer[];
  currentRound: number;
  totalRounds: number;
  currentUserId: string;
  lang: string;
}

export function BattleScoreboard({
  players,
  currentRound,
  totalRounds,
  currentUserId,
  lang,
}: BattleScoreboardProps) {
  const isDe = lang === "de";
  const sorted = [...players].sort((a, b) => b.roundsWon - a.roundsWon);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {isDe ? "Punktestand" : "Scoreboard"}
        </span>
        <span className="text-xs text-zinc-600">
          {isDe ? "Runde" : "Round"} {currentRound}/{totalRounds}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {sorted.map((player, i) => {
          const isMe = player.userId === currentUserId;
          return (
            <div
              key={player.userId}
              className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm ${
                isMe ? "bg-yellow-400/10" : "bg-zinc-800/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-4 text-center text-xs text-zinc-600">{i + 1}</span>
                <span className={isMe ? "font-bold text-yellow-400" : "text-zinc-300"}>
                  {player.username}
                </span>
              </div>
              <span className={`font-bold ${isMe ? "text-yellow-400" : "text-zinc-300"}`}>
                {player.roundsWon}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
