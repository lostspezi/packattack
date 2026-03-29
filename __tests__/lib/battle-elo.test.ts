import { describe, it, expect } from "vitest";
import { calculateEloChanges, getEloRank, getKFactor } from "@/lib/battle-elo";

describe("getKFactor", () => {
  it("returns 40 for new players with < 30 battles", () => {
    expect(getKFactor(0)).toBe(40);
    expect(getKFactor(29)).toBe(40);
  });
  it("returns 20 for experienced players with >= 30 battles", () => {
    expect(getKFactor(30)).toBe(20);
    expect(getKFactor(100)).toBe(20);
  });
});

describe("getEloRank", () => {
  it("returns bronze for ELO < 1000", () => {
    expect(getEloRank(500).key).toBe("bronze");
  });
  it("returns silver for ELO 1000-1199", () => {
    expect(getEloRank(1000).key).toBe("silver");
    expect(getEloRank(1199).key).toBe("silver");
  });
  it("returns gold for ELO 1200-1399", () => {
    expect(getEloRank(1200).key).toBe("gold");
  });
  it("returns diamond for ELO 1400-1599", () => {
    expect(getEloRank(1400).key).toBe("diamond");
  });
  it("returns champion for ELO >= 1600", () => {
    expect(getEloRank(1600).key).toBe("champion");
    expect(getEloRank(2000).key).toBe("champion");
  });
});

describe("calculateEloChanges", () => {
  it("gives positive change to winner, negative to loser in 1v1", () => {
    const result = calculateEloChanges([
      { userId: "a", elo: 1000, totalBattles: 0, placement: 1 },
      { userId: "b", elo: 1000, totalBattles: 0, placement: 2 },
    ]);
    expect(result.get("a")!).toBeGreaterThan(0);
    expect(result.get("b")!).toBeLessThan(0);
  });

  it("sums to zero across all players", () => {
    const result = calculateEloChanges([
      { userId: "a", elo: 1200, totalBattles: 50, placement: 1 },
      { userId: "b", elo: 1000, totalBattles: 50, placement: 2 },
      { userId: "c", elo: 1100, totalBattles: 50, placement: 3 },
    ]);
    const sum = Array.from(result.values()).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum)).toBeLessThan(1);
  });

  it("gives more points for beating higher-rated opponents", () => {
    const upset = calculateEloChanges([
      { userId: "a", elo: 800, totalBattles: 50, placement: 1 },
      { userId: "b", elo: 1400, totalBattles: 50, placement: 2 },
    ]);
    const expected = calculateEloChanges([
      { userId: "a", elo: 1400, totalBattles: 50, placement: 1 },
      { userId: "b", elo: 800, totalBattles: 50, placement: 2 },
    ]);
    expect(upset.get("a")!).toBeGreaterThan(expected.get("a")!);
  });

  it("uses higher K-factor for new players", () => {
    const newPlayer = calculateEloChanges([
      { userId: "a", elo: 1000, totalBattles: 5, placement: 1 },
      { userId: "b", elo: 1000, totalBattles: 5, placement: 2 },
    ]);
    const expPlayer = calculateEloChanges([
      { userId: "a", elo: 1000, totalBattles: 50, placement: 1 },
      { userId: "b", elo: 1000, totalBattles: 50, placement: 2 },
    ]);
    expect(Math.abs(newPlayer.get("a")!)).toBeGreaterThan(Math.abs(expPlayer.get("a")!));
  });
});
