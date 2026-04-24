import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Achievement from "@/models/achievement";
import UserAchievement from "@/models/user-achievement";
import Translation from "@/models/translation";
import {
  MAX_LEVEL,
  levelForTotalXp,
  progressInLevel,
  xpForLevelUp,
  xpIntoLevel,
  xpToNextLevel,
} from "@/lib/level/config";
import User from "@/models/user";

interface SummaryAchievement {
  _id: string;
  key: string;
  titles: Record<string, string>;
  descriptions: Record<string, string>;
  iconImageId: string | null;
  progress: number;
  target: number | null;
  unlockedAt: string | null;
}

/**
 * Kompakter Summary-Endpoint für das Dashboard-Widget:
 *   - Level-Header (aktuelles Level, XP-Fortschritt)
 *   - Zuletzt freigeschaltete (bis zu 2)
 *   - Nächstes erreichbares: höchster Counter-Progress oder niedrigste Level-Schwelle
 *   - Summen-Count
 */
export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const [user, userAchievements, totalActive] = await Promise.all([
      User.findById(userId)
        .select("level xp")
        .lean<{ level?: number; xp?: number } | null>(),
      UserAchievement.find({ userId }).lean(),
      Achievement.countDocuments({ active: true }),
    ]);

    const xp = user?.xp ?? 0;
    const computedLevel = levelForTotalXp(xp);
    const level = Math.max(user?.level ?? 1, computedLevel);

    // Recent unlocks (bis zu 2)
    const recentUnlocked = userAchievements
      .filter((ua) => ua.completed && ua.unlockedAt)
      .sort(
        (a, b) =>
          new Date(b.unlockedAt as Date).getTime() - new Date(a.unlockedAt as Date).getTime(),
      )
      .slice(0, 2);

    // Nächstes: bester Fortschritt (für counter), sonst nächstes Level-Achievement,
    // sonst irgendein unsichtbares-bislang Once-Event.
    const inProgress = userAchievements
      .filter((ua) => !ua.completed && ua.target && ua.target > 0)
      .sort((a, b) => {
        const progressA = (a.progress ?? 0) / (a.target ?? 1);
        const progressB = (b.progress ?? 0) / (b.target ?? 1);
        return progressB - progressA;
      });

    const unlockedIds = new Set(
      userAchievements.filter((ua) => ua.completed).map((ua) => ua.achievementId.toString()),
    );

    let nextAchievementId: Types.ObjectId | null = null;
    if (inProgress[0]) {
      nextAchievementId = inProgress[0].achievementId;
    } else {
      // Noch kein Progress-Eintrag → nächstes Level-Achievement knapp über dem
      // aktuellen Level ziehen.
      const upcoming = await Achievement.findOne({
        active: true,
        hidden: false,
        "trigger.type": "level",
        "trigger.params.level": { $gt: level },
        _id: { $nin: Array.from(unlockedIds).map((id) => new Types.ObjectId(id)) },
      })
        .sort({ "trigger.params.level": 1 })
        .select("_id")
        .lean<{ _id: Types.ObjectId } | null>();
      nextAchievementId = upcoming?._id ?? null;
    }

    const achievementIds = [
      ...recentUnlocked.map((ua) => ua.achievementId),
      ...(nextAchievementId ? [nextAchievementId] : []),
    ];

    const achievements = achievementIds.length
      ? await Achievement.find({ _id: { $in: achievementIds } })
          .select("_id key titleKey descriptionKey iconImageId")
          .lean()
      : [];
    const byId = new Map(achievements.map((a) => [a._id.toString(), a]));

    const keys = new Set<string>();
    for (const a of achievements) {
      keys.add(`${a.key}.title`);
      keys.add(`${a.key}.description`);
    }
    const translations = keys.size
      ? await Translation.find({
          namespace: "achievements",
          key: { $in: Array.from(keys) },
        }).lean()
      : [];
    const translationMap = new Map<string, Record<string, string>>();
    for (const t of translations) {
      const raw = t.values instanceof Map ? Object.fromEntries(t.values) : (t.values ?? {});
      translationMap.set(t.key, raw as Record<string, string>);
    }

    function toSummary(
      achievementId: string,
      ua: { progress?: number; target?: number | null; unlockedAt?: Date | null } | null,
    ): SummaryAchievement | null {
      const a = byId.get(achievementId);
      if (!a) return null;
      return {
        _id: achievementId,
        key: a.key,
        titles: translationMap.get(`${a.key}.title`) ?? {},
        descriptions: translationMap.get(`${a.key}.description`) ?? {},
        iconImageId: a.iconImageId ? String(a.iconImageId) : null,
        progress: ua?.progress ?? 0,
        target: ua?.target ?? null,
        unlockedAt: ua?.unlockedAt ? new Date(ua.unlockedAt).toISOString() : null,
      };
    }

    const recent = recentUnlocked
      .map((ua) => toSummary(ua.achievementId.toString(), ua))
      .filter((x): x is SummaryAchievement => x !== null);

    const nextUa = nextAchievementId
      ? userAchievements.find((ua) => ua.achievementId.equals(nextAchievementId!)) ?? null
      : null;
    const next = nextAchievementId
      ? toSummary(nextAchievementId.toString(), nextUa)
      : null;

    const unlockedCount = userAchievements.filter((ua) => ua.completed).length;

    return NextResponse.json({
      level,
      maxLevel: MAX_LEVEL,
      xp,
      xpIntoLevel: xpIntoLevel(xp),
      xpForLevelUp: level >= MAX_LEVEL ? 0 : xpForLevelUp(level),
      xpToNextLevel: xpToNextLevel(xp),
      progress: progressInLevel(xp),
      recent,
      next,
      unlockedCount,
      totalCount: totalActive,
    });
  } catch (err) {
    console.error("[me/achievements/summary GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
