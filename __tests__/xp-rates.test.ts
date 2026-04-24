import { describe, it, expect } from "vitest";
import {
  dayKey,
  isConsecutiveDay,
  XP_RATES,
  xpForPackPull,
} from "@/lib/level/xp-rates";

describe("xpForPackPull", () => {
  it("maps known rarities case-insensitively", () => {
    expect(xpForPackPull("common", 100)).toBe(2);
    expect(xpForPackPull("Rare", 1)).toBe(5);
    expect(xpForPackPull("legendary", 1)).toBe(25);
    expect(xpForPackPull("mythic", 10)).toBe(50);
  });

  it("falls back to coinValue bands for unknown rarity", () => {
    expect(xpForPackPull("holo-foil-ultra", 1)).toBe(1);
    expect(xpForPackPull("holo-foil-ultra", 12)).toBe(3);
    expect(xpForPackPull("holo-foil-ultra", 40)).toBe(8);
    expect(xpForPackPull("holo-foil-ultra", 75)).toBe(15);
    expect(xpForPackPull("holo-foil-ultra", 500)).toBe(25);
  });

  it("handles missing/invalid rarity gracefully", () => {
    expect(xpForPackPull(null, 12)).toBe(3);
    expect(xpForPackPull(undefined, 80)).toBe(15);
    expect(xpForPackPull("", 0)).toBe(1);
  });
});

describe("dayKey", () => {
  it("formats YYYY-MM-DD", () => {
    const d = new Date(2026, 3, 24, 14, 30, 0); // 2026-04-24 local
    expect(dayKey(d)).toBe("2026-04-24");
  });
  it("zero-pads month and day", () => {
    const d = new Date(2026, 0, 5, 0, 0, 0);
    expect(dayKey(d)).toBe("2026-01-05");
  });
});

describe("isConsecutiveDay", () => {
  it("true for yesterday→today", () => {
    expect(isConsecutiveDay("2026-04-23", "2026-04-24")).toBe(true);
  });
  it("false for same day", () => {
    expect(isConsecutiveDay("2026-04-24", "2026-04-24")).toBe(false);
  });
  it("false for 2-day gap", () => {
    expect(isConsecutiveDay("2026-04-22", "2026-04-24")).toBe(false);
  });
  it("false when prev is null", () => {
    expect(isConsecutiveDay(null, "2026-04-24")).toBe(false);
  });
  it("true across month boundary", () => {
    expect(isConsecutiveDay("2026-03-31", "2026-04-01")).toBe(true);
  });
});

describe("XP_RATES constants are sane", () => {
  it("battle win > participate", () => {
    expect(XP_RATES.BATTLE_WIN).toBeGreaterThan(XP_RATES.BATTLE_PARTICIPATE);
  });
  it("login streak bonus triggers weekly", () => {
    expect(XP_RATES.LOGIN_STREAK_BONUS_DAYS).toBe(7);
    expect(XP_RATES.LOGIN_STREAK_BONUS_XP).toBeGreaterThan(XP_RATES.LOGIN_DAILY);
  });
});
