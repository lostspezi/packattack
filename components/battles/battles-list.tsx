"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Swords, Loader2, Users, Coins, Plus, AlertCircle, Eye } from "lucide-react";
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
  eloRange?: { min: number; max: number } | null;
}

interface ActiveBattle {
  _id: string;
  slug: string;
}

interface BattlesListProps {
  lang: string;
  dict: Record<string, string>;
}

const LIVE_STATUSES = ["ready_check", "countdown", "opening", "clash"];

function getStatusStyle(status: string) {
  if (status === "waiting") return "border-pa-green/30 bg-pa-green/10 text-pa-green";
  if (LIVE_STATUSES.includes(status)) return "border-red-500/30 bg-red-500/10 text-red-400";
  return "border-border bg-white/5 text-text-secondary";
}

export function BattlesList({ lang, dict }: BattlesListProps) {
  const [battles, setBattles] = useState<Battle[]>([]);
  const [userElo, setUserElo] = useState<number>(800);
  const [activeBattle, setActiveBattle] = useState<ActiveBattle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let finished = 0;
    const done = () => {
      finished++;
      if (finished === 2) setLoading(false);
    };

    fetch("/api/battles?visibility=public")
      .then((res) => res.json())
      .then((data) => {
        setBattles(data.battles ?? []);
        if (typeof data.userElo === "number") setUserElo(data.userElo);
      })
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

  const waitingBattles = battles.filter((b) => b.status === "waiting");
  const liveBattles = battles.filter((b) => LIVE_STATUSES.includes(b.status));
  const hasAny = waitingBattles.length > 0 || liveBattles.length > 0;

  function renderBattleCard(battle: Battle) {
    const boxName =
      battle.box.name[lang] ??
      battle.box.name["en"] ??
      battle.box.name["de"] ??
      Object.values(battle.box.name)[0] ??
      "—";
    const playerCount = battle.players.length;
    const maxPlayers = battle.maxPlayers;
    const isFull = playerCount >= maxPlayers;
    const isLive = LIVE_STATUSES.includes(battle.status);

    const eloRange = battle.eloRange ?? null;
    const eloBelowMin = eloRange !== null && userElo < eloRange.min;
    const eloAboveMax = eloRange !== null && userElo > eloRange.max;
    const eloOutOfRange = eloBelowMin || eloAboveMax;
    let eloHint = "";
    if (eloBelowMin) eloHint = dict["eloTooLow"] ?? "Elo zu niedrig";
    if (eloAboveMax) eloHint = dict["eloTooHigh"] ?? "Elo zu hoch";

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
              {dict["by"] ?? "von"} {battle.createdBy?.username ?? battle.createdBy?.name ?? "—"}
            </p>
          </div>

          {/* Stats row */}
          <div className="mt-auto flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-sm text-text-secondary">
              <Users className="h-4 w-4 flex-shrink-0" />
              <span className={isFull ? "text-amber-400" : ""}>
                {playerCount}/{maxPlayers} {dict["players"] ?? "Spieler"}
              </span>
            </span>
            <span className="flex items-center gap-1.5 text-sm text-text-secondary">
              <Coins className="h-4 w-4 flex-shrink-0 text-pa-green" />
              <span className="text-pa-green font-medium">
                {battle.packsPerPlayer} {dict["packsLabel"] ?? "Packs"}
              </span>
            </span>
            {eloRange && (
              <span className={`ml-auto text-xs ${eloOutOfRange ? "text-amber-400" : "text-text-secondary"}`}>
                {dict["eloRange"] ?? "Elo"}: {eloRange.min}–{eloRange.max}
              </span>
            )}
          </div>

          {/* Status badge + action */}
          <div className="flex items-center justify-between">
            <span
              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${getStatusStyle(battle.status)}`}
            >
              {isLive && <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />}
              {dict[`status_${battle.status}`] ?? (isLive ? "Live" : battle.status)}
            </span>
            {eloOutOfRange && !isLive ? (
              <span className="text-[10px] font-semibold text-amber-400">{eloHint}</span>
            ) : (
              <Button
                variant={isLive ? "secondary" : "accent"}
                size="sm"
                className="pointer-events-none"
                disabled={!isLive && eloOutOfRange}
              >
                {isLive ? (
                  <>
                    <Eye className="h-3.5 w-3.5" />
                    {dict["spectate"] ?? "Zuschauen"}
                  </>
                ) : (
                  dict["join"] ?? "Beitreten"
                )}
              </Button>
            )}
          </div>
        </Card>
      </Link>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active battle banner */}
      {activeBattle && (
        <Card variant="topline" className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-pa-green" />
              <p className="text-sm font-medium text-text-primary">
                {dict["activeBattleBanner"] ?? "Du hast ein aktives Battle."}
              </p>
            </div>
            <Link href={`/${lang}/battles/${activeBattle.slug}`}>
              <Button variant="accent" size="sm">
                {dict["rejoin"] ?? "Zurückkehren"}
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Header row: Create button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          {hasAny
            ? `${waitingBattles.length} ${dict["openBattles"] ?? "offene Battles"} · ${liveBattles.length} ${dict["liveBattles"] ?? "laufende Battles"}`
            : ""}
        </p>
        <Link href={`/${lang}/battles/create`}>
          <Button variant="primary" size="sm">
            <Plus className="h-4 w-4" />
            {dict["createBattle"] ?? "Battle erstellen"}
          </Button>
        </Link>
      </div>

      {/* Live battles */}
      {liveBattles.length > 0 && (
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <span className="inline-block h-2 w-2 rounded-full bg-red-400 animate-pulse" />
            {dict["liveBattlesTitle"] ?? "Laufende Battles"}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {liveBattles.map(renderBattleCard)}
          </div>
        </div>
      )}

      {/* Open battles */}
      {waitingBattles.length > 0 && (
        <div className="space-y-3">
          {liveBattles.length > 0 && (
            <h3 className="text-sm font-semibold text-text-primary">
              {dict["openBattlesTitle"] ?? "Offene Battles"}
            </h3>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {waitingBattles.map(renderBattleCard)}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasAny && (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <Swords className="h-16 w-16 text-text-secondary opacity-40" />
          <p className="text-lg text-text-secondary">
            {dict["noBattles"] ?? "Keine Battles verfügbar."}
          </p>
          <Link href={`/${lang}/battles/create`}>
            <Button variant="accent" size="md">
              <Plus className="h-4 w-4" />
              {dict["createBattle"] ?? "Battle erstellen"}
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
