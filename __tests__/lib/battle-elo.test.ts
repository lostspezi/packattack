import { describe, it, expect } from "vitest";
import { calculateEloChanges, getEloRank, getEloDivision, getKFactor, softResetElo } from "@/lib/battle-elo";

describe("getKFactor", () => {
  it("returns 25 for new players with < 20 battles", () => {
    expect(getKFactor(0)).toBe(25);
    expect(getKFactor(19)).toBe(25);
  });
  it("returns 15 for experienced players with 20-99 battles", () => {
    expect(getKFactor(20)).toBe(15);
    expect(getKFactor(99)).toBe(15);
  });
  it("returns 10 for veteran players with 100+ battles", () => {
    expect(getKFactor(100)).toBe(10);
    expect(getKFactor(500)).toBe(10);
  });
});

describe("getEloRank", () => {
  it("returns bronze for ELO < 1000", () => {
    expect(getEloRank(800).key).toBe("bronze");
    expect(getEloRank(999).key).toBe("bronze");
  });
  it("returns silver for ELO 1000-1199", () => {
    expect(getEloRank(1000).key).toBe("silver");
    expect(getEloRank(1199).key).toBe("silver");
  });
  it("returns gold for ELO 1200-1399", () => {
    expect(getEloRank(1200).key).toBe("gold");
    expect(getEloRank(1399).key).toBe("gold");
  });
  it("returns platin for ELO 1400-1599", () => {
    expect(getEloRank(1400).key).toBe("platin");
    expect(getEloRank(1599).key).toBe("platin");
  });
  it("returns diamond for ELO 1600-1799", () => {
    expect(getEloRank(1600).key).toBe("diamond");
    expect(getEloRank(1799).key).toBe("diamond");
  });
  it("returns champion for ELO >= 1800", () => {
    expect(getEloRank(1800).key).toBe("champion");
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

describe("calculateEloChanges (normalized)", () => {
  it("produces same magnitude change for 2-player and 4-player battles", () => {
    const twoPlayer = calculateEloChanges([
      { userId: "a", elo: 1000, totalBattles: 50, placement: 1 },
      { userId: "b", elo: 1000, totalBattles: 50, placement: 2 },
    ]);
    const fourPlayer = calculateEloChanges([
      { userId: "a", elo: 1000, totalBattles: 50, placement: 1 },
      { userId: "b", elo: 1000, totalBattles: 50, placement: 2 },
      { userId: "c", elo: 1000, totalBattles: 50, placement: 3 },
      { userId: "d", elo: 1000, totalBattles: 50, placement: 4 },
    ]);
    expect(Math.abs(twoPlayer.get("a")! - fourPlayer.get("a")!)).toBeLessThanOrEqual(3);
    expect(Math.abs(twoPlayer.get("b")! - fourPlayer.get("d")!)).toBeLessThanOrEqual(3);
  });

  it("max loss in 4-player battle with K=15 is around -8", () => {
    const result = calculateEloChanges([
      { userId: "a", elo: 1000, totalBattles: 50, placement: 1 },
      { userId: "b", elo: 1000, totalBattles: 50, placement: 2 },
      { userId: "c", elo: 1000, totalBattles: 50, placement: 3 },
      { userId: "d", elo: 1000, totalBattles: 50, placement: 4 },
    ]);
    expect(result.get("d")!).toBeGreaterThanOrEqual(-10);
    expect(result.get("d")!).toBeLessThan(0);
  });

  it("new player (K=25) loses at most ~13 in a 1v1 against equal opponent", () => {
    const result = calculateEloChanges([
      { userId: "a", elo: 1000, totalBattles: 0, placement: 1 },
      { userId: "b", elo: 1000, totalBattles: 0, placement: 2 },
    ]);
    expect(result.get("b")!).toBe(-13);
    expect(result.get("a")!).toBe(13);
  });
});

describe("getEloDivision", () => {
  it("returns correct division for Bronze IV", () => {
    expect(getEloDivision(800)).toBe("Bronze IV");
    expect(getEloDivision(849)).toBe("Bronze IV");
  });
  it("returns correct division for Bronze III", () => {
    expect(getEloDivision(850)).toBe("Bronze III");
  });
  it("returns correct division for Silver I", () => {
    expect(getEloDivision(1150)).toBe("Silver I");
    expect(getEloDivision(1199)).toBe("Silver I");
  });
  it("returns Champion without division", () => {
    expect(getEloDivision(1800)).toBe("Champion");
    expect(getEloDivision(2200)).toBe("Champion");
  });
});

describe("softResetElo", () => {
  it("resets toward 800 baseline", () => {
    expect(softResetElo(1600)).toBe(1200);
    expect(softResetElo(800)).toBe(800);
    expect(softResetElo(1000)).toBe(900);
  });
  it("never goes below floor", () => {
    expect(softResetElo(800)).toBeGreaterThanOrEqual(800);
  });
});
