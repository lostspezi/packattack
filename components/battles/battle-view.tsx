"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { BattleLobby } from "./battle-lobby";
import { BattleClash } from "./battle-clash";
import { BattleScoreboard } from "./battle-scoreboard";
import { BattlePodium } from "./battle-podium";
import { BattleDecide } from "./battle-decide";
import { BattlePresetChat } from "./battle-preset-chat";

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

interface RoundCard {
  player: string;
  card: { _id: string; name: string; image?: string };
  rarity: string;
  coinValue: number;
}

interface Round {
  roundIndex: number;
  cards: RoundCard[];
  winnerId: string | null;
  revealedAt: string | null;
}

interface Battle {
  _id: string;
  slug: string;
  status: "waiting" | "countdown" | "opening" | "clash" | "finished" | "cancelled";
  maxPlayers: number;
  packsPerPlayer: number;
  players: BattlePlayer[];
  rounds: Round[];
  currentRound: number;
  totalRounds: number;
  box: { name: Record<string, string>; image?: string };
  visibility: string;
}

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  messageKey: string;
  text: string;
  createdAt: string;
}

interface DistributedCard {
  pullId: string;
  card: { _id: string; name: string; image?: string };
  rarity: string;
  coinValue: number;
  conversionValue?: number;
  decided?: boolean;
  decision?: "claim" | "convert";
}

interface BattleViewProps {
  lang: string;
  slug: string;
  dict: Record<string, string>;
}

