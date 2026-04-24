import { describe, it, expect, vi, beforeEach } from "vitest";

const redisStore = new Map<string, string>();
let achievementExistsResult: boolean = false;
const findCalls: { calls: number } = { calls: 0 };

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

vi.mock("@/models/achievement", () => ({
  default: {
    exists: async () => {
      findCalls.calls++;
      return achievementExistsResult ? { _id: "fake" } : null;
    },
  },
}));

import { isLevelSystemActive, invalidateLevelSystemGate } from "@/lib/level/feature-gate";

beforeEach(() => {
  redisStore.clear();
  findCalls.calls = 0;
  achievementExistsResult = false;
});

describe("isLevelSystemActive", () => {
  it("returns false when no active achievement exists", async () => {
    achievementExistsResult = false;
    expect(await isLevelSystemActive()).toBe(false);
  });

  it("returns true when at least one active achievement exists", async () => {
    achievementExistsResult = true;
    expect(await isLevelSystemActive()).toBe(true);
  });

  it("caches the result so repeat calls do not hit the DB", async () => {
    achievementExistsResult = true;
    await isLevelSystemActive();
    await isLevelSystemActive();
    await isLevelSystemActive();
    expect(findCalls.calls).toBe(1);
  });

  it("caches false too — empty system should not requery every action", async () => {
    achievementExistsResult = false;
    await isLevelSystemActive();
    await isLevelSystemActive();
    expect(findCalls.calls).toBe(1);
  });

  it("invalidate forces a fresh DB lookup on next call", async () => {
    achievementExistsResult = false;
    await isLevelSystemActive();
    expect(findCalls.calls).toBe(1);

    await invalidateLevelSystemGate();
    achievementExistsResult = true;
    expect(await isLevelSystemActive()).toBe(true);
    expect(findCalls.calls).toBe(2);
  });
});
