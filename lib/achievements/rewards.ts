import { Types } from "mongoose";
import connectDB from "@/lib/db";
import User from "@/models/user";
import CoinTransaction from "@/models/coin-transaction";
import Achievement, {
  type AchievementReward,
  type IAchievement,
} from "@/models/achievement";
import { grantBadgeToUser } from "@/lib/badges";
import { invalidateUserEffects } from "./effects";

/**
 * Wendet eine einzelne Reward-Zeile auf den User an.
 *
 * - `coins`: $inc auf User.coins + CoinTransaction `achievement_reward`
 * - `grant_badge`: nutzt das bestehende Badge-System
 * - `convert_multiplier` / `unlock_box` / `cosmetic`: passiv — die Effekte
 *   werden beim nächsten `getUserEffects`-Aufruf zusammengerechnet; der
 *   Caller invalidiert den Cache einmal nach allen Rewards.
 *
 * Fehler einzelner Rewards werden geloggt und verschluckt, damit ein
 * kaputter Reward nicht den gesamten Unlock torpediert.
 */
export async function applyReward(
  userId: string | Types.ObjectId,
  reward: AchievementReward,
  achievementKey: string,
): Promise<void> {
  const idStr = userId.toString();
  try {
    switch (reward.type) {
      case "coins": {
        const amount = Number((reward.params as { amount?: unknown })?.amount);
        if (!Number.isFinite(amount) || amount <= 0) return;
        const rounded = Math.round(amount);
        await connectDB();
        await User.updateOne({ _id: idStr }, { $inc: { coins: rounded } });
        await CoinTransaction.create({
          userId: idStr,
          amount: rounded,
          type: "achievement_reward",
          reason: `achievement:${achievementKey}`,
        });
        break;
      }
      case "grant_badge": {
        const rawKey = (reward.params as { badgeKey?: unknown })?.badgeKey;
        const key = typeof rawKey === "string" ? rawKey.trim() : "";
        if (!key) return;
        await grantBadgeToUser({
          userId: idStr,
          badgeKey: key,
          awardReason: `achievement:${achievementKey}`,
        });
        break;
      }
      case "convert_multiplier":
      case "unlock_box":
      case "cosmetic":
        // passiv — getUserEffects liest aus
        break;
    }
  } catch (err) {
    console.error("[achievements applyReward]", reward.type, err);
  }
}

/**
 * Lädt das Achievement, wendet alle Rewards an und invalidiert den
 * Effekte-Cache. Aufruf direkt nach einem neuen Unlock.
 */
export async function applyRewardsForUnlock(
  userId: string | Types.ObjectId,
  achievementId: string | Types.ObjectId,
): Promise<void> {
  await connectDB();
  const achievement = await Achievement.findById(achievementId)
    .select("key rewards")
    .lean<Pick<IAchievement, "key" | "rewards"> | null>();
  if (!achievement) return;

  for (const reward of achievement.rewards ?? []) {
    await applyReward(userId, reward, achievement.key);
  }

  await invalidateUserEffects(userId);
}

export async function applyRewardsForUnlockByKey(
  userId: string | Types.ObjectId,
  achievementKey: string,
): Promise<void> {
  await connectDB();
  const achievement = await Achievement.findOne({ key: achievementKey })
    .select("_id")
    .lean<{ _id: Types.ObjectId } | null>();
  if (!achievement) return;
  await applyRewardsForUnlock(userId, achievement._id);
}
