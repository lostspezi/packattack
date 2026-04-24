import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types } from "mongoose";

interface FakeUser {
  _id: Types.ObjectId;
  stats: {
    loginStreak: { current: number; best: number; lastLoginDay: string | null };
  };
}

const userStore = new Map<string, FakeUser>();

function makeUser(overrides: Partial<FakeUser["stats"]["loginStreak"]> = {}): FakeUser {
  const user: FakeUser = {
    _id: new Types.ObjectId(),
    stats: {
      loginStreak: { current: 0, best: 0, lastLoginDay: null, ...overrides },
    },
  };
  userStore.set(user._id.toString(), user);
  return user;
}

vi.mock("@/lib/db", () => ({
  default: async () => undefined,
  connectDB: async () => undefined,
}));

const grantXpCalls: Array<{ amount: number; source: string }> = [];
const incrementCounterCalls: Array<{ metric: string; by: number }> = [];

vi.mock("@/lib/level/grant-xp", async () => {
  const actual = await vi.importActual<typeof import("@/lib/level/grant-xp")>("@/lib/level/grant-xp");
  return {
    ...actual,
    grantXp: async (_userId: unknown, amount: number, source: string) => {
      grantXpCalls.push({ amount, source });
      return { oldXp: 0, newXp: amount, leveledUp: false, unlockedAchievements: [] };
    },
    incrementCounter: async (_userId: unknown, metric: string, by: number) => {
      incrementCounterCalls.push({ metric, by });
      return { newValue: by, unlockedAchievements: [] };
    },
  };
});

vi.mock("@/models/user", () => {
  const User = {
    findById: (id: Types.ObjectId | string) => {
      const key = id.toString();
      return {
        select: () => ({
          lean: async () => userStore.get(key) ?? null,
        }),
      };
    },
    updateOne: async (
      filter: {
        _id?: Types.ObjectId;
        $or?: Array<Record<string, unknown>>;
      },
      update: { $set?: Record<string, unknown> },
    ) => {
      const id = filter._id?.toString?.();
      const user = id ? userStore.get(id) : undefined;
      if (!user) return { modifiedCount: 0 };

      if (filter.$or) {
        const currentDay = user.stats.loginStreak.lastLoginDay;
        const targetDay = (filter.$or[0] as { "stats.loginStreak.lastLoginDay": { $ne: string } })[
          "stats.loginStreak.lastLoginDay"
        ].$ne;
        if (currentDay === targetDay) return { modifiedCount: 0 };
      }

      if (update.$set) {
        for (const [path, value] of Object.entries(update.$set)) {
          const segs = path.split(".");
          let cur = user as unknown as Record<string, unknown>;
          for (let i = 0; i < segs.length - 1; i++) {
            const key = segs[i];
            if (typeof cur[key] !== "object" || cur[key] === null) cur[key] = {};
            cur = cur[key] as Record<string, unknown>;
          }
          cur[segs[segs.length - 1]] = value;
        }
      }
      return { modifiedCount: 1 };
    },
  };
  return { default: User };
});

import { trackLoginStreak } from "@/lib/engagement/login-streak";

beforeEach(() => {
  userStore.clear();
  grantXpCalls.length = 0;
  incrementCounterCalls.length = 0;
});

describe("trackLoginStreak", () => {
  it("grants daily XP on a first-ever login", async () => {
    const user = makeUser();
    const now = new Date(2026, 3, 24, 9, 0, 0);
    const result = await trackLoginStreak(user._id, now);
    expect(result?.currentStreak).toBe(1);
    expect(result?.bestStreak).toBe(1);
    expect(result?.alreadyTrackedToday).toBe(false);
    expect(result?.bonusAwarded).toBe(false);
    expect(grantXpCalls).toHaveLength(1);
    expect(grantXpCalls[0].amount).toBe(10);
    expect(grantXpCalls[0].source).toBe("login_streak");
    expect(incrementCounterCalls).toEqual([{ metric: "loginDays", by: 1 }]);
  });

  it("is idempotent within the same day", async () => {
    const user = makeUser({ current: 3, best: 5, lastLoginDay: "2026-04-24" });
    const result = await trackLoginStreak(user._id, new Date(2026, 3, 24, 20, 0, 0));
    expect(result?.alreadyTrackedToday).toBe(true);
    expect(grantXpCalls).toHaveLength(0);
    expect(incrementCounterCalls).toHaveLength(0);
  });

  it("increments streak on consecutive day", async () => {
    const user = makeUser({ current: 2, best: 2, lastLoginDay: "2026-04-23" });
    const result = await trackLoginStreak(user._id, new Date(2026, 3, 24, 9, 0, 0));
    expect(result?.currentStreak).toBe(3);
    expect(result?.bestStreak).toBe(3);
  });

  it("resets streak after a gap", async () => {
    const user = makeUser({ current: 5, best: 5, lastLoginDay: "2026-04-20" });
    const result = await trackLoginStreak(user._id, new Date(2026, 3, 24, 9, 0, 0));
    expect(result?.currentStreak).toBe(1);
    expect(result?.bestStreak).toBe(5);
  });

  it("awards streak bonus on day 7", async () => {
    const user = makeUser({ current: 6, best: 6, lastLoginDay: "2026-04-23" });
    const result = await trackLoginStreak(user._id, new Date(2026, 3, 24, 9, 0, 0));
    expect(result?.bonusAwarded).toBe(true);
    expect(grantXpCalls[0].amount).toBe(10 + 40);
  });
});
