import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types } from "mongoose";

interface FakeAchievement {
  _id: Types.ObjectId;
  key: string;
  active: boolean;
  trigger: { type: string; params: Record<string, unknown> };
}

interface FakeUserAchievement {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  achievementId: Types.ObjectId;
  achievementKeySnapshot: string;
  progress: number;
  target: number | null;
  completed: boolean;
  unlockedAt: Date | null;
  grantedByUserId: Types.ObjectId | null;
  note: string | null;
}

const achievementStore = new Map<string, FakeAchievement>();
const userAchievementStore: FakeUserAchievement[] = [];

function addAchievement(a: Omit<FakeAchievement, "_id"> & { _id?: Types.ObjectId }): FakeAchievement {
  const record: FakeAchievement = { _id: a._id ?? new Types.ObjectId(), ...a };
  achievementStore.set(record._id.toString(), record);
  return record;
}

function matches(candidate: FakeAchievement, query: Record<string, unknown>): boolean {
  if (query.active !== undefined && candidate.active !== query.active) return false;
  if (query["trigger.type"] !== undefined && candidate.trigger.type !== query["trigger.type"]) {
    return false;
  }
  if (query["trigger.params.metric"] !== undefined) {
    if (candidate.trigger.params.metric !== query["trigger.params.metric"]) return false;
  }
  if (query["trigger.params.event"] !== undefined) {
    if (candidate.trigger.params.event !== query["trigger.params.event"]) return false;
  }
  if (query["trigger.params.level"] !== undefined) {
    const filter = query["trigger.params.level"] as { $lte?: number };
    const lvl = Number(candidate.trigger.params.level ?? 0);
    if (filter.$lte !== undefined && lvl > filter.$lte) return false;
  }
  return true;
}

vi.mock("@/lib/db", () => ({
  default: async () => undefined,
  connectDB: async () => undefined,
}));

vi.mock("@/lib/achievements/rewards", () => ({
  applyRewardsForUnlock: async () => undefined,
}));

vi.mock("@/models/achievement", () => {
  const Achievement = {
    find: (query: Record<string, unknown>) => {
      const results = Array.from(achievementStore.values()).filter((a) => matches(a, query));
      return {
        lean: () => ({ exec: async () => results }),
      };
    },
    findById: (id: Types.ObjectId | string) => ({
      lean: () => ({ exec: async () => achievementStore.get(id.toString()) ?? null }),
    }),
  };
  return { default: Achievement };
});

