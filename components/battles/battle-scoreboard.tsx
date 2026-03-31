"use client";

import React from "react";
import { GiCrossedSwords } from "react-icons/gi";

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
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/70">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <GiCrossedSwords className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            {isDe ? "Punkte" : "Score"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs font-bold text-zinc-300">{currentRound}</span>
          <span className="text-[10px] text-zinc-600">/ {totalRounds}</span>
        </div>
      </div>

      {/* Players */}
      <div className="p-2">
        {sorted.map((player, i) => {
          const isMe = player.userId === currentUserId;
          return (
            <div
              key={player.userId}
              className={`flex items-center justify-between rounded-lg px-3 py-1.5 ${
                isMe ? "bg-yellow-400/10" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-4 text-center text-[10px] font-bold text-zinc-600">{i + 1}</span>
                <span className={`text-sm ${isMe ? "font-bold text-yellow-400" : "text-zinc-300"}`}>
                  {player.username}
                </span>
              </div>
              <span className={`text-sm font-bold tabular-nums ${isMe ? "text-yellow-400" : "text-zinc-400"}`}>
                {player.roundsWon}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
