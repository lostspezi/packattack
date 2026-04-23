"use client";

import React, { useState, useEffect } from "react";
import { Users, Clock, Swords, LogIn, ArrowDownToLine, ArrowUpToLine } from "lucide-react";

interface BattleCardPlayer {
  user: { _id: string; username: string };
}

interface BattleCardBox {
  _id: string;
  name: { de: string; en: string };
  slug: string;
  game: string;
  image: string | null;
}

export interface BattleCardData {
  _id: string;
  slug: string;
  status: string;
  creator: { _id: string; username: string };
  box: BattleCardBox;
  players: BattleCardPlayer[];
  settings: {
    playerCount: number;
    rounds: number;
    mode: string;
    isPrivate: boolean;
  };
  entryFee: number;
  lobbyExpiresAt: string;
  createdAt: string;
}

interface BattleCardProps {
  battle: BattleCardData;
  lang: string;
  currentUserId: string;
  onJoin: (battleId: string) => void;
  joining?: boolean;
}

const MODE_LABELS: Record<string, { de: string; en: string; icon: React.ReactNode }> = {
  lowest_card: { de: "Niedrigste Karte", en: "Lowest Card", icon: <ArrowDownToLine className="inline h-3.5 w-3.5 text-blue-400" /> },
  highest_card: { de: "Höchste Karte", en: "Highest Card", icon: <ArrowUpToLine className="inline h-3.5 w-3.5 text-orange-400" /> },
};

function TimeRemaining({ expiresAt, lang }: { expiresAt: string; lang: string }) {
  const isDe = lang === "de";
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, new Date(expiresAt).getTime() - Date.now()),
  );

  useEffect(() => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return;
    const interval = setInterval(() => {
      const left = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      setRemaining(left);
      if (left <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  if (remaining <= 0) {
    return <span className="text-red-400">{isDe ? "Abgelaufen" : "Expired"}</span>;
  }

  return (
    <span className="text-zinc-400">
      {minutes}:{seconds.toString().padStart(2, "0")}
    </span>
  );
}

export function BattleCard({ battle, lang, currentUserId, onJoin, joining }: BattleCardProps) {
  const isDe = lang === "de";
  const modeInfo = MODE_LABELS[battle.settings.mode] ?? MODE_LABELS.lowest_card;
  const isInBattle = battle.players.some((p) => String(p.user._id) === currentUserId);
  const isFull = battle.players.length >= battle.settings.playerCount;

  const [isExpired, setIsExpired] = useState(
    () => new Date(battle.lobbyExpiresAt).getTime() <= Date.now(),
  );
  useEffect(() => {
    if (isExpired) return;
    const ms = Math.max(0, new Date(battle.lobbyExpiresAt).getTime() - Date.now());
    const timer = setTimeout(() => setIsExpired(true), ms);
    return () => clearTimeout(timer);
  }, [battle.lobbyExpiresAt, isExpired]);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-all hover:border-zinc-700">
      {/* Header: Box + Creator */}
      <div className="flex items-center gap-3">
        {battle.box.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={battle.box.image}
            alt={isDe ? battle.box.name.de : battle.box.name.en}
            className="h-10 w-10 rounded-lg object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold text-zinc-100">
            {isDe ? battle.box.name.de : battle.box.name.en}
          </div>
          <div className="text-xs text-zinc-500">
            {isDe ? "von" : "by"} {battle.creator.username}
          </div>
        </div>
        <span className="shrink-0 rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-400">
          {battle.box.game}
        </span>
      </div>

      {/* Stats Row */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {battle.players.length}/{battle.settings.playerCount}
        </span>
        <span>
          {battle.settings.rounds} {isDe ? "Runden" : "Rounds"}
        </span>
        <span className="flex items-center gap-1">
          {modeInfo.icon} {isDe ? modeInfo.de : modeInfo.en}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          <TimeRemaining expiresAt={battle.lobbyExpiresAt} lang={lang} />
        </span>
      </div>

      {/* Fee + Action */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-yellow-400">
          {battle.entryFee} Coins
        </span>

        {isInBattle ? (
          <button
            onClick={() => onJoin(battle.slug)}
            className="flex items-center gap-1.5 rounded-lg bg-yellow-400/10 px-4 py-2 text-sm font-bold text-yellow-400 transition-all hover:bg-yellow-400/20"
          >
            <Swords className="h-4 w-4" />
            {isDe ? "Zurückkehren" : "Return"}
          </button>
        ) : isExpired ? (
          <span className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-bold text-zinc-500">
            {isDe ? "Abgelaufen" : "Expired"}
          </span>
        ) : isFull ? (
          <span className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-bold text-zinc-500">
            {isDe ? "Voll" : "Full"}
          </span>
        ) : (
          <button
            onClick={() => onJoin(battle._id)}
            disabled={joining}
            className="flex items-center gap-1.5 rounded-lg bg-yellow-400 px-4 py-2 text-sm font-bold text-black transition-all hover:bg-yellow-300 disabled:opacity-50"
          >
            <LogIn className="h-4 w-4" />
            {isDe ? "Beitreten" : "Join"}
          </button>
        )}
      </div>
    </div>
  );
}
