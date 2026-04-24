import { Types } from "mongoose";
import connectDB from "@/lib/db";
import Achievement, {
  type AchievementCounterMetric,
  type AchievementOnceEvent,
  type IAchievement,
} from "@/models/achievement";
import UserAchievement from "@/models/user-achievement";

export interface AchievementUnlockOutcome {
  userId: string;
  achievementId: string;
  achievementKey: string;
  wasNewUnlock: boolean;
  completedAt: Date;
}

function coerceObjectId(id: string | Types.ObjectId): Types.ObjectId | null {
  if (id instanceof Types.ObjectId) return id;
  if (typeof id === "string" && Types.ObjectId.isValid(id)) {
    return new Types.ObjectId(id);
  }
  return null;
}

/**
 * Upsert + Unlock eines Achievements für einen User.
 *
 * Idempotent: Wenn der Eintrag bereits `completed=true` ist, gibt die Funktion
 * `wasNewUnlock=false` zurück und überschreibt keine Felder. Der Caller
 * (Reward-Engine in Phase 4) nutzt `wasNewUnlock` um zu entscheiden, ob er
 * Rewards anwenden und Benachrichtigungen auslösen darf.
 */
export async function unlockAchievement(
  userId: string | Types.ObjectId,
  achievement: Pick<IAchievement, "_id" | "key">,
  opts: {
    progress?: number;
    target?: number | null;
    grantedByUserId?: string | Types.ObjectId | null;
    note?: string | null;
  } = {},
): Promise<AchievementUnlockOutcome | null> {
  const userObjectId = coerceObjectId(userId);
  if (!userObjectId) return null;

  const grantedBy =
    opts.grantedByUserId != null ? coerceObjectId(opts.grantedByUserId) : null;

  await connectDB();

  const now = new Date();
  const update: Record<string, unknown> = {
    $setOnInsert: {
      userId: userObjectId,
      achievementId: achievement._id,
      achievementKeySnapshot: achievement.key,
    },
    $set: {
      completed: true,
      unlockedAt: now,
      progress: opts.progress ?? opts.target ?? 1,
      target: opts.target ?? null,
      ...(grantedBy ? { grantedByUserId: grantedBy } : {}),
      ...(opts.note !== undefined ? { note: opts.note } : {}),
    },
  };

  const before = await UserAchievement.findOneAndUpdate(
    { userId: userObjectId, achievementId: achievement._id },
    update,
    { upsert: true, new: false, projection: { completed: 1, unlockedAt: 1 } },
  ).lean<{ completed?: boolean; unlockedAt?: Date | null }>();

  const wasAlreadyCompleted = before?.completed === true;

  return {
    userId: userObjectId.toString(),
    achievementId: achievement._id.toString(),
    achievementKey: achievement.key,
    wasNewUnlock: !wasAlreadyCompleted,
    completedAt: wasAlreadyCompleted && before?.unlockedAt ? before.unlockedAt : now,
  };
}

/**
 * Aktualisiert den Counter-Fortschritt eines Users und unlockt Achievements,
 * deren Ziel erreicht wurde. Aufruf nach jedem Event, das eine Stats-Metrik
 * erhöht (siehe Phase-3-Hooks).
 */
