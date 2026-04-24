import { describe, it, expect } from "vitest";
import {
  BASE_XP,
  EXPONENT,
  LEVEL_MILESTONES,
  MAX_LEVEL,
  isLevelMilestone,
  levelForTotalXp,
  progressInLevel,
  totalXpForLevel,
  xpForLevelUp,
  xpIntoLevel,
  xpToNextLevel,
} from "@/lib/level/config";

describe("xpForLevelUp", () => {
  it("level 1 requires BASE_XP XP to advance", () => {
    expect(xpForLevelUp(1)).toBe(BASE_XP);
  });

  it("matches BASE_XP * level^EXPONENT rounded", () => {
    for (const level of [2, 5, 10, 25, 50, 99]) {
      expect(xpForLevelUp(level)).toBe(Math.round(BASE_XP * Math.pow(level, EXPONENT)));
    }
  });

  it("max level cannot advance further", () => {
    expect(xpForLevelUp(MAX_LEVEL)).toBe(Number.POSITIVE_INFINITY);
  });

  it("returns 0 for invalid inputs", () => {
    expect(xpForLevelUp(0)).toBe(0);
    expect(xpForLevelUp(-5)).toBe(0);
    expect(xpForLevelUp(Number.NaN)).toBe(0);
  });

  it("is strictly increasing across the curve", () => {
    for (let level = 1; level < MAX_LEVEL - 1; level++) {
      expect(xpForLevelUp(level + 1)).toBeGreaterThan(xpForLevelUp(level));
    }
  });
});

describe("totalXpForLevel", () => {
  it("level 1 starts at 0 total XP", () => {
    expect(totalXpForLevel(1)).toBe(0);
  });

  it("level 2 equals xpForLevelUp(1)", () => {
    expect(totalXpForLevel(2)).toBe(xpForLevelUp(1));
  });

  it("level N equals sum of xpForLevelUp(1..N-1)", () => {
    for (const target of [3, 10, 25, 50, MAX_LEVEL]) {
      let sum = 0;
      for (let i = 1; i < target; i++) sum += xpForLevelUp(i);
      expect(totalXpForLevel(target)).toBe(sum);
    }
  });

  it("is monotonic", () => {
    for (let level = 1; level < MAX_LEVEL; level++) {
      expect(totalXpForLevel(level + 1)).toBeGreaterThan(totalXpForLevel(level));
    }
  });
});

describe("levelForTotalXp", () => {
  it("0 XP maps to level 1", () => {
    expect(levelForTotalXp(0)).toBe(1);
  });

  it("exact threshold snaps to the new level", () => {
    for (const target of [2, 3, 10, 25, 50, MAX_LEVEL]) {
      expect(levelForTotalXp(totalXpForLevel(target))).toBe(target);
    }
  });

  it("one XP below threshold stays at previous level", () => {
    for (const target of [2, 3, 10, 25, 50]) {
      expect(levelForTotalXp(totalXpForLevel(target) - 1)).toBe(target - 1);
    }
  });

  it("very high XP caps at MAX_LEVEL", () => {
    expect(levelForTotalXp(1e12)).toBe(MAX_LEVEL);
  });

  it("negative or NaN XP returns level 1", () => {
    expect(levelForTotalXp(-100)).toBe(1);
    expect(levelForTotalXp(Number.NaN)).toBe(1);
  });
});

describe("xpIntoLevel and xpToNextLevel", () => {
  it("progress is 0 exactly at level threshold", () => {
    for (const target of [2, 5, 10, 50]) {
      expect(xpIntoLevel(totalXpForLevel(target))).toBe(0);
    }
  });

  it("xpToNextLevel decreases to 1 just before next level", () => {
    const level = 5;
    const totalAt = totalXpForLevel(level);
    const needed = xpForLevelUp(level);
    expect(xpToNextLevel(totalAt)).toBe(needed);
    expect(xpToNextLevel(totalAt + needed - 1)).toBe(1);
  });

  it("max level reports 0 XP to next", () => {
    expect(xpToNextLevel(totalXpForLevel(MAX_LEVEL))).toBe(0);
    expect(xpToNextLevel(totalXpForLevel(MAX_LEVEL) + 500)).toBe(0);
  });
});

describe("progressInLevel", () => {
  it("returns 0 at level threshold", () => {
    for (const target of [2, 10, 50]) {
      expect(progressInLevel(totalXpForLevel(target))).toBe(0);
    }
  });

  it("returns between 0 and 1 in the middle of a level", () => {
    const totalAtLvl3 = totalXpForLevel(3);
    const needed = xpForLevelUp(3);
    const progress = progressInLevel(totalAtLvl3 + Math.floor(needed / 2));
    expect(progress).toBeGreaterThan(0.4);
    expect(progress).toBeLessThan(0.6);
  });

  it("caps at 1 for max level", () => {
    expect(progressInLevel(totalXpForLevel(MAX_LEVEL))).toBe(1);
  });
});

describe("isLevelMilestone", () => {
  it("recognises defined milestones", () => {
    for (const level of LEVEL_MILESTONES) {
      expect(isLevelMilestone(level)).toBe(true);
    }
  });

  it("returns false for non-milestones", () => {
    for (const level of [1, 2, 9, 11, 24, 26, 49, 51, 99]) {
      expect(isLevelMilestone(level)).toBe(false);
    }
  });
});
