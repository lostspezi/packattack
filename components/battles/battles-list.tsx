"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Swords, Loader2, Users, Coins, Plus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface BattlePlayer {
  user: {
    name: string;
    image?: string;
  };
}

interface Battle {
  _id: string;
  slug: string;
  box: {
    name: { de?: string; en?: string; [key: string]: string | undefined };
    image?: string;
  };
  packsPerPlayer: number;
  maxPlayers: number;
  status: string;
  visibility: string;
  players: BattlePlayer[];
  createdBy: {
    name: string;
    username?: string;
  };
}

interface ActiveBattle {
  _id: string;
  slug: string;
}

interface BattlesListProps {
  lang: string;
  dict: Record<string, string>;
}

export function BattlesList({ lang, dict }: BattlesListProps) {
  const [battles, setBattles] = useState<Battle[]>([]);
  const [activeBattle, setActiveBattle] = useState<ActiveBattle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let finished = 0;
    const done = () => {
      finished++;
      if (finished === 2) setLoading(false);
    };

    fetch("/api/battles?status=waiting&visibility=public")
      .then((res) => res.json())
      .then((data) => setBattles(data.battles ?? []))
      .catch(() => setBattles([]))
      .finally(done);

    fetch("/api/battles/active")
      .then((res) => res.json())
      .then((data) => setActiveBattle(data.battle ?? null))
      .catch(() => setActiveBattle(null))
      .finally(done);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-text-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Active battle banner */}
      {activeBattle && (
        <Card variant="topline" className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-pa-green" />
              <p className="text-sm font-medium text-text-primary">
                {dict.activeBattleBanner || "You have an active battle in progress."}
              </p>
            </div>
            <Link href={`/${lang}/battles/${activeBattle.slug}`}>
              <Button variant="accent" size="sm">
                {dict.rejoin || "Rejoin"}
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Header row: Create button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          {battles.length > 0
            ? `${battles.length} ${dict.openBattles || "open battles"}`
            : ""}
        </p>
        <Link href={`/${lang}/battles/create`}>
          <Button variant="primary" size="sm">
            <Plus className="h-4 w-4" />
            {dict.createBattle || "Create Battle"}
          </Button>
        </Link>
      </div>

      {/* Battle cards */}
      {battles.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <Swords className="h-16 w-16 text-text-secondary opacity-40" />
          <p className="text-lg text-text-secondary">
            {dict.noBattles || "No open battles right now."}
          </p>
          <Link href={`/${lang}/battles/create`}>
            <Button variant="accent" size="md">
              <Plus className="h-4 w-4" />
              {dict.createBattle || "Create Battle"}
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {battles.map((battle) => {
            const boxName =
              battle.box.name[lang] ??
              battle.box.name["en"] ??
              battle.box.name["de"] ??
              Object.values(battle.box.name)[0] ??
              "—";
            const playerCount = battle.players.length;
            const maxPlayers = battle.maxPlayers;
            const isFull = playerCount >= maxPlayers;
            const cost = battle.packsPerPlayer;

            return (
              <Link
                key={battle._id}
                href={`/${lang}/battles/${battle.slug}`}
                className="block"
              >
                <Card
                  variant="soft"
                  className="flex h-full flex-col gap-3 p-4 transition-colors hover:bg-white/5"
                >
                  {/* Box name */}
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-text-primary">
                      {boxName}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-text-secondary">
                      {dict.by || "by"} {battle.createdBy?.username ?? battle.createdBy?.name ?? "—"}
                    </p>
                  </div>

                  {/* Stats row */}
                  <div className="mt-auto flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-sm text-text-secondary">
                      <Users className="h-4 w-4 flex-shrink-0" />
                      <span className={isFull ? "text-amber-400" : ""}>
                        {playerCount}/{maxPlayers} {dict.players || "players"}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5 text-sm text-text-secondary">
                      <Coins className="h-4 w-4 flex-shrink-0 text-pa-green" />
                      <span className="text-pa-green font-medium">
                        {cost} {dict.packsLabel || "packs"}
                      </span>
                    </span>
                  </div>

                  {/* Status badge */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                        battle.status === "waiting"
                          ? "border-pa-green/30 bg-pa-green/10 text-pa-green"
                          : "border-border bg-white/5 text-text-secondary"
                      }`}
                    >
                      {battle.status}
                    </span>
                    <Button variant="accent" size="sm" className="pointer-events-none">
                      {dict.join || "Join"}
                    </Button>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
