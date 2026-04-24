import { Types } from "mongoose";
import connectDB from "@/lib/db";
import User from "@/models/user";
import { isLevelMilestone, levelForTotalXp, MAX_LEVEL } from "./config";

export type XpSource =
  | "pack_open"
  | "card_convert"
  | "battle_win"
  | "battle_participate"
  | "login_streak"
  | "achievement_bonus"
  | "admin";

export interface XpGrantResult {
  userId: string;
  oldXp: number;
  newXp: number;
  oldLevel: number;
  newLevel: number;
  leveledUp: boolean;
  isMilestone: boolean;
  source: XpSource;
}

function coerceUserId(userId: string | Types.ObjectId): Types.ObjectId | null {
  if (userId instanceof Types.ObjectId) return userId;
  if (typeof userId === "string" && Types.ObjectId.isValid(userId)) {
    return new Types.ObjectId(userId);
  }
  return null;
}

/**
 * Vergibt XP an einen User, erkennt Level-Ups und persistiert sie.
 *
 * Strategie (zwei-Phasen-Schreibvorgang):
 *   1. Atomares `$inc` auf `xp` + `$set` auf `lastXpGainAt`, mit `new: true` —
 *      wir lesen den *post-increment* XP-Stand. Der atomare Increment stellt
 *      sicher, dass XP nie verloren geht, selbst wenn mehrere Grants parallel
 *      laufen.
 *   2. Aus dem neuen XP-Stand das Ziel-Level berechnen. Wenn der gecachte
 *      `level`-Wert niedriger ist, mit `$lt`-Guard auf das neue Level heben.
 *
 * Konsequenz: `xp` ist immer korrekt. `level` ist ein Cache mit der Invariante
 * `level >= levelForTotalXp(xp)` nach jedem erfolgreichen Grant. Bei echter
 * Parallelität können zwei Grants denselben Level-Up melden; Konsumenten müssen
 * idempotent sein (achievement-unlock nutzt das eigene UserAchievement-Index).
 */
export async function grantXp(
  userId: string | Types.ObjectId,
  amount: number,
  source: XpSource,
): Promise<XpGrantResult | null> {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const objectId = coerceUserId(userId);
  if (!objectId) return null;

  const rounded = Math.round(amount);

  await connectDB();

  const after = await User.findByIdAndUpdate(
    objectId,
    { $inc: { xp: rounded }, $set: { lastXpGainAt: new Date() } },
    { new: true, projection: { xp: 1, level: 1 } },
  ).lean<{ _id: Types.ObjectId; xp?: number; level?: number }>();

  if (!after) return null;

  const newXp = after.xp ?? rounded;
  const oldXp = Math.max(0, newXp - rounded);
  const storedLevel = after.level ?? 1;
  // oldLevel respektiert sowohl den Cache als auch die Formel-Ableitung aus der
  // pre-increment XP. So wird ein Grant nicht fälschlich als "level-up"
  // gemeldet, wenn der Cache bereits voraus war (z.B. durch parallelen Grant).
  const oldLevel = Math.max(storedLevel, levelForTotalXp(oldXp));
  const newLevel = Math.min(Math.max(levelForTotalXp(newXp), oldLevel), MAX_LEVEL);

  if (newLevel > storedLevel) {
    await User.updateOne(
      { _id: objectId, level: { $lt: newLevel } },
      { $set: { level: newLevel } },
    );
  }

  return {
    userId: objectId.toString(),
    oldXp,
    newXp,
    oldLevel,
    newLevel,
    leveledUp: newLevel > oldLevel,
    isMilestone: newLevel > oldLevel && isLevelMilestone(newLevel),
    source,
  };
}

export type CounterMetric =
  | "boxesOpened"
  | "cardsConverted"
  | "battlesPlayed"
  | "battlesWon"
  | "coinsSpent"
  | "loginDays";

/**
 * Inkrementiert einen Stats-Counter am User atomar und liefert den neuen Wert.
 * Basis für Counter-Achievements (wird in Phase 3 an Events angebunden).
 */
export async function incrementCounter(
  userId: string | Types.ObjectId,
  metric: CounterMetric,
  by = 1,
): Promise<number | null> {
  if (!Number.isFinite(by) || by === 0) return null;
  const objectId = coerceUserId(userId);
  if (!objectId) return null;

  await connectDB();

  const path = `stats.counters.${metric}`;
  const after = await User.findByIdAndUpdate(
    objectId,
    { $inc: { [path]: by } },
    { new: true, projection: { [path]: 1 } },
  ).lean<{ stats?: { counters?: Record<string, number> } }>();

  if (!after) return null;
  return after.stats?.counters?.[metric] ?? null;
}
