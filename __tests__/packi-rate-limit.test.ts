import { describe, it, expect, vi, beforeEach } from "vitest";

// Stateful in-memory Redis used by the mock of @/lib/redis below.
type Stored = { value: number; expiresAt: number | null };
const store = new Map<string, Stored>();

vi.mock("@/lib/redis", () => ({
  runRedisCommand: async <T>(
    _label: string,
    _fallback: T,
    command: (redis: unknown) => Promise<T>,
  ) => {
    const fakeRedis = {
      eval: async (
        _script: string,
        _numKeys: number,
        key: string,
        ttlSeconds: string,
      ) => {
        const existing = store.get(key);
        const nextValue = (existing?.value ?? 0) + 1;
        const expiresAt = existing?.expiresAt ?? Date.now() + Number(ttlSeconds) * 1000;
        store.set(key, { value: nextValue, expiresAt });
        return nextValue;
      },
    };
    return command(fakeRedis);
  },
}));

// Import AFTER vi.mock so the mocked module is used.
import {
  assertPackiMessageAllowed,
  PACKI_DAILY_LIMIT,
} from "@/lib/packi/rate-limit";

beforeEach(() => {
  store.clear();
});

describe("assertPackiMessageAllowed", () => {
  it("allows the first message and reports remaining budget", async () => {
    const result = await assertPackiMessageAllowed("user-1");
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(1);
    expect(result.limit).toBe(PACKI_DAILY_LIMIT);
    expect(result.remaining).toBe(PACKI_DAILY_LIMIT - 1);
    expect(result.retryAfterSeconds).toBe(0);
  });

  it("tracks multiple messages from the same user on the same day", async () => {
    for (let i = 1; i <= 5; i++) {
      const result = await assertPackiMessageAllowed("user-2");
      expect(result.allowed).toBe(true);
      expect(result.used).toBe(i);
      expect(result.remaining).toBe(PACKI_DAILY_LIMIT - i);
    }
  });

  it("denies the message that exceeds the daily limit", async () => {
    let last = await assertPackiMessageAllowed("user-3");
    for (let i = 0; i < PACKI_DAILY_LIMIT - 1; i++) {
      last = await assertPackiMessageAllowed("user-3");
    }
    expect(last.allowed).toBe(true);
    expect(last.used).toBe(PACKI_DAILY_LIMIT);

    const over = await assertPackiMessageAllowed("user-3");
    expect(over.allowed).toBe(false);
    expect(over.used).toBe(PACKI_DAILY_LIMIT + 1);
    expect(over.remaining).toBe(0);
    expect(over.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("separates counters by user", async () => {
    for (let i = 0; i < PACKI_DAILY_LIMIT; i++) {
      await assertPackiMessageAllowed("user-heavy");
    }
    const blocked = await assertPackiMessageAllowed("user-heavy");
    expect(blocked.allowed).toBe(false);

    const freshUser = await assertPackiMessageAllowed("user-fresh");
    expect(freshUser.allowed).toBe(true);
    expect(freshUser.used).toBe(1);
  });

  it("separates counters by UTC day", async () => {
    const day1 = new Date("2026-04-23T12:00:00Z");
    const day2 = new Date("2026-04-24T01:00:00Z");

    const a = await assertPackiMessageAllowed("user-days", day1);
    const b = await assertPackiMessageAllowed("user-days", day1);
    const c = await assertPackiMessageAllowed("user-days", day2);

    expect(a.used).toBe(1);
    expect(b.used).toBe(2);
    expect(c.used).toBe(1); // fresh counter for day 2
  });
});
