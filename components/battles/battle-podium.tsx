"use client";

import { Users } from "lucide-react";
import { Card } from "@/components/ui/card";

interface PlacementPlayer {
  user: {
    _id: string;
    name: string;
    username?: string;
    image?: string;
    elo?: number;
  };
  score: number;
  placement: number | null;
  eloChange: number | null;
  eloAtStart?: number;
}

interface BattlePodiumProps {
  placements: PlacementPlayer[];
  eloChanges: Record<string, number>;
  dict: Record<string, string>;
}

function PlayerAvatar({ player }: { player: PlacementPlayer }) {
  return player.user.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={player.user.image}
      alt={player.user.name}
      className="rounded-full object-cover"
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center rounded-full bg-pa-lila/30">
      <Users className="h-1/2 w-1/2 text-text-secondary" />
    </div>
  );
}

const PODIUM_ORDER = [1, 0, 2]; // 2nd, 1st, 3rd positions for visual layout
const PODIUM_HEIGHTS = ["h-20", "h-28", "h-14"];
const PODIUM_SIZES = ["w-14 h-14", "w-20 h-20", "w-12 h-12"];
const PODIUM_MEDALS = ["🥈", "🥇", "🥉"];

export function BattlePodium({ placements, eloChanges, dict }: BattlePodiumProps) {
  const sorted = [...placements].sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99));
  const top3 = [sorted[1], sorted[0], sorted[2]]; // 2nd | 1st | 3rd

  return (
    <div className="space-y-8">
      {/* Title */}
      <h2 className="text-2xl font-extrabold text-text-primary text-center">
        {dict["battleResults"] ?? "Battle-Ergebnisse"} 🏆
      </h2>

      {/* Podium */}
      {sorted.length >= 2 && (
        <div className="flex items-end justify-center gap-3">
          {PODIUM_ORDER.map((visualIdx) => {
            const player = top3[visualIdx];
            if (!player) return <div key={`empty-${visualIdx}`} className="w-24" />;
            const eloChange = eloChanges[player.user._id] ?? player.eloChange ?? 0;
            const eloColor = eloChange > 0 ? "text-pa-green" : eloChange < 0 ? "text-error" : "text-text-secondary";

            return (
              <div key={player.user._id} className="flex flex-col items-center gap-2">
                {/* Avatar */}
                <div className={[PODIUM_SIZES[visualIdx], "rounded-full overflow-hidden border-2",
                  visualIdx === 1 ? "border-yellow-400 shadow-[0_0_16px_4px_rgba(234,179,8,0.35)]"
                  : visualIdx === 0 ? "border-gray-400"
                  : "border-amber-700",
                ].join(" ")}>
                  <PlayerAvatar player={player} />
                </div>

                {/* Medal + name */}
                <div className="text-center">
                  <span className="text-2xl">{PODIUM_MEDALS[visualIdx]}</span>
                  <p className="text-xs font-semibold text-text-primary max-w-[80px] truncate">
                    {player.user.username ?? player.user.name}
                  </p>
                  <p className="text-xs text-text-secondary">{player.score} {dict["pts"] ?? "Pkt."}</p>
                  <p className={["text-xs font-bold", eloColor].join(" ")}>
                    {eloChange > 0 ? `+${eloChange}` : eloChange} ELO
                  </p>
                </div>

                {/* Podium block */}
                <div
                  className={[
                    PODIUM_HEIGHTS[visualIdx],
                    "w-20 rounded-t-[8px] flex items-center justify-center",
                    visualIdx === 1 ? "bg-yellow-400/20 border border-yellow-400/30"
                    : visualIdx === 0 ? "bg-gray-400/15 border border-gray-400/20"
                    : "bg-amber-700/15 border border-amber-700/20",
                  ].join(" ")}
                >
                  <span className="text-lg font-bold text-text-secondary">
                    {sorted.indexOf(player) + 1}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full ranking table */}
      {sorted.length > 3 && (
        <Card variant="soft" className="overflow-hidden">
          <div className="divide-y divide-border">
            {sorted.map((p, idx) => {
              const eloChange = eloChanges[p.user._id] ?? p.eloChange ?? 0;
              const eloColor = eloChange > 0 ? "text-pa-green" : eloChange < 0 ? "text-error" : "text-text-secondary";

              return (
                <div key={p.user._id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-6 shrink-0 text-center text-sm font-bold text-text-secondary">
                    #{idx + 1}
                  </span>
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full">
                    <PlayerAvatar player={p} />
                  </div>
                  <p className="flex-1 truncate text-sm font-semibold text-text-primary">
                    {p.user.username ?? p.user.name}
                  </p>
                  <span className="text-sm text-text-secondary">{p.score} {dict["pts"] ?? "Pkt."}</span>
                  <span className={["text-sm font-bold", eloColor].join(" ")}>
                    {eloChange > 0 ? `+${eloChange}` : eloChange}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
