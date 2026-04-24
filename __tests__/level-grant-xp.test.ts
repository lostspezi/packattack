import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types } from "mongoose";

interface FakeUser {
  _id: Types.ObjectId;
  xp: number;
  level: number;
  lastXpGainAt: Date | null;
  stats: {
    counters: Record<string, number>;
  };
}

const userStore = new Map<string, FakeUser>();

function makeUser(overrides: Partial<FakeUser> = {}): FakeUser {
  const user: FakeUser = {
    _id: new Types.ObjectId(),
    xp: 0,
    level: 1,
    lastXpGainAt: null,
    stats: { counters: {} },
    ...overrides,
  };
  userStore.set(user._id.toString(), user);
  return user;
}

vi.mock("@/lib/db", () => ({
  default: async () => undefined,
  connectDB: async () => undefined,
}));

vi.mock("@/lib/achievements/engine", () => ({
  checkLevelAchievements: async () => [],
  checkCounterAchievements: async () => [],
  checkOnceAchievement: async () => [],
}));

vi.mock("@/lib/notifications/level-up", () => ({
  notifyLevelUp: async () => undefined,
  notifyAchievementUnlock: async () => undefined,
}));

vi.mock("@/models/user", () => {
  function applyInc(target: Record<string, unknown>, update: Record<string, unknown>) {
    for (const [path, delta] of Object.entries(update)) {
      const segs = path.split(".");
      let cur = target as Record<string, unknown>;
      for (let i = 0; i < segs.length - 1; i++) {
        const key = segs[i];
        if (typeof cur[key] !== "object" || cur[key] === null) cur[key] = {};
        cur = cur[key] as Record<string, unknown>;
      }
      const leaf = segs[segs.length - 1];
      cur[leaf] = (Number(cur[leaf] ?? 0) || 0) + Number(delta);
    }
  }
  function applySet(target: Record<string, unknown>, update: Record<string, unknown>) {
    for (const [path, value] of Object.entries(update)) {
      const segs = path.split(".");
      let cur = target as Record<string, unknown>;
      for (let i = 0; i < segs.length - 1; i++) {
        const key = segs[i];
        if (typeof cur[key] !== "object" || cur[key] === null) cur[key] = {};
        cur = cur[key] as Record<string, unknown>;
      }
      cur[segs[segs.length - 1]] = value;
    }
  }
  function clone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
  const User = {
    findByIdAndUpdate: (
      id: Types.ObjectId | string,
      update: { $inc?: Record<string, number>; $set?: Record<string, unknown> },
      opts: { new?: boolean } = {},
    ) => {
      const key = id.toString();
      const existing = userStore.get(key);
      if (!existing) return { lean: async () => null };
      const snapshot = clone(existing);
      if (update.$inc) applyInc(existing as unknown as Record<string, unknown>, update.$inc);
      if (update.$set) applySet(existing as unknown as Record<string, unknown>, update.$set);
      const returnDoc = opts.new ? clone(existing) : snapshot;
      return { lean: async () => returnDoc };
    },
    updateOne: async (
      filter: Record<string, unknown>,
      update: { $set?: Record<string, unknown> },
    ) => {
      const id = filter._id?.toString?.();
      const user = id ? userStore.get(id) : undefined;
      if (!user) return { modifiedCount: 0 };
      const levelFilter = filter.level as { $lt?: number } | undefined;
      if (levelFilter?.$lt !== undefined && user.level >= levelFilter.$lt) {
        return { modifiedCount: 0 };
      }
      if (update.$set) applySet(user as unknown as Record<string, unknown>, update.$set);
      return { modifiedCount: 1 };
    },
  };
  return { default: User };
});

// Import AFTER mocks.
import { grantXp, incrementCounter } from "@/lib/level/grant-xp";
import { MAX_LEVEL, totalXpForLevel } from "@/lib/level/config";

beforeEach(() => {
  userStore.clear();
});

