import User from "@/models/user";
import BattleAchievement from "@/models/battle-achievement";
import { BATTLE_ACHIEVEMENTS } from "./battle-constants";
import { getEloRank } from "./battle-elo";

interface AchievementContext {
  userId: string;
  battleId: string;
  placement: number;
  eloAfter: number;
  opponentMaxElo: number;
  longestRoundStreak: number;
  hadUltraRare: boolean;
}

/**
 * Check and award achievements after a battle finishes.
 * Idempotent — won't duplicate achievements.
 */
export async function checkAndAwardAchievements(ctx: AchievementContext): Promise<string[]> {
  const awarded: string[] = [];
  const user = await User.findById(ctx.userId).select("battleStats badges").lean();
  if (!user) return awarded;

  const stats = (user as any).battleStats ?? { wins: 0, losses: 0, streak: 0, bestStreak: 0, totalBattles: 0, battlesCreated: 0 };
  const existing = await BattleAchievement.find({ user: ctx.userId }).select("key").lean();
  const existingKeys = new Set(existing.map((a) => a.key));

  const checks: Array<{ key: string; condition: () => boolean }> = [
    { key: "first_clash", condition: () => stats.totalBattles >= 1 },
    { key: "win_streak_3", condition: () => stats.streak >= 3 },
    { key: "underdog", condition: () => ctx.placement === 1 && ctx.opponentMaxElo - (ctx.eloAfter - 0) >= 200 },
    { key: "sharpshooter", condition: () => ctx.longestRoundStreak >= 10 },
    { key: "champion_rank", condition: () => getEloRank(ctx.eloAfter).key === "champion" },
    { key: "veteran", condition: () => stats.totalBattles >= 100 },
    { key: "jackpot", condition: () => ctx.hadUltraRare },
    { key: "host_10", condition: () => stats.battlesCreated >= 10 },
  ];

  for (const check of checks) {
    if (existingKeys.has(check.key)) continue;
    if (!check.condition()) continue;

    const achDef = BATTLE_ACHIEVEMENTS.find((a) => a.key === check.key);
    if (!achDef) continue;

    try {
      await BattleAchievement.create({
        user: ctx.userId,
        key: check.key,
        battle: ctx.battleId,
      });

      // Award badge on user profile
      await User.updateOne(
        { _id: ctx.userId, "badges.key": { $ne: check.key } },
        {
          $push: {
            badges: {
              key: check.key,
              label: achDef.label.en,
              active: true,
              tone: achDef.tone,
              awardedAt: new Date(),
              expiresAt: null,
              sortOrder: 100,
            },
          },
        }
      );

      awarded.push(check.key);
    } catch {
      // Duplicate key — already exists, ignore
    }
  }

  return awarded;
}