vi.mock("@/models/user-achievement", () => {
  const UserAchievement = {
    findOne: (filter: { userId: Types.ObjectId; achievementId: Types.ObjectId }) => {
      const userIdStr = filter.userId.toString();
      const achievementIdStr = filter.achievementId.toString();
      const entry = userAchievementStore.find(
        (e) =>
          e.userId.toString() === userIdStr && e.achievementId.toString() === achievementIdStr,
      );
      return {
        select: () => ({
          lean: async () => (entry ? { ...entry } : null),
        }),
      };
    },
    findOneAndUpdate: (
      filter: {
        userId: Types.ObjectId;
        achievementId: Types.ObjectId;
        completed?: { $ne?: boolean };
      },
      update: { $setOnInsert?: Partial<FakeUserAchievement>; $set?: Partial<FakeUserAchievement> },
      opts: { upsert?: boolean; new?: boolean } = {},
    ) => {
      const userIdStr = filter.userId.toString();
      const achievementIdStr = filter.achievementId.toString();
      const entryByKey = userAchievementStore.find(
        (e) => e.userId.toString() === userIdStr && e.achievementId.toString() === achievementIdStr,
      );

      const needsNotCompleted = filter.completed?.$ne === true;
      const matches = !!entryByKey && (!needsNotCompleted || entryByKey.completed !== true);

      // Simuliert Mongo: Filter matched nicht, aber Row existiert, Upsert
      // versucht Insert und stirbt am Unique-Index.
      if (!matches && entryByKey && opts.upsert) {
        throw Object.assign(new Error("E11000 duplicate key error simulated"), {
          code: 11000,
        });
      }

      let entry = matches ? entryByKey : undefined;
      const before = entry ? { ...entry } : null;

      if (!entry && opts.upsert) {
        entry = {
          _id: new Types.ObjectId(),
          userId: filter.userId,
          achievementId: filter.achievementId,
          achievementKeySnapshot: "",
          progress: 0,
          target: null,
          completed: false,
          unlockedAt: null,
          grantedByUserId: null,
          note: null,
        };
        userAchievementStore.push(entry);
      }
      if (!entry) {
        return { lean: async () => null };
      }
      if (update.$setOnInsert && !before) {
        Object.assign(entry, update.$setOnInsert);
      }
      if (update.$set) Object.assign(entry, update.$set);
      const returnDoc = opts.new ? { ...entry } : before ?? null;
      return { lean: async () => returnDoc };
    },
    updateOne: async (
      filter: { userId: Types.ObjectId; achievementId: Types.ObjectId; completed?: boolean },
      update: {
        $setOnInsert?: Partial<FakeUserAchievement>;
        $set?: Partial<FakeUserAchievement>;
        $max?: Record<string, number>;
      },
      opts: { upsert?: boolean } = {},
    ) => {
      const userIdStr = filter.userId.toString();
      const achievementIdStr = filter.achievementId.toString();
      const entryByKey = userAchievementStore.find(
        (e) =>
          e.userId.toString() === userIdStr && e.achievementId.toString() === achievementIdStr,
      );
      const entryMatchesFilter =
        !!entryByKey &&
        (filter.completed === undefined || entryByKey.completed === filter.completed);

      // Reproduziert das MongoDB-Verhalten: wenn Filter completed:false setzt,
      // aber ein Doc mit completed:true existiert, schlägt der Upsert-Insert
      // am Unique-Index fehl. Der Mock wirft dann explizit, damit der Test den
      // Bug erkennt.
      if (!entryMatchesFilter && entryByKey && opts.upsert) {
        throw Object.assign(new Error("E11000 duplicate key error simulated"), {
          code: 11000,
        });
      }

      const entry = entryMatchesFilter ? entryByKey : undefined;
      const before = entry ? { ...entry } : null;

      let activeEntry = entry;
      if (!activeEntry && opts.upsert) {
        activeEntry = {
          _id: new Types.ObjectId(),
          userId: filter.userId,
          achievementId: filter.achievementId,
          achievementKeySnapshot: "",
          progress: 0,
          target: null,
          completed: false,
          unlockedAt: null,
          grantedByUserId: null,
          note: null,
        };
        userAchievementStore.push(activeEntry);
      }
      if (!activeEntry) return { modifiedCount: 0 };
      if (update.$setOnInsert && !before) Object.assign(activeEntry, update.$setOnInsert);
      if (update.$set) Object.assign(activeEntry, update.$set);
      if (update.$max) {
        for (const [key, value] of Object.entries(update.$max)) {
          const current = (activeEntry as unknown as Record<string, number>)[key] ?? -Infinity;
          if (value > current) {
            (activeEntry as unknown as Record<string, number>)[key] = value;
          }
        }
      }
      return { modifiedCount: 1 };
    },
  };
  return { default: UserAchievement };
});

// Import nach Mocks.
import {
  checkCounterAchievements,
  checkLevelAchievements,
  checkOnceAchievement,
  grantAchievementManually,
  unlockAchievement,
} from "@/lib/achievements/engine";

beforeEach(() => {
  achievementStore.clear();
  userAchievementStore.length = 0;
});

