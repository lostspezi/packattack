import { Types } from "mongoose";
import connectDB from "@/lib/db";
import Achievement, {
  type AchievementReward,
  type IAchievement,
} from "@/models/achievement";
import UserAchievement from "@/models/user-achievement";
import { runRedisCommand } from "@/lib/redis";

export interface UserEffects {
  /** Produkt aller aktiven Multiplikatoren. 1.0 = kein Bonus. */
  convertMultiplier: number;
  /** Slugs von Boxen, die per Achievement freigeschaltet wurden (zusätzlich zum Level-Gate). */
  unlockedBoxSlugs: string[];
  /** Kosmetik. Aktuell nur Titel; weitere Slots sind im Datenmodell vorbereitet. */
  cosmetics: {
    /** Alle freigeschalteten Titel in Reihenfolge der Achievement-sortOrder. */
    titles: string[];
  };
}

const CACHE_TTL_SECONDS = 300;

function cacheKey(userId: string): string {
  return `effects:user:${userId}`;
}

function emptyEffects(): UserEffects {
  return { convertMultiplier: 1, unlockedBoxSlugs: [], cosmetics: { titles: [] } };
}

function accumulate(effects: UserEffects, reward: AchievementReward): void {
  switch (reward.type) {
    case "convert_multiplier": {
      const raw = (reward.params as { multiplier?: unknown })?.multiplier;
      const multiplier = Number(raw);
      if (Number.isFinite(multiplier) && multiplier > 0) {
        effects.convertMultiplier *= multiplier;
      }
      break;
    }
    case "unlock_box": {
      const slug = (reward.params as { boxSlug?: unknown })?.boxSlug;
      if (typeof slug === "string" && slug.trim().length > 0) {
        const trimmed = slug.trim();
        if (!effects.unlockedBoxSlugs.includes(trimmed)) {
          effects.unlockedBoxSlugs.push(trimmed);
        }
      }
      break;
    }
    case "cosmetic": {
      const params = reward.params as { slot?: unknown; value?: unknown };
      if (typeof params?.value !== "string") break;
      const value = params.value.trim();
      if (!value) break;
      if (params.slot === "title" && !effects.cosmetics.titles.includes(value)) {
        effects.cosmetics.titles.push(value);
      }
      // frame / chat_color werden absichtlich nicht akkumuliert — keine
      // Anzeige, kein Effekt. Falls im Datenmodell später freigegeben,
      // hier ergänzen.
      break;
    }
    case "coins":
    case "grant_badge":
      // Einmal-Effekte werden im Moment des Unlocks von `applyReward` appliziert.
      break;
  }
}

/**
 * Liefert die aggregierten, aktiven Effekte für einen User.
 *
 * Cached in Redis. Bei Fehlern fällt die Funktion auf Live-Compute zurück —
 * ein leerer UserEffect wird nur bei Fehlern aus der DB zurückgegeben, nie
 * ohne Versuch.
 */
export async function getUserEffects(
  userId: string | Types.ObjectId,
): Promise<UserEffects> {
  const idStr = userId.toString();

  const cached = await runRedisCommand<string | null>(
    "effects:get",
    null,
    async (redis) => (await redis.get(cacheKey(idStr))) ?? null,
  );

  if (cached) {
    try {
      const parsed = JSON.parse(cached) as Partial<UserEffects> | null;
      if (parsed && typeof parsed === "object" && typeof parsed.convertMultiplier === "number") {
        const titles = Array.isArray(parsed.cosmetics?.titles)
          ? parsed.cosmetics.titles.filter((s): s is string => typeof s === "string")
          : [];
        return {
          convertMultiplier: parsed.convertMultiplier,
          unlockedBoxSlugs: Array.isArray(parsed.unlockedBoxSlugs)
            ? parsed.unlockedBoxSlugs.filter((s): s is string => typeof s === "string")
            : [],
          cosmetics: { titles },
        };
      }
    } catch {
      // malformed cache — fall through to recompute
    }
  }

  await connectDB();

  const completed = await UserAchievement.find({ userId: idStr, completed: true })
    .select("achievementId")
    .lean<Array<{ achievementId: Types.ObjectId }>>();

  const effects = emptyEffects();

  if (completed.length > 0) {
    const achievementIds = completed.map((c) => c.achievementId);
    const achievements = await Achievement.find({
      _id: { $in: achievementIds },
      active: true,
    })
      .select("rewards")
      .lean<Pick<IAchievement, "_id" | "rewards">[]>();

    for (const a of achievements) {
      for (const reward of a.rewards ?? []) {
        accumulate(effects, reward);
      }
    }
  }

  await runRedisCommand<void>("effects:set", undefined, async (redis) => {
    await redis.set(cacheKey(idStr), JSON.stringify(effects), "EX", CACHE_TTL_SECONDS);
  });

  return effects;
}

/** Cache invalidieren (bei Achievement-Unlock, Admin-Edit, etc.). */
export async function invalidateUserEffects(
  userId: string | Types.ObjectId,
): Promise<void> {
  const idStr = userId.toString();
  await runRedisCommand<void>("effects:del", undefined, async (redis) => {
    await redis.del(cacheKey(idStr));
  });
}
