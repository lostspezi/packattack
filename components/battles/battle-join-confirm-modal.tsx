"use client";

import { Swords, Users, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import type { BattleCardData } from "@/components/battles/battle-card";

interface BattleJoinConfirmModalProps {
  battle: BattleCardData;
  lang: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function BattleJoinConfirmModal({
  battle,
  lang,
  loading,
  onConfirm,
  onCancel,
}: BattleJoinConfirmModalProps) {
  const isDe = lang === "de";
  const boxName = isDe ? battle.box.name.de : battle.box.name.en;

  return (
    <Modal open onClose={onCancel} title={isDe ? "Battle beitreten" : "Join Battle"} size="sm">
      {/* Box + Fee */}
      <div className="flex flex-col items-center gap-3 rounded-xl bg-zinc-900 border border-zinc-800 p-5 mb-4">
        {battle.box.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={battle.box.image}
            alt={boxName}
            className="h-14 w-14 rounded-xl object-cover"
          />
        )}
        <div className="text-center">
          <div className="font-bold text-zinc-100">{boxName}</div>
          <div className="text-xs text-zinc-500">
            {battle.settings.rounds} {isDe ? "Runden" : "Rounds"} · <Users className="inline h-3 w-3" /> {battle.players.length}/{battle.settings.playerCount}
          </div>
        </div>
        <div className="text-2xl font-extrabold text-yellow-400">
          {battle.entryFee} Coins
        </div>
      </div>

      <p className="text-sm text-zinc-400 text-center mb-5">
        {isDe
          ? `Du bezahlst ${battle.entryFee} Coins um diesem Battle beizutreten.`
          : `You will pay ${battle.entryFee} Coins to join this battle.`}
      </p>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          disabled={loading}
          className="flex-1 rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-300 disabled:opacity-50"
        >
          {isDe ? "Abbrechen" : "Cancel"}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-yellow-400 px-4 py-2.5 text-sm font-bold text-black transition-all hover:bg-yellow-300 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Swords className="h-4 w-4" />
          )}
          {isDe ? "Beitreten" : "Join"}
        </button>
      </div>
    </Modal>
  );
}
