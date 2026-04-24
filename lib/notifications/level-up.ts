import connectDB from "@/lib/db";
import Notification from "@/models/notification";
import { sendPushToUser } from "@/lib/push/web-push";
import type { AchievementUnlockOutcome } from "@/lib/achievements/engine";

export interface LevelUpNotifyInput {
  userId: string;
  oldLevel: number;
  newLevel: number;
  isMilestone: boolean;
  unlockedAchievements: AchievementUnlockOutcome[];
}

/**
 * Schreibt eine DB-Notification (immer), sendet Push nur bei Milestones.
 * Toasts und Level-Up-Modal werden clientseitig getriggert, wenn die
 * Notification-Liste erneut geholt wird (siehe `/api/me/notifications/level-up`).
 */
export async function notifyLevelUp(input: LevelUpNotifyInput): Promise<void> {
  if (input.newLevel <= input.oldLevel) return;

  await connectDB();

  const title = `Level ${input.newLevel} erreicht`;
  const achievementsHint =
    input.unlockedAchievements.length > 0
      ? ` · ${input.unlockedAchievements.length} neue Belohnung${input.unlockedAchievements.length > 1 ? "en" : ""}`
      : "";
  const message = `Du bist jetzt auf Level ${input.newLevel}.${achievementsHint}`;

  try {
    await Notification.create({
      userId: input.userId,
      title,
      message,
      type: "success",
      category: "achievement",
      entityType: "level",
      entityId: String(input.newLevel),
      cta: { label: "Zum Profil", url: "/profile/achievements" },
      meta: {
        kind: "level_up",
        oldLevel: input.oldLevel,
        newLevel: input.newLevel,
        isMilestone: input.isMilestone,
        unlockedCount: input.unlockedAchievements.length,
      },
    });
  } catch (err) {
    console.error("[notifications level-up db]", err);
  }

  if (input.isMilestone) {
    try {
      await sendPushToUser(input.userId, {
        title,
        body: message,
        url: "/profile/achievements",
      });
    } catch (err) {
      console.error("[notifications level-up push]", err);
    }
  }
}

export interface AchievementUnlockNotifyInput {
  userId: string;
  achievementKey: string;
  titleKey: string;
}

export async function notifyAchievementUnlock(input: AchievementUnlockNotifyInput): Promise<void> {
  await connectDB();
  try {
    await Notification.create({
      userId: input.userId,
      title: "Neues Achievement freigeschaltet",
      message: input.achievementKey,
      type: "success",
      category: "achievement",
      entityType: "achievement",
      entityId: input.achievementKey,
      cta: { label: "Zum Profil", url: "/profile/achievements" },
      meta: {
        kind: "achievement_unlock",
        achievementKey: input.achievementKey,
        titleKey: input.titleKey,
      },
    });
  } catch (err) {
    console.error("[notifications achievement-unlock db]", err);
  }
}
