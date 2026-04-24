import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types } from "mongoose";

interface FakeUser {
  _id: Types.ObjectId;
  coins: number;
}
const users = new Map<string, FakeUser>();
const coinTransactions: Array<{ userId: string; amount: number; type: string; reason: string | null }> = [];
const achievementsById = new Map<
  string,
  { _id: Types.ObjectId; key: string; rewards: Array<{ type: string; params: Record<string, unknown> }> }
>();
const badgeGrants: Array<{ userId: string; badgeKey: string; awardReason: string | null }> = [];

vi.mock("@/lib/db", () => ({
  default: async () => undefined,
  connectDB: async () => undefined,
}));

vi.mock("@/models/user", () => ({
  default: {
    updateOne: async (filter: { _id: string }, update: { $inc?: { coins?: number } }) => {
      const u = users.get(filter._id.toString());
      if (!u) return { modifiedCount: 0 };
      if (update.$inc?.coins) u.coins += update.$inc.coins;
      return { modifiedCount: 1 };
    },
  },
}));

vi.mock("@/models/coin-transaction", () => ({
  default: {
    create: async (doc: {
      userId: string;
      amount: number;
      type: string;
      reason?: string | null;
    }) => {
      coinTransactions.push({
        userId: doc.userId.toString(),
        amount: doc.amount,
        type: doc.type,
        reason: doc.reason ?? null,
      });
      return doc;
    },
  },
}));

vi.mock("@/models/achievement", () => ({
  default: {
    findById: (id: Types.ObjectId | string) => ({
      select: () => ({
        lean: async () => achievementsById.get(id.toString()) ?? null,
      }),
    }),
    findOne: () => ({
      select: () => ({ lean: async () => null }),
    }),
  },
}));

vi.mock("@/lib/badges", () => ({
  grantBadgeToUser: async (input: {
    userId: string;
    badgeKey: string;
    awardReason?: string | null;
  }) => {
    badgeGrants.push({
      userId: input.userId,
      badgeKey: input.badgeKey,
      awardReason: input.awardReason ?? null,
    });
    return { _id: new Types.ObjectId(), key: input.badgeKey };
  },
}));

vi.mock("@/lib/achievements/effects", () => ({
  invalidateUserEffects: vi.fn(async () => undefined),
}));

import { applyReward, applyRewardsForUnlock } from "@/lib/achievements/rewards";
import { invalidateUserEffects } from "@/lib/achievements/effects";

beforeEach(() => {
  users.clear();
  coinTransactions.length = 0;
  achievementsById.clear();
  badgeGrants.length = 0;
  vi.mocked(invalidateUserEffects).mockClear();
});

describe("applyReward", () => {
  it("credits coins and records an achievement_reward transaction", async () => {
    const user: FakeUser = { _id: new Types.ObjectId(), coins: 100 };
    users.set(user._id.toString(), user);
    await applyReward(user._id, { type: "coins", params: { amount: 500 } }, "lvl_10");
    expect(user.coins).toBe(600);
    expect(coinTransactions).toHaveLength(1);
    expect(coinTransactions[0]).toMatchObject({ amount: 500, type: "achievement_reward" });
    expect(coinTransactions[0].reason).toContain("lvl_10");
  });

  it("ignores coins rewards with invalid amount", async () => {
    const user: FakeUser = { _id: new Types.ObjectId(), coins: 100 };
    users.set(user._id.toString(), user);
    await applyReward(user._id, { type: "coins", params: { amount: -5 } }, "bad");
    await applyReward(user._id, { type: "coins", params: { amount: Number.NaN } }, "bad");
    await applyReward(user._id, { type: "coins", params: {} }, "bad");
    expect(user.coins).toBe(100);
    expect(coinTransactions).toHaveLength(0);
  });

  it("grants a badge via the badges library", async () => {
    const userId = new Types.ObjectId();
    await applyReward(userId, { type: "grant_badge", params: { badgeKey: "beta_tester" } }, "event_a");
    expect(badgeGrants).toHaveLength(1);
    expect(badgeGrants[0].badgeKey).toBe("beta_tester");
    expect(badgeGrants[0].awardReason).toContain("event_a");
  });

  it("no-ops on passive reward types", async () => {
    const userId = new Types.ObjectId();
    await applyReward(userId, { type: "convert_multiplier", params: { multiplier: 1.1 } }, "k");
    await applyReward(userId, { type: "unlock_box", params: { boxSlug: "premium" } }, "k");
    await applyReward(userId, { type: "cosmetic", params: { slot: "title", value: "Legende" } }, "k");
    expect(coinTransactions).toHaveLength(0);
    expect(badgeGrants).toHaveLength(0);
  });

  it("swallows errors so one bad reward does not torpedo the rest", async () => {
    const userId = new Types.ObjectId();
    await applyReward(
      userId,
      { type: "grant_badge", params: { badgeKey: "" } },
      "k",
    );
    // no throw
    expect(badgeGrants).toHaveLength(0);
  });
});

describe("applyRewardsForUnlock", () => {
  it("runs every reward and invalidates the effect cache", async () => {
    const user: FakeUser = { _id: new Types.ObjectId(), coins: 0 };
    users.set(user._id.toString(), user);
    const ach = {
      _id: new Types.ObjectId(),
      key: "lvl_50",
      rewards: [
        { type: "coins", params: { amount: 250 } },
        { type: "convert_multiplier", params: { multiplier: 1.2 } },
        { type: "grant_badge", params: { badgeKey: "hero" } },
      ],
    };
    achievementsById.set(ach._id.toString(), ach);

    await applyRewardsForUnlock(user._id, ach._id);
    expect(user.coins).toBe(250);
    expect(badgeGrants[0].badgeKey).toBe("hero");
    expect(invalidateUserEffects).toHaveBeenCalledTimes(1);
  });

  it("no-ops when achievement missing", async () => {
    await applyRewardsForUnlock(new Types.ObjectId(), new Types.ObjectId());
    expect(coinTransactions).toHaveLength(0);
  });
});
