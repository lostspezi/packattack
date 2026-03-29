import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { BattleLeaderboard } from "@/components/battles/battle-leaderboard";

export default async function BattleLeaderboardPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale, "battles");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {dict.leaderboardTitle ?? "Leaderboard"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {dict.leaderboardSubtitle ?? "Top players ranked by ELO, wins, and streaks."}
        </p>
      </div>
      <BattleLeaderboard />
    </div>
  );
}
