"use client";

import React, { useState, useEffect } from "react";
import { Users, Clock, Copy, Check, Crown } from "lucide-react";

interface Player {
  user: { _id: string; username: string; elo?: number };
  isReady: boolean;
}

interface BattleWaitingProps {
  battle: {
    _id: string;
    slug: string;
    status: string;
    creator: { _id: string; username: string };
    players: Player[];
    settings: {
      playerCount: number;
      rounds: number;
      mode: string;
      isPrivate: boolean;
      inviteCode: string | null;
    };
    entryFee: number;
    lobbyExpiresAt: string;
    readyCheckExpiresAt: string | null;
  };
  currentUserId: string;
  lang: string;
  onReady: () => void;
  onLeave: () => void;
  onStart: () => void;
  onJoin?: () => void;
  readying?: boolean;
  joining?: boolean;
}

const MODE_LABELS: Record<string, { de: string; en: string }> = {
  lowest_card: { de: "Niedrigste Karte", en: "Lowest Card" },
  highest_card: { de: "Höchste Karte", en: "Highest Card" },
  all_cards: { de: "Alle Karten", en: "All Cards" },
};

export function BattleWaiting({
  battle,
  currentUserId,
  lang,
  onReady,
  onLeave,
  onStart,
  onJoin,
  readying,
  joining,
}: BattleWaitingProps) {
  const isDe = lang === "de";
  const isCreator = battle.creator._id === currentUserId;
  const myPlayer = battle.players.find((p) => p.user._id === currentUserId);
  const allReady = battle.players.every((p) => p.isReady);
  const [copied, setCopied] = useState(false);

  // Ready check timer
  const [readyTimeLeft, setReadyTimeLeft] = useState(0);
  useEffect(() => {
    if (battle.status !== "ready_check" || !battle.readyCheckExpiresAt) return;
    const interval = setInterval(() => {
      const left = Math.max(0, new Date(battle.readyCheckExpiresAt!).getTime() - Date.now());
      setReadyTimeLeft(left);
    }, 1000);
    return () => clearInterval(interval);
  }, [battle.status, battle.readyCheckExpiresAt]);

  // Lobby expiry timer
  const [lobbyTimeLeft, setLobbyTimeLeft] = useState(0);
  useEffect(() => {
    if (battle.status !== "waiting") return;
    const interval = setInterval(() => {
      const left = Math.max(0, new Date(battle.lobbyExpiresAt).getTime() - Date.now());
      setLobbyTimeLeft(left);
    }, 1000);
    return () => clearInterval(interval);
  }, [battle.status, battle.lobbyExpiresAt]);

  function copyInviteCode() {
    if (!battle.settings.inviteCode) return;
    navigator.clipboard.writeText(battle.settings.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const lobbyMinutes = Math.floor(lobbyTimeLeft / 60000);
  const lobbySeconds = Math.floor((lobbyTimeLeft % 60000) / 1000);
  const readySeconds = Math.ceil(readyTimeLeft / 1000);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 px-4 py-8">
      {/* Status Header */}
      <div className="text-center">
        <h1 className="mb-2 text-2xl font-bold text-zinc-100">
          {battle.status === "waiting"
            ? isDe ? "Warte auf Spieler..." : "Waiting for players..."
            : battle.status === "ready_check"
              ? isDe ? "Bereit-Check!" : "Ready Check!"
              : battle.status === "countdown"
                ? isDe ? "Battle startet gleich..." : "Battle starting soon..."
                : ""}
        </h1>
        {battle.status === "waiting" && (
          <div className="flex items-center justify-center gap-2 text-sm text-zinc-500">
            <Clock className="h-4 w-4" />
            {lobbyMinutes}:{lobbySeconds.toString().padStart(2, "0")} {isDe ? "verbleibend" : "remaining"}
          </div>
        )}
        {battle.status === "ready_check" && (
          <div className="mt-2 text-3xl font-bold text-yellow-400">
            {readySeconds}s
          </div>
        )}
      </div>

      {/* Battle Info */}
      <div className="flex flex-wrap justify-center gap-3 text-xs text-zinc-400">
        <span>{battle.settings.rounds} {isDe ? "Runden" : "Rounds"}</span>
        <span className="text-zinc-600">|</span>
        <span>{isDe ? MODE_LABELS[battle.settings.mode]?.de : MODE_LABELS[battle.settings.mode]?.en}</span>
        <span className="text-zinc-600">|</span>
        <span className="text-yellow-400">{battle.entryFee} Coins</span>
      </div>

      {/* Private Invite Code */}
      {battle.settings.isPrivate && battle.settings.inviteCode && isCreator && (
        <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2">
          <span className="text-xs text-zinc-500">{isDe ? "Einladungscode:" : "Invite Code:"}</span>
          <span className="font-mono text-sm font-bold text-yellow-400">{battle.settings.inviteCode}</span>
          <button onClick={copyInviteCode} className="text-zinc-400 hover:text-zinc-200">
            {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      )}

      {/* Player Slots */}
      <div className="grid w-full gap-3" style={{ gridTemplateColumns: `repeat(${battle.settings.playerCount}, minmax(0, 1fr))` }}>
        {Array.from({ length: battle.settings.playerCount }).map((_, i) => {
          const player = battle.players[i];
          if (!player) {
            return (
              <div
                key={i}
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-800 p-6"
              >
                <Users className="mb-2 h-8 w-8 text-zinc-700" />
                <span className="text-xs text-zinc-600">{isDe ? "Leer" : "Empty"}</span>
              </div>
            );
          }

          const isMe = player.user._id === currentUserId;
          const isPlayerCreator = player.user._id === battle.creator._id;

          return (
            <div
              key={player.user._id}
              className={`flex flex-col items-center rounded-xl border-2 p-6 transition-all ${
                player.isReady
                  ? "border-green-500/50 bg-green-500/5"
                  : isMe
                    ? "border-yellow-400/50 bg-yellow-400/5"
                    : "border-zinc-700 bg-zinc-900"
              }`}
            >
              {isPlayerCreator && (
                <Crown className="mb-1 h-4 w-4 text-yellow-400" />
              )}
              <div className={`text-sm font-bold ${isMe ? "text-yellow-400" : "text-zinc-200"}`}>
                {player.user.username}
              </div>
              {player.user.elo !== undefined && (
                <div className="text-[10px] text-zinc-500">ELO {player.user.elo}</div>
              )}
              <div className={`mt-2 rounded-full px-3 py-0.5 text-[10px] font-bold uppercase ${
                player.isReady
                  ? "bg-green-500/20 text-green-400"
                  : "bg-zinc-800 text-zinc-500"
              }`}>
                {player.isReady
                  ? isDe ? "Bereit" : "Ready"
                  : isDe ? "Nicht bereit" : "Not Ready"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        {/* Join button for non-participants */}
        {!myPlayer && battle.status === "waiting" && battle.players.length < battle.settings.playerCount && onJoin && (
          <button
            onClick={onJoin}
            disabled={joining}
            className="rounded-xl bg-yellow-400 px-8 py-3 font-bold text-black transition-all hover:bg-yellow-300 disabled:opacity-50"
          >
            {joining
              ? isDe ? "Trete bei..." : "Joining..."
              : isDe ? `Beitreten (${battle.entryFee} Coins)` : `Join Battle (${battle.entryFee} Coins)`}
          </button>
        )}

        {battle.status === "ready_check" && myPlayer && !myPlayer.isReady && (
          <button
            onClick={onReady}
            disabled={readying}
            className="rounded-xl bg-green-500 px-8 py-3 font-bold text-white transition-all hover:bg-green-400 disabled:opacity-50"
          >
            {isDe ? "Bereit!" : "Ready!"}
          </button>
        )}

        {battle.status === "countdown" && isCreator && allReady && (
          <button
            onClick={onStart}
            className="rounded-xl bg-yellow-400 px-8 py-3 font-bold text-black transition-all hover:bg-yellow-300"
          >
            {isDe ? "Battle starten!" : "Start Battle!"}
          </button>
        )}

        {myPlayer && (battle.status === "waiting" || battle.status === "ready_check" || battle.status === "countdown") && (
          <button
            onClick={onLeave}
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-6 py-3 text-sm font-bold text-red-400 transition-all hover:border-red-500/50 hover:bg-red-500/20"
          >
            {isCreator
              ? isDe ? "Battle abbrechen" : "Cancel Battle"
              : isDe ? "Verlassen" : "Leave"}
          </button>
        )}
      </div>
    </div>
  );
}