describe("checkLevelAchievements", () => {
  it("unlocks all level-triggered achievements at or below reached level", async () => {
    addAchievement({ key: "lvl_5", active: true, trigger: { type: "level", params: { level: 5 } } });
    addAchievement({ key: "lvl_10", active: true, trigger: { type: "level", params: { level: 10 } } });
    addAchievement({ key: "lvl_25", active: true, trigger: { type: "level", params: { level: 25 } } });

    const userId = new Types.ObjectId();
    const outcomes = await checkLevelAchievements(userId, 10);

    const keys = outcomes.map((o) => o.achievementKey).sort();
    expect(keys).toEqual(["lvl_10", "lvl_5"]);
    expect(outcomes.every((o) => o.wasNewUnlock)).toBe(true);
  });

  it("is idempotent on repeat calls (no duplicate unlocks)", async () => {
    addAchievement({ key: "lvl_5", active: true, trigger: { type: "level", params: { level: 5 } } });
    const userId = new Types.ObjectId();

    const first = await checkLevelAchievements(userId, 5);
    const second = await checkLevelAchievements(userId, 5);

    expect(first).toHaveLength(1);
    expect(first[0].wasNewUnlock).toBe(true);
    expect(second).toHaveLength(0); // nur neue Unlocks werden gemeldet
    expect(userAchievementStore.filter((e) => e.userId.equals(userId))).toHaveLength(1);
  });

  it("ignores inactive achievements", async () => {
    addAchievement({
      key: "lvl_5",
      active: false,
      trigger: { type: "level", params: { level: 5 } },
    });
    const outcomes = await checkLevelAchievements(new Types.ObjectId(), 10);
    expect(outcomes).toHaveLength(0);
  });
});

describe("checkCounterAchievements", () => {
  it("unlocks when target reached", async () => {
    addAchievement({
      key: "open_10_boxes",
      active: true,
      trigger: { type: "counter", params: { metric: "boxesOpened", target: 10 } },
    });
    const userId = new Types.ObjectId();
    const outcomes = await checkCounterAchievements(userId, "boxesOpened", 10);
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].wasNewUnlock).toBe(true);
  });

  it("tracks progress without unlock when below target", async () => {
    addAchievement({
      key: "open_100_boxes",
      active: true,
      trigger: { type: "counter", params: { metric: "boxesOpened", target: 100 } },
    });
    const userId = new Types.ObjectId();
    const outcomes = await checkCounterAchievements(userId, "boxesOpened", 42);
    expect(outcomes).toHaveLength(0);
    const entry = userAchievementStore.find((e) => e.userId.equals(userId));
    expect(entry).toBeDefined();
    expect(entry!.progress).toBe(42);
    expect(entry!.target).toBe(100);
    expect(entry!.completed).toBe(false);
  });

  it("does not E11000 when counter fires after completion", async () => {
    addAchievement({
      key: "open_10_boxes",
      active: true,
      trigger: { type: "counter", params: { metric: "boxesOpened", target: 10 } },
    });
    const userId = new Types.ObjectId();

    // Erstes Ereignis: trifft das Ziel → completed=true.
    await checkCounterAchievements(userId, "boxesOpened", 10);
    // Zweites Ereignis nach dem Unlock: darf weder crashen noch completed zurücksetzen.
    const outcomes = await checkCounterAchievements(userId, "boxesOpened", 11);
    expect(outcomes).toHaveLength(0);

    const entry = userAchievementStore.find((e) => e.userId.equals(userId))!;
    expect(entry.completed).toBe(true);
    expect(entry.progress).toBeGreaterThanOrEqual(10);
  });

  it("progress uses $max (never decreases)", async () => {
    addAchievement({
      key: "open_100_boxes",
      active: true,
      trigger: { type: "counter", params: { metric: "boxesOpened", target: 100 } },
    });
    const userId = new Types.ObjectId();
    await checkCounterAchievements(userId, "boxesOpened", 50);
    await checkCounterAchievements(userId, "boxesOpened", 30); // älterer counter-Wert
    const entry = userAchievementStore.find((e) => e.userId.equals(userId))!;
    expect(entry.progress).toBe(50);
  });

  it("only considers achievements matching the metric", async () => {
    addAchievement({
      key: "boxes_10",
      active: true,
      trigger: { type: "counter", params: { metric: "boxesOpened", target: 10 } },
    });
    addAchievement({
      key: "battles_10",
      active: true,
      trigger: { type: "counter", params: { metric: "battlesWon", target: 10 } },
    });

    const outcomes = await checkCounterAchievements(new Types.ObjectId(), "boxesOpened", 10);
    expect(outcomes.map((o) => o.achievementKey)).toEqual(["boxes_10"]);
  });
});