describe("grantXp", () => {
  it("adds XP and returns before/after snapshot", async () => {
    const user = makeUser();
    const result = await grantXp(user._id, 25, "admin");
    expect(result).not.toBeNull();
    expect(result!.oldXp).toBe(0);
    expect(result!.newXp).toBe(25);
    expect(result!.leveledUp).toBe(false);
    expect(userStore.get(user._id.toString())!.xp).toBe(25);
    expect(userStore.get(user._id.toString())!.lastXpGainAt).toBeInstanceOf(Date);
  });

  it("detects single level-up and persists the new level", async () => {
    const user = makeUser();
    const result = await grantXp(user._id, 150, "pack_open");
    expect(result!.leveledUp).toBe(true);
    expect(result!.oldLevel).toBe(1);
    expect(result!.newLevel).toBe(2);
    expect(result!.isMilestone).toBe(false);
    expect(userStore.get(user._id.toString())!.level).toBe(2);
  });

  it("handles multi-level jumps on huge XP bumps", async () => {
    const user = makeUser();
    const jumpToLevel10 = totalXpForLevel(10);
    const result = await grantXp(user._id, jumpToLevel10, "admin");
    expect(result!.newLevel).toBe(10);
    expect(result!.isMilestone).toBe(true);
  });

  it("caps at MAX_LEVEL even with overflow XP", async () => {
    const user = makeUser();
    const result = await grantXp(user._id, 100_000_000, "admin");
    expect(result!.newLevel).toBe(MAX_LEVEL);
  });

  it("does not leveldown when user is already above computed level", async () => {
    const user = makeUser({ xp: 0, level: 5 });
    const result = await grantXp(user._id, 10, "pack_open");
    expect(result!.newLevel).toBe(5);
    expect(result!.leveledUp).toBe(false);
    expect(userStore.get(user._id.toString())!.level).toBe(5);
  });

  it("returns null for non-positive amount", async () => {
    const user = makeUser();
    expect(await grantXp(user._id, 0, "admin")).toBeNull();
    expect(await grantXp(user._id, -10, "admin")).toBeNull();
    expect(await grantXp(user._id, Number.NaN, "admin")).toBeNull();
  });

  it("returns null for unknown user", async () => {
    const fakeId = new Types.ObjectId();
    expect(await grantXp(fakeId, 50, "admin")).toBeNull();
  });

  it("rounds fractional amounts", async () => {
    const user = makeUser();
    const result = await grantXp(user._id, 3.7, "card_convert");
    expect(result!.newXp).toBe(4);
    expect(userStore.get(user._id.toString())!.xp).toBe(4);
  });

  it("parallel grants end with correct final level (no regression)", async () => {
    const user = makeUser();
    // Drei parallele Grants. Gesamt-XP bringt klar über Level 2 (= 100 XP).
    const [r1, r2, r3] = await Promise.all([
      grantXp(user._id, 60, "pack_open"),
      grantXp(user._id, 50, "pack_open"),
      grantXp(user._id, 40, "pack_open"),
    ]);
    expect(r1 && r2 && r3).toBeTruthy();
    const stored = userStore.get(user._id.toString())!;
    expect(stored.xp).toBe(150);
    // Level darf niemals niedriger sein als die Formel-Ableitung aus dem
    // tatsächlichen finalen xp-Wert.
    expect(stored.level).toBeGreaterThanOrEqual(2);
  });
});

describe("incrementCounter", () => {
  it("initialises a fresh counter to the delta", async () => {
    const user = makeUser();
    const result = await incrementCounter(user._id, "boxesOpened", 1);
    expect(result?.newValue).toBe(1);
    expect(result?.unlockedAchievements).toEqual([]);
    expect(userStore.get(user._id.toString())!.stats.counters.boxesOpened).toBe(1);
  });

  it("accumulates over repeated calls", async () => {
    const user = makeUser();
    await incrementCounter(user._id, "cardsConverted", 3);
    const next = await incrementCounter(user._id, "cardsConverted", 2);
    expect(next?.newValue).toBe(5);
  });

  it("returns null when user missing", async () => {
    const fakeId = new Types.ObjectId();
    expect(await incrementCounter(fakeId, "boxesOpened", 1)).toBeNull();
  });

  it("ignores zero delta", async () => {
    const user = makeUser();
    expect(await incrementCounter(user._id, "boxesOpened", 0)).toBeNull();
  });
});