export function BattleView({ lang, slug, dict }: BattleViewProps) {
  const [battle, setBattle] = useState<Battle | null>(null);
  const [isPlayer, setIsPlayer] = useState(false);
  const [myCards, setMyCards] = useState<DistributedCard[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [placements, setPlacements] = useState<BattlePlayer[]>([]);
  const [eloChanges, setEloChanges] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const battleRef = useRef<Battle | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  battleRef.current = battle;

  const fetchBattle = useCallback(async () => {
    try {
      const res = await fetch(`/api/battles/${slug}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to load battle");
        return null;
      }
      const data = await res.json();
      setBattle(data.battle);
      setIsPlayer(data.isPlayer ?? false);
      if (data.myCards) setMyCards(data.myCards);
      return data.battle as Battle;
    } catch {
      setError("Failed to load battle");
      return null;
    }
  }, [slug]);

  const connectSSE = useCallback((battleId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`/api/battles/${battleId}/events`);
    eventSourceRef.current = es;

    es.addEventListener("sync", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.battle) setBattle(data.battle);
        if (typeof data.isPlayer === "boolean") setIsPlayer(data.isPlayer);
        if (data.spectatorCount !== undefined) setSpectatorCount(data.spectatorCount);
      } catch { /* ignore */ }
    });

    es.addEventListener("player_joined", (e) => {
      try {
        const data = JSON.parse(e.data);
        setBattle((prev) => {
          if (!prev) return prev;
          const alreadyIn = prev.players.some((p) => p.user._id === data.player?.user?._id);
          if (alreadyIn) return prev;
          return { ...prev, players: [...prev.players, data.player] };
        });
      } catch { /* ignore */ }
    });

    es.addEventListener("player_left", (e) => {
      try {
        const data = JSON.parse(e.data);
        setBattle((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            players: prev.players.filter((p) => p.user._id !== data.userId),
          };
        });
      } catch { /* ignore */ }
    });

    es.addEventListener("battle_start", (e) => {
      try {
        const data = JSON.parse(e.data);
        setBattle((prev) => prev ? { ...prev, status: "countdown", totalRounds: data.totalRounds ?? prev.totalRounds } : prev);
      } catch { /* ignore */ }
    });

    es.addEventListener("opening_complete", () => {
      setBattle((prev) => prev ? { ...prev, status: "opening" } : prev);
    });

    es.addEventListener("round_reveal", (e) => {
      try {
        const data = JSON.parse(e.data);
        setBattle((prev) => {
          if (!prev) return prev;
          const existingIdx = prev.rounds.findIndex((r) => r.roundIndex === data.roundIndex);
          const newRound: Round = {
            roundIndex: data.roundIndex,
            cards: data.cards ?? [],
            winnerId: null,
            revealedAt: new Date().toISOString(),
          };
          if (existingIdx >= 0) {
            const updated = [...prev.rounds];
            updated[existingIdx] = { ...updated[existingIdx], ...newRound };
            return { ...prev, rounds: updated, currentRound: data.roundIndex, status: "clash" };
          }
          return { ...prev, rounds: [...prev.rounds, newRound], currentRound: data.roundIndex, status: "clash" };
        });
      } catch { /* ignore */ }
    });

    es.addEventListener("round_result", (e) => {
      try {
        const data = JSON.parse(e.data);
        setBattle((prev) => {
          if (!prev) return prev;
          const updatedRounds = prev.rounds.map((r) =>
            r.roundIndex === data.roundIndex ? { ...r, winnerId: data.winnerId } : r
          );
          const scoresMap = data.scores as Record<string, number> | undefined;
          const updatedPlayers = prev.players.map((p) => {
            const newScore = scoresMap?.[p.user._id];
            return newScore !== undefined ? { ...p, score: newScore } : p;
          });
          return { ...prev, rounds: updatedRounds, players: updatedPlayers };
        });
      } catch { /* ignore */ }
    });

    es.addEventListener("battle_end", (e) => {
      try {
        const data = JSON.parse(e.data);
        setBattle((prev) => prev ? { ...prev, status: "finished" } : prev);
        if (data.placements) setPlacements(data.placements);
        if (data.eloChanges) setEloChanges(data.eloChanges);
      } catch { /* ignore */ }
    });

    es.addEventListener("distribution", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.cards) setMyCards(data.cards);
      } catch { /* ignore */ }
    });

    es.addEventListener("chat", (e) => {
      try {
        const data = JSON.parse(e.data);
        setChatMessages((prev) => [...prev.slice(-49), { id: Math.random().toString(36), ...data }]);
      } catch { /* ignore */ }
    });

    es.addEventListener("spectator_count", (e) => {
      try {
        const data = JSON.parse(e.data);
        setSpectatorCount(data.count ?? 0);
      } catch { /* ignore */ }
    });

    es.onerror = () => {
      // Browser will auto-reconnect for EventSource
    };

    return es;
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchBattle().then((b) => {
      if (!cancelled && b) {
        connectSSE(b._id);
        setLoading(false);
      } else if (!cancelled) {
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
      eventSourceRef.current?.close();
    };
  }, [fetchBattle, connectSSE]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-10 w-10 animate-spin text-text-secondary" />
      </div>
    );
  }

  if (error || !battle) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-32 text-center">
        <AlertCircle className="h-10 w-10 text-error" />
        <p className="text-text-secondary">{error || dict.battleNotFound || "Battle not found."}</p>
      </div>
    );
  }

  const scores = battle.players.reduce<Record<string, number>>((acc, p) => {
    acc[p.user._id] = p.score;
    return acc;
  }, {});

  const isWaiting = battle.status === "waiting" || battle.status === "countdown";
  const isClashing = battle.status === "opening" || battle.status === "clash";
  const isFinished = battle.status === "finished";

  return (
    <div className="flex gap-6">
      {/* Main content */}
      <div className="min-w-0 flex-1 space-y-6">
        {isWaiting && (
          <BattleLobby
            battle={battle}
            dict={dict}
            lang={lang}
            isPlayer={isPlayer}
            onJoin={() => fetchBattle()}
            onLeave={() => fetchBattle()}
          />
        )}

        {isClashing && (
          <BattleClash
            battle={battle}
            currentRound={battle.currentRound}
            rounds={battle.rounds}
            players={battle.players}
            dict={dict}
          />
        )}

        {isFinished && (
          <>
            <BattlePodium
              placements={placements.length > 0 ? placements : battle.players}
              eloChanges={eloChanges}
              dict={dict}
            />
            {isPlayer && myCards.length > 0 && (
              <BattleDecide
                battleId={battle._id}
                cards={myCards}
                dict={dict}
                lang={lang}
              />
            )}
          </>
        )}
      </div>

      {/* Sidebar */}
      <div className="hidden w-72 shrink-0 flex-col gap-4 lg:flex">
        {isClashing && (
          <BattleScoreboard players={battle.players} scores={scores} dict={dict} />
        )}
        <BattlePresetChat
          battleId={battle._id}
          messages={chatMessages}
          isPlayer={isPlayer}
          isSpectator={!isPlayer}
          dict={dict}
        />
      </div>
    </div>
  );
}
