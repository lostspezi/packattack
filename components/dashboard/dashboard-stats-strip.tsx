import { Card } from "@/components/ui/card";
import { Coins, Package, Swords, Trophy } from "lucide-react";
import type { DashboardStats } from "@/lib/dashboard/stats";

interface DashboardStatsStripProps {
  stats: DashboardStats;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  variant?: "soft" | "topline" | "accent" | "cut";
}

function StatCard({ icon, label, value, hint, variant = "soft" }: StatCardProps) {
  return (
    <Card variant={variant} className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
            {label}
          </p>
          <p className="text-3xl font-bold text-text-primary">{value}</p>
          {hint && <p className="text-xs text-text-muted mt-1">{hint}</p>}
        </div>
        <div className="w-10 h-10 rounded-lg bg-pa-green/10 flex items-center justify-center shrink-0 text-pa-green">
          {icon}
        </div>
      </div>
    </Card>
  );
}

export function DashboardStatsStrip({ stats }: DashboardStatsStripProps) {
  const winRate =
    stats.battle.totalBattles > 0
      ? Math.round((stats.battle.wins / stats.battle.totalBattles) * 100)
      : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        variant="topline"
        icon={<Coins className="w-5 h-5" />}
        label="Coins"
        value={stats.coins.toLocaleString("de-DE")}
        hint="Im Wallet"
      />
      <StatCard
        icon={<Package className="w-5 h-5" />}
        label="Pulls"
        value={stats.pullsTotal.toLocaleString("de-DE")}
        hint={`+${stats.pullsThisWeek} diese Woche`}
      />
      <StatCard
        icon={<Swords className="w-5 h-5" />}
        label="Battles"
        value={`${stats.battle.wins} W / ${stats.battle.losses} L`}
        hint={`Elo ${stats.battle.elo} · ${winRate}% WR · Streak ${stats.battle.streak}`}
      />
      <StatCard
        variant="accent"
        icon={<Trophy className="w-5 h-5" />}
        label="Sammlung"
        value={stats.collectionScore.toLocaleString("de-DE")}
        hint="Coin-Wert deiner Pulls"
      />
    </div>
  );
}