export async function checkCounterAchievements(
  userId: string | Types.ObjectId,
  metric: AchievementCounterMetric,
  newValue: number,
): Promise<AchievementUnlockOutcome[]> {
  const userObjectId = coerceObjectId(userId);
  if (!userObjectId || !Number.isFinite(newValue) || newValue < 0) return [];

  await connectDB();

  const achievements = await Achievement.find({
    active: true,
    "trigger.type": "counter",
    "trigger.params.metric": metric,
  })
    .lean<Pick<IAchievement, "_id" | "key" | "trigger">[]>()
    .exec();

  if (achievements.length === 0) return [];

  const outcomes: AchievementUnlockOutcome[] = [];

  for (const achievement of achievements) {
    const target = Number(
      (achievement.trigger as { params?: { target?: unknown } }).params?.target ?? 0,
    );
    if (!Number.isFinite(target) || target <= 0) continue;

    if (newValue >= target) {
      const outcome = await unlockAchievement(userObjectId, achievement, {
        progress: newValue,
        target,
      });
      if (outcome?.wasNewUnlock) outcomes.push(outcome);
    } else {
      // Progress-Update ohne Unlock. `$max` statt `$set` auf progress, damit
      // bereits completed=true Achievements (von vorheriger Metrik-Runde)
      // nicht in Konflikt mit dem unique-index geraten und ihr Status intakt
      // bleibt. completed selbst wird nie hier geschrieben.
      await UserAchievement.updateOne(
        { userId: userObjectId, achievementId: achievement._id },
        {
          $setOnInsert: {
            userId: userObjectId,
            achievementId: achievement._id,
            achievementKeySnapshot: achievement.key,
            completed: false,
          },
          $max: { progress: newValue },
          $set: { target },
        },
        { upsert: true },
      );
    }
  }

  return outcomes;
}

/**
 * Findet alle Level-triggerten Achievements mit params.level <= reachedLevel
 * und unlockt sie (idempotent). Wird nach jedem Level-Up aufgerufen.
 */
export async function checkLevelAchievements(
  userId: string | Types.ObjectId,
  reachedLevel: number,
): Promise<AchievementUnlockOutcome[]> {
  const userObjectId = coerceObjectId(userId);
  if (!userObjectId || !Number.isFinite(reachedLevel) || reachedLevel < 1) return [];

  await connectDB();

  const achievements = await Achievement.find({
    active: true,
    "trigger.type": "level",
    "trigger.params.level": { $lte: reachedLevel },
  })
    .lean<Pick<IAchievement, "_id" | "key" | "trigger">[]>()
    .exec();

  const outcomes: AchievementUnlockOutcome[] = [];
  for (const achievement of achievements) {
    const required = Number(
      (achievement.trigger as { params?: { level?: unknown } }).params?.level ?? 0,
    );
    const outcome = await unlockAchievement(userObjectId, achievement, {
      progress: reachedLevel,
      target: required,
    });
    if (outcome?.wasNewUnlock) outcomes.push(outcome);
  }
  return outcomes;
}

/**
 * Once-Events triggern Achievements, die genau einmal im Leben eines Users
 * feuern (z.B. "Erste Box geöffnet"). Idempotent durch Unique-Index.
 */
export async function checkOnceAchievement(
  userId: string | Types.ObjectId,
  event: AchievementOnceEvent,
): Promise<AchievementUnlockOutcome[]> {
  const userObjectId = coerceObjectId(userId);
  if (!userObjectId) return [];

  await connectDB();

  const achievements = await Achievement.find({
    active: true,
    "trigger.type": "once",
    "trigger.params.event": event,
  })
    .lean<Pick<IAchievement, "_id" | "key">[]>()
    .exec();

  const outcomes: AchievementUnlockOutcome[] = [];
  for (const achievement of achievements) {
    const outcome = await unlockAchievement(userObjectId, achievement, {
      progress: 1,
      target: 1,
    });
    if (outcome?.wasNewUnlock) outcomes.push(outcome);
  }
  return outcomes;
}

/**
 * Manueller Verleih durch einen Admin. Erlaubt Note und grantedByUserId.
 * Akzeptiert beliebigen Trigger-Typ — der Admin weiß warum.
 */
export async function grantAchievementManually(
  userId: string | Types.ObjectId,
  achievementId: string | Types.ObjectId,
  grantedByUserId: string | Types.ObjectId,
  note?: string | null,
): Promise<AchievementUnlockOutcome | null> {
  const userObjectId = coerceObjectId(userId);
  const achievementObjectId = coerceObjectId(achievementId);
  if (!userObjectId || !achievementObjectId) return null;

  await connectDB();

  const achievement = await Achievement.findById(achievementObjectId)
    .lean<Pick<IAchievement, "_id" | "key" | "active">>()
    .exec();

  if (!achievement || !achievement.active) return null;

  return unlockAchievement(userObjectId, achievement, {
    grantedByUserId,
    note: note ?? null,
    progress: 1,
    target: 1,
  });
}
