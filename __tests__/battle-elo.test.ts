import { describe, it, expect } from "vitest";
import { calculateEloChanges, getRank, type EloPlayer } from "@/lib/battle-elo";

describe("calculateEloChanges", () => {
  it("winner gains, loser loses ELO (2 players)", () => {
    const players: EloPlayer[] = [
      { id: "p1", elo: 1000, totalBattles: 50 },
      { id: "p2", elo: 1000, totalBattles: 50 },
    ];

    const result = calculateEloChanges(players, "p1");

    const p1Change = result.find((r) => r.id === "p1")!;
    const p2Change = result.find((r) => r.id === "p2")!;

    expect(p1Change.change).toBeGreaterThan(0);
    expect(p2Change.change).toBeLessThan(0);
    // Zero-sum: changes should roughly cancel out
    expect(Math.abs(p1Change.change + p2Change.change)).toBeLessThan(1);
  });

  it("uses higher K-factor for new players (<30 battles)", () => {
    const newPlayer: EloPlayer[] = [
      { id: "new", elo: 1000, totalBattles: 5 },
      { id: "exp", elo: 1000, totalBattles: 100 },
    ];

    const result = calculateEloChanges(newPlayer, "new");
    const newChange = result.find((r) => r.id === "new")!;

    // New player K=40, experienced K=20
    // At equal ELO, expected=0.5, actual=1 for winner
    // Change = K * (1 - 0.5) = K * 0.5
    expect(newChange.change).toBeCloseTo(20, 0); // K=40, 40*0.5=20
  });

  it("underdog gains more when winning against higher ELO", () => {
    const players: EloPlayer[] = [
      { id: "underdog", elo: 800, totalBattles: 50 },
      { id: "favorite", elo: 1200, totalBattles: 50 },
    ];

    const result = calculateEloChanges(players, "underdog");
    const underdogChange = result.find((r) => r.id === "underdog")!;

    // Underdog beating favorite should gain a lot
    expect(underdogChange.change).toBeGreaterThan(15);
  });

  it("favorite gains less when winning against lower ELO", () => {
    const players: EloPlayer[] = [
      { id: "favorite", elo: 1200, totalBattles: 50 },
      { id: "underdog", elo: 800, totalBattles: 50 },
    ];

    const result = calculateEloChanges(players, "favorite");
    const favoriteChange = result.find((r) => r.id === "favorite")!;

    // Favorite beating underdog should gain little
    expect(favoriteChange.change).toBeLessThan(5);
  });

  it("handles 3-player battle", () => {
    const players: EloPlayer[] = [
      { id: "p1", elo: 1000, totalBattles: 50 },
      { id: "p2", elo: 1000, totalBattles: 50 },
      { id: "p3", elo: 1000, totalBattles: 50 },
    ];

    const result = calculateEloChanges(players, "p1");
    const p1 = result.find((r) => r.id === "p1")!;
    const p2 = result.find((r) => r.id === "p2")!;
    const p3 = result.find((r) => r.id === "p3")!;

    expect(p1.change).toBeGreaterThan(0);
    expect(p2.change).toBeLessThan(0);
    expect(p3.change).toBeLessThan(0);
    // Roughly zero-sum
    expect(Math.abs(p1.change + p2.change + p3.change)).toBeLessThan(2);
  });

  it("all newElo values are at least 0", () => {
    const players: EloPlayer[] = [
      { id: "low", elo: 5, totalBattles: 50 },
      { id: "high", elo: 1500, totalBattles: 50 },
    ];

    const result = calculateEloChanges(players, "high");
    for (const r of result) {
      expect(r.newElo).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("getRank", () => {
  it("returns correct ranks", () => {
    expect(getRank(500)).toBe("Bronze");
    expect(getRank(999)).toBe("Bronze");
    expect(getRank(1000)).toBe("Silver");
    expect(getRank(1199)).toBe("Silver");
    expect(getRank(1200)).toBe("Gold");
    expect(getRank(1399)).toBe("Gold");
    expect(getRank(1400)).toBe("Diamond");
    expect(getRank(1599)).toBe("Diamond");
    expect(getRank(1600)).toBe("Champion");
    expect(getRank(2000)).toBe("Champion");
  });
});
