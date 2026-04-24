import { Types } from "mongoose";
import connectDB from "@/lib/db";
import Achievement, {
  type AchievementCounterMetric,
  type AchievementOnceEvent,
  type IAchievement,
} from "@/models/achievement";
import UserAchievement from "@/models/user-achievement";
import { applyRewardsForUnlock } from "./rewards";

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
 * Race-sicher: Nur der Thread, der den atomaren Flip `completed:false→true`
 * gewinnt, meldet `wasNewUnlock=true` und lässt Rewards anwenden. Parallele
 * Caller für denselben User+Achievement bekommen `wasNewUnlock=false` zurück.
 *
 * Der ursprüngliche `unlockedAt`-Timestamp wird einmalig gesetzt und danach
 * nie überschrieben — wichtig für den Audit-Trail, wenn später ein Counter
 * erneut am bereits entsperrten Achievement vorbeikommt.
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

  // Fast-path: Wenn bereits completed, überspringen wir jede Mutation. Das
  // verhindert, dass `unlockedAt` oder `progress` bei Folge-Events überschrieben
  // werden.
  const existing = await UserAchievement.findOne({
    userId: userObjectId,
    achievementId: achievement._id,
  })
    .select("completed unlockedAt")
    .lean<{ completed?: boolean; unlockedAt?: Date | null }>();

  if (existing?.completed === true) {
    return {
      userId: userObjectId.toString(),
      achievementId: achievement._id.toString(),
      achievementKey: achievement.key,
      wasNewUnlock: false,
      completedAt: existing.unlockedAt ?? now,
    };
  }

  // Atomarer Flip: findOneAndUpdate mit `completed: { $ne: true }` matcht nur
  // nicht-entsperrte Zeilen. Bei Race gewinnt genau einer den Update; der
  // andere läuft in einen duplicate-key-Error beim Upsert-Insert und erkennt
  // daran, dass er zu spät kam.
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

  try {
    await UserAchievement.findOneAndUpdate(
      { userId: userObjectId, achievementId: achievement._id, completed: { $ne: true } },
      update,
      { upsert: true, new: true },
    );
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) {
      // Paralleler Unlock hat gewonnen — kein Double-Grant, kein Error.
      return {
        userId: userObjectId.toString(),
        achievementId: achievement._id.toString(),
        achievementKey: achievement.key,
        wasNewUnlock: false,
        completedAt: now,
      };
    }
    throw err;
  }

  try {
    await applyRewardsForUnlock(userObjectId, achievement._id);
  } catch (err) {
    console.error("[achievements unlock applyRewards]", err);
  }

  return {
    userId: userObjectId.toString(),
    achievementId: achievement._id.toString(),
    achievementKey: achievement.key,
    wasNewUnlock: true,
    completedAt: now,
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
