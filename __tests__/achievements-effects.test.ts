import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types } from "mongoose";

interface FakeUA {
  userId: Types.ObjectId;
  achievementId: Types.ObjectId;
  completed: boolean;
}
interface FakeAch {
  _id: Types.ObjectId;
  active: boolean;
  rewards: Array<{ type: string; params: Record<string, unknown> }>;
}

const userAchievements: FakeUA[] = [];
const achievements = new Map<string, FakeAch>();
const redisStore = new Map<string, string>();

vi.mock("@/lib/db", () => ({
  default: async () => undefined,
  connectDB: async () => undefined,
}));

vi.mock("@/lib/redis", () => ({
  runRedisCommand: async <T>(
    _label: string,
    fallback: T,
    command: (r: unknown) => Promise<T>,
  ) => {
    const fakeRedis = {
      get: async (key: string) => redisStore.get(key) ?? null,
      set: async (key: string, value: string) => {
        redisStore.set(key, value);
        return "OK";
      },
      del: async (key: string) => {
        redisStore.delete(key);
        return 1;
      },
    };
    try {
      return await command(fakeRedis);
    } catch {
      return fallback;
    }
  },
}));

vi.mock("@/models/user-achievement", () => ({
  default: {
    find: (query: { userId: string; completed: boolean }) => {
      const userIdStr = query.userId.toString();
      const hits = userAchievements.filter(
        (ua) => ua.userId.toString() === userIdStr && ua.completed === query.completed,
      );
      return {
        select: () => ({ lean: async () => hits }),
      };
    },
  },
}));

vi.mock("@/models/achievement", () => ({
  default: {
    find: (query: { _id: { $in: Types.ObjectId[] }; active: boolean }) => {
      const ids = new Set(query._id.$in.map((i) => i.toString()));
      const hits = Array.from(achievements.values()).filter(
        (a) => ids.has(a._id.toString()) && a.active === query.active,
      );
      return {
        select: () => ({ lean: async () => hits }),
      };
    },
  },
}));

import { getUserEffects, invalidateUserEffects } from "@/lib/achievements/effects";

beforeEach(() => {
  userAchievements.length = 0;
  achievements.clear();
  redisStore.clear();
});

describe("getUserEffects", () => {
  it("returns defaults when the user has no completed achievements", async () => {
    const userId = new Types.ObjectId();
    const effects = await getUserEffects(userId);
    expect(effects.convertMultiplier).toBe(1);
    expect(effects.unlockedBoxSlugs).toEqual([]);
    expect(effects.cosmetics).toEqual({});
  });

  it("multiplies multiple convert_multipliers", async () => {
    const userId = new Types.ObjectId();
    const a = { _id: new Types.ObjectId(), active: true, rewards: [{ type: "convert_multiplier", params: { multiplier: 1.1 } }] };
    const b = { _id: new Types.ObjectId(), active: true, rewards: [{ type: "convert_multiplier", params: { multiplier: 1.2 } }] };
    achievements.set(a._id.toString(), a);
    achievements.set(b._id.toString(), b);
    userAchievements.push({ userId, achievementId: a._id, completed: true });
    userAchievements.push({ userId, achievementId: b._id, completed: true });

    const effects = await getUserEffects(userId);
    expect(effects.convertMultiplier).toBeCloseTo(1.32, 5);
  });

  it("collects unlocked box slugs (dedupes)", async () => {
    const userId = new Types.ObjectId();
    const a = { _id: new Types.ObjectId(), active: true, rewards: [{ type: "unlock_box", params: { boxSlug: "premium-1" } }] };
    const b = { _id: new Types.ObjectId(), active: true, rewards: [{ type: "unlock_box", params: { boxSlug: "premium-1" } }] };
    const c = { _id: new Types.ObjectId(), active: true, rewards: [{ type: "unlock_box", params: { boxSlug: "elite-2" } }] };
    [a, b, c].forEach((x) => achievements.set(x._id.toString(), x));
    userAchievements.push({ userId, achievementId: a._id, completed: true });
    userAchievements.push({ userId, achievementId: b._id, completed: true });
    userAchievements.push({ userId, achievementId: c._id, completed: true });

    const effects = await getUserEffects(userId);
    expect(effects.unlockedBoxSlugs.sort()).toEqual(["elite-2", "premium-1"]);
  });

  it("ignores inactive achievements even if user has them unlocked", async () => {
    const userId = new Types.ObjectId();
    const a = { _id: new Types.ObjectId(), active: false, rewards: [{ type: "convert_multiplier", params: { multiplier: 5 } }] };
    achievements.set(a._id.toString(), a);
    userAchievements.push({ userId, achievementId: a._id, completed: true });
    const effects = await getUserEffects(userId);
    expect(effects.convertMultiplier).toBe(1);
  });

  it("caches result and serves from cache on second call", async () => {
    const userId = new Types.ObjectId();
    const a = { _id: new Types.ObjectId(), active: true, rewards: [{ type: "convert_multiplier", params: { multiplier: 1.5 } }] };
    achievements.set(a._id.toString(), a);
    userAchievements.push({ userId, achievementId: a._id, completed: true });

    const first = await getUserEffects(userId);
    expect(first.convertMultiplier).toBe(1.5);

    // Delete achievement from store — if cache works, second call still returns 1.5
    achievements.clear();

    const second = await getUserEffects(userId);
    expect(second.convertMultiplier).toBe(1.5);
  });

  it("invalidateUserEffects forces recompute", async () => {
    const userId = new Types.ObjectId();
    const a = { _id: new Types.ObjectId(), active: true, rewards: [{ type: "convert_multiplier", params: { multiplier: 2 } }] };
    achievements.set(a._id.toString(), a);
    userAchievements.push({ userId, achievementId: a._id, completed: true });

    const first = await getUserEffects(userId);
    expect(first.convertMultiplier).toBe(2);

    achievements.clear();
    userAchievements.length = 0;
    await invalidateUserEffects(userId);

    const second = await getUserEffects(userId);
    expect(second.convertMultiplier).toBe(1);
  });

  it("cosmetic rewards map to the correct slot", async () => {
    const userId = new Types.ObjectId();
    const a = {
      _id: new Types.ObjectId(),
      active: true,
      rewards: [
        { type: "cosmetic", params: { slot: "title", value: "PACKATTACK Veteran" } },
        { type: "cosmetic", params: { slot: "chat_color", value: "#ff00aa" } },
      ],
    };
    achievements.set(a._id.toString(), a);
    userAchievements.push({ userId, achievementId: a._id, completed: true });
    const effects = await getUserEffects(userId);
    expect(effects.cosmetics.title).toBe("PACKATTACK Veteran");
    expect(effects.cosmetics.chatColor).toBe("#ff00aa");
    expect(effects.cosmetics.frame).toBeUndefined();
  });

  it("silently skips malformed reward params", async () => {
    const userId = new Types.ObjectId();
    const a = {
      _id: new Types.ObjectId(),
      active: true,
      rewards: [
        { type: "convert_multiplier", params: { multiplier: "not-a-number" } },
        { type: "unlock_box", params: { boxSlug: 123 } },
      ],
    };
    achievements.set(a._id.toString(), a);
    userAchievements.push({ userId, achievementId: a._id, completed: true });
    const effects = await getUserEffects(userId);
    expect(effects.convertMultiplier).toBe(1);
    expect(effects.unlockedBoxSlugs).toEqual([]);
  });
});
