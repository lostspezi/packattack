import { Types } from "mongoose";
import connectDB from "@/lib/db";
import User from "@/models/user";
import { grantXp } from "@/lib/level/grant-xp";
import { dayKey, isConsecutiveDay, XP_RATES } from "@/lib/level/xp-rates";
import { incrementCounter } from "@/lib/level/grant-xp";
import type { AchievementUnlockOutcome } from "@/lib/achievements/engine";

export interface LoginStreakResult {
  currentStreak: number;
  bestStreak: number;
  xpGained: number;
  alreadyTrackedToday: boolean;
  bonusAwarded: boolean;
  unlockedAchievements: AchievementUnlockOutcome[];
}

/**
 * Idempotent pro Tag: Ruft der jwt-Callback diese Funktion bei jedem
 * Token-Refresh auf, passiert nichts, wenn `lastLoginDay` schon auf heute
 * steht. Beim echten ersten Login des Tages:
 *   - current += 1 wenn gestern auch eingeloggt, sonst = 1
 *   - best ggf. updaten
 *   - grantXp(LOGIN_DAILY) + Bonus bei Streak-Multiplen von 7
 *   - loginDays-Counter +1 + checkCounterAchievements
 */
export async function trackLoginStreak(
  userId: string | Types.ObjectId,
  now: Date = new Date(),
): Promise<LoginStreakResult | null> {
  if (!userId) return null;
  const objectId =
    userId instanceof Types.ObjectId
      ? userId
      : Types.ObjectId.isValid(userId)
        ? new Types.ObjectId(userId)
        : null;
  if (!objectId) return null;

  await connectDB();

  const today = dayKey(now);

  const user = await User.findById(objectId)
    .select("stats.loginStreak")
    .lean<{ stats?: { loginStreak?: { current?: number; best?: number; lastLoginDay?: string | null } } }>();

  if (!user) return null;

  const last = user.stats?.loginStreak?.lastLoginDay ?? null;
  if (last === today) {
    return {
      currentStreak: user.stats?.loginStreak?.current ?? 0,
      bestStreak: user.stats?.loginStreak?.best ?? 0,
      xpGained: 0,
      alreadyTrackedToday: true,
      bonusAwarded: false,
      unlockedAchievements: [],
    };
  }

  const prevCurrent = user.stats?.loginStreak?.current ?? 0;
  const nextCurrent = isConsecutiveDay(last, today) ? prevCurrent + 1 : 1;
  const prevBest = user.stats?.loginStreak?.best ?? 0;
  const nextBest = Math.max(prevBest, nextCurrent);

  // CAS: nur schreiben, wenn lastLoginDay noch nicht auf today steht
  // (verhindert, dass parallele Token-Refreshs den Bonus verdoppeln).
  const claim = await User.updateOne(
    {
      _id: objectId,
      $or: [
        { "stats.loginStreak.lastLoginDay": { $ne: today } },
        { "stats.loginStreak.lastLoginDay": null },
      ],
    },
    {
      $set: {
        "stats.loginStreak.current": nextCurrent,
        "stats.loginStreak.best": nextBest,
        "stats.loginStreak.lastLoginDay": today,
      },
    },
  );

  if (claim.modifiedCount === 0) {
    return {
      currentStreak: prevCurrent,
      bestStreak: prevBest,
      xpGained: 0,
      alreadyTrackedToday: true,
      bonusAwarded: false,
      unlockedAchievements: [],
    };
  }

  const bonusAwarded =
    nextCurrent > 0 && nextCurrent % XP_RATES.LOGIN_STREAK_BONUS_DAYS === 0;
  const xpToGrant = XP_RATES.LOGIN_DAILY + (bonusAwarded ? XP_RATES.LOGIN_STREAK_BONUS_XP : 0);

  const xpResult = await grantXp(objectId, xpToGrant, "login_streak");
  const bump = await incrementCounter(objectId, "loginDays", 1);

  return {
    currentStreak: nextCurrent,
    bestStreak: nextBest,
    xpGained: xpResult?.newXp != null && xpResult?.oldXp != null ? xpResult.newXp - xpResult.oldXp : 0,
    alreadyTrackedToday: false,
    bonusAwarded,
    unlockedAchievements: [
      ...(xpResult?.unlockedAchievements ?? []),
      ...(bump?.unlockedAchievements ?? []),
    ],
  };
}
