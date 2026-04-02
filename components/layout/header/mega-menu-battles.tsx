"use client";

import Link from "next/link";
import { Swords, User, Trophy } from "lucide-react";

interface MegaMenuBattlesProps {
  lang: string;
  dict: Record<string, string>;
  onClose: () => void;
}

export function MegaMenuBattles({ lang, dict, onClose }: MegaMenuBattlesProps) {
  return (
    <div className="grid grid-cols-3 gap-6">
      <Link
        href={`/${lang}/battles`}
        onClick={onClose}
        className="group flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-white/5"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pa-green/10">
          <Swords className="h-5 w-5 text-pa-green" />
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary group-hover:text-pa-green transition-colors">
            {dict["join_battle"] ?? "Battle beitreten"}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            {dict["join_battle_desc"] ?? "Offene Battles finden und mitmachen"}
          </p>
        </div>
      </Link>

      <Link
        href={`/${lang}/battles?filter=mine`}
        onClick={onClose}
        className="group flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-white/5"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
          <User className="h-5 w-5 text-purple-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary group-hover:text-purple-400 transition-colors">
            {dict["my_battles"] ?? "Meine Battles"}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            {dict["my_battles_desc"] ?? "Aktive und vergangene Battles"}
          </p>
        </div>
      </Link>

      <Link
        href={`/${lang}/leaderboard`}
        onClick={onClose}
        className="group flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-white/5"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
          <Trophy className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary group-hover:text-amber-400 transition-colors">
            {dict["leaderboard"] ?? "Bestenliste"}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            {dict["leaderboard_desc"] ?? "Top Spieler und Rankings"}
          </p>
        </div>
      </Link>
    </div>
  );
}
