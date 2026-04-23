import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory mock for @/lib/redis. Tracks SET/GET/DEL used by session.ts.
type Stored = { value: string };
const store = new Map<string, Stored>();
const failNext = { value: false };

vi.mock("@/lib/redis", () => ({
  runRedisCommand: async <T>(
    _label: string,
    fallback: T,
    command: (redis: unknown) => Promise<T>,
  ) => {
    if (failNext.value) {
      failNext.value = false;
      return fallback;
    }
    const fakeRedis = {
      get: async (key: string) => store.get(key)?.value ?? null,
      set: async (...args: unknown[]) => {
        const [key, value] = args;
        store.set(key as string, { value: value as string });
        return "OK";
      },
      del: async (key: string) => {
        const existed = store.delete(key);
        return existed ? 1 : 0;
      },
    };
    return command(fakeRedis);
  },
}));

import {
  loadPackiSession,
  appendPackiTurns,
  clearPackiSession,
  PACKI_SESSION_MAX_TURNS,
  type PackiTurn,
} from "@/lib/packi/session";

beforeEach(() => {
  store.clear();
  failNext.value = false;
});

const turn = (role: PackiTurn["role"], content: string, ts = 1): PackiTurn => ({
  role,
  content,
  ts,
});

describe("loadPackiSession", () => {
  it("returns empty array for a new user", async () => {
    expect(await loadPackiSession("new-user")).toEqual([]);
  });

  it("returns previously appended turns", async () => {
    await appendPackiTurns("user-a", [], [turn("user", "hi", 1)]);
    const loaded = await loadPackiSession("user-a");
    expect(loaded).toEqual([turn("user", "hi", 1)]);
  });

  it("returns empty array on Redis failure", async () => {
    failNext.value = true;
    expect(await loadPackiSession("any")).toEqual([]);
  });

  it("filters out malformed turns from storage", async () => {
    store.set("packi:session:corrupt-user", {
      value: JSON.stringify([
        turn("user", "valid", 1),
        { role: "unknown", content: "bad", ts: 2 },
        { role: "user", ts: 3 },
        null,
        turn("assistant", "also valid", 4),
      ]),
    });
    const loaded = await loadPackiSession("corrupt-user");
    expect(loaded).toEqual([
      turn("user", "valid", 1),
      turn("assistant", "also valid", 4),
    ]);
  });
});

describe("appendPackiTurns", () => {
  it("returns the combined turn array", async () => {
    const prior = [turn("user", "a", 1)];
    const added = [turn("assistant", "b", 2)];
    const result = await appendPackiTurns("user-b", prior, added);
    expect(result).toEqual([...prior, ...added]);
  });

  it("trims to PACKI_SESSION_MAX_TURNS, keeping the most recent", async () => {
    const prior = Array.from({ length: PACKI_SESSION_MAX_TURNS }, (_, i) =>
      turn("user", `p${i}`, i),
    );
    const added = [turn("assistant", "newest", 999)];
    const result = await appendPackiTurns("user-c", prior, added);
    expect(result).toHaveLength(PACKI_SESSION_MAX_TURNS);
    expect(result[result.length - 1]).toEqual(turn("assistant", "newest", 999));
    expect(result[0].content).toBe("p1"); // oldest p0 was dropped
  });

  it("persists the trimmed window for subsequent loads", async () => {
    await appendPackiTurns("user-d", [], [turn("user", "first", 1)]);
    await appendPackiTurns(
      "user-d",
      await loadPackiSession("user-d"),
      [turn("assistant", "second", 2)],
    );
    const loaded = await loadPackiSession("user-d");
    expect(loaded.map((t) => t.content)).toEqual(["first", "second"]);
  });
});

describe("clearPackiSession", () => {
  it("deletes the stored session so subsequent loads return empty", async () => {
    await appendPackiTurns("user-e", [], [turn("user", "temp", 1)]);
    expect(await loadPackiSession("user-e")).toHaveLength(1);
    await clearPackiSession("user-e");
    expect(await loadPackiSession("user-e")).toEqual([]);
  });
});