describe("checkOnceAchievement", () => {
  it("fires once for matching event", async () => {
    addAchievement({
      key: "first_pack",
      active: true,
      trigger: { type: "once", params: { event: "first_pack_opened" } },
    });
    const userId = new Types.ObjectId();
    const first = await checkOnceAchievement(userId, "first_pack_opened");
    const second = await checkOnceAchievement(userId, "first_pack_opened");
    expect(first).toHaveLength(1);
    expect(first[0].wasNewUnlock).toBe(true);
    expect(second).toHaveLength(0);
  });
});

describe("grantAchievementManually", () => {
  it("grants an active achievement with note and grantedBy", async () => {
    const achievement = addAchievement({
      key: "community_hero",
      active: true,
      trigger: { type: "manual", params: {} },
    });
    const userId = new Types.ObjectId();
    const admin = new Types.ObjectId();

    const outcome = await grantAchievementManually(userId, achievement._id, admin, "für den Podcast");
    expect(outcome?.wasNewUnlock).toBe(true);
    const entry = userAchievementStore.find((e) => e.userId.equals(userId));
    expect(entry?.grantedByUserId?.equals(admin)).toBe(true);
    expect(entry?.note).toBe("für den Podcast");
  });

  it("refuses inactive achievements", async () => {
    const achievement = addAchievement({
      key: "legacy",
      active: false,
      trigger: { type: "manual", params: {} },
    });
    const outcome = await grantAchievementManually(
      new Types.ObjectId(),
      achievement._id,
      new Types.ObjectId(),
    );
    expect(outcome).toBeNull();
  });
});

describe("unlockAchievement direct", () => {
  it("returns wasNewUnlock=false on repeat", async () => {
    const achievement = addAchievement({
      key: "x",
      active: true,
      trigger: { type: "manual", params: {} },
    });
    const userId = new Types.ObjectId();
    const first = await unlockAchievement(userId, achievement);
    const second = await unlockAchievement(userId, achievement);
    expect(first?.wasNewUnlock).toBe(true);
    expect(second?.wasNewUnlock).toBe(false);
  });

  it("preserves the original unlockedAt on repeat calls (audit trail)", async () => {
    const achievement = addAchievement({
      key: "once",
      active: true,
      trigger: { type: "manual", params: {} },
    });
    const userId = new Types.ObjectId();
    const first = await unlockAchievement(userId, achievement);
    const firstUnlock = userAchievementStore.find((e) => e.userId.equals(userId))!.unlockedAt;
    expect(firstUnlock).toBeInstanceOf(Date);

    await new Promise((r) => setTimeout(r, 5));
    await unlockAchievement(userId, achievement);
    const afterRetry = userAchievementStore.find((e) => e.userId.equals(userId))!.unlockedAt;
    expect(afterRetry?.getTime()).toBe(firstUnlock?.getTime());
    expect(first?.wasNewUnlock).toBe(true);
  });

  it("parallel unlocks for the same user+achievement only grant once", async () => {
    const achievement = addAchievement({
      key: "race",
      active: true,
      trigger: { type: "manual", params: {} },
    });
    const userId = new Types.ObjectId();
    const outcomes = await Promise.all([
      unlockAchievement(userId, achievement),
      unlockAchievement(userId, achievement),
      unlockAchievement(userId, achievement),
    ]);
    const newUnlocks = outcomes.filter((o) => o?.wasNewUnlock === true);
    expect(newUnlocks).toHaveLength(1);
    expect(userAchievementStore.filter((e) => e.userId.equals(userId))).toHaveLength(1);
  });
});
