import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ArrowRight, Coins, Package, Swords } from "lucide-react";
import type { DashboardStats } from "@/lib/dashboard/stats";

interface DashboardStatsStripProps {
  lang: string;
  stats: DashboardStats;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  ctaLabel: string;
  ctaHref: string;
  variant?: "soft" | "topline" | "accent" | "cut";
}

function StatCard({
  icon,
  label,
  value,
  hint,
  ctaLabel,
  ctaHref,
  variant = "soft",
}: StatCardProps) {
  return (
    <Link
      href={ctaHref}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-pa-green/40 rounded-[14px]"
    >
      <Card
        variant={variant}
        className="p-5 h-full transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_0_24px_-8px_rgba(155,255,0,0.35)] cursor-pointer"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
              {label}
            </p>
            <p className="text-3xl font-bold text-text-primary">{value}</p>
            {hint && <p className="text-xs text-text-muted mt-1">{hint}</p>}
          </div>
          <div className="w-10 h-10 rounded-lg bg-pa-green/10 flex items-center justify-center shrink-0 text-pa-green transition-colors group-hover:bg-pa-green/20">
            {icon}
          </div>
        </div>
        <p className="text-pa-green text-sm font-medium inline-flex items-center gap-1">
          {ctaLabel}
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </p>
      </Card>
    </Link>
  );
}

export function DashboardStatsStrip({ lang, stats }: DashboardStatsStripProps) {
  const winRate =
    stats.battle.totalBattles > 0
      ? Math.round((stats.battle.wins / stats.battle.totalBattles) * 100)
      : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatCard
        variant="topline"
        icon={<Coins className="w-5 h-5" />}
        label="Coins"
        value={stats.coins.toLocaleString("de-DE")}
        hint="Im Wallet"
        ctaLabel="Coins kaufen"
        ctaHref={`/${lang}/balance`}
      />
      <StatCard
        icon={<Package className="w-5 h-5" />}
        label="Pulls"
        value={stats.pullsTotal.toLocaleString("de-DE")}
        hint={`+${stats.pullsThisWeek} diese Woche`}
        ctaLabel="Pack öffnen"
        ctaHref={`/${lang}/packs`}
      />
      <StatCard
        icon={<Swords className="w-5 h-5" />}
        label="Battles"
        value={`${stats.battle.wins} W / ${stats.battle.losses} L`}
        hint={`Prestige ${stats.battle.elo} · ${winRate}% WR · Streak ${stats.battle.streak}`}
        ctaLabel="In den Kampf"
        ctaHref={`/${lang}/battles`}
      />
    </div>
  );
}
