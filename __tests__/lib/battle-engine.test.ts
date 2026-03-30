import { describe, it, expect } from "vitest";
import { determineRoundWinner, snakeDraftDistribute, calculatePlacements, dealHands } from "@/lib/battle-engine";

describe("determineRoundWinner", () => {
  it("returns player with highest coinValue", () => {
    const cards = [
      { playerId: "a", coinValue: 10, rarity: "Common" },
      { playerId: "b", coinValue: 50, rarity: "Common" },
      { playerId: "c", coinValue: 30, rarity: "Common" },
    ];
    expect(determineRoundWinner(cards)).toBe("b");
  });

  it("breaks ties with rarity", () => {
    const cards = [
      { playerId: "a", coinValue: 50, rarity: "Common" },
      { playerId: "b", coinValue: 50, rarity: "Ultra Rare" },
    ];
    expect(determineRoundWinner(cards)).toBe("b");
  });

  it("returns a winner even when value and rarity are equal", () => {
    const cards = [
      { playerId: "a", coinValue: 50, rarity: "Common" },
      { playerId: "b", coinValue: 50, rarity: "Common" },
    ];
    const winner = determineRoundWinner(cards);
    expect(["a", "b"]).toContain(winner);
  });
});

describe("calculatePlacements", () => {
  it("ranks by score descending", () => {
    const players = [
      { userId: "a", score: 3, totalValue: 100 },
      { userId: "b", score: 5, totalValue: 80 },
      { userId: "c", score: 1, totalValue: 200 },
    ];
    const result = calculatePlacements(players);
    expect(result).toEqual([
      { userId: "b", placement: 1 },
      { userId: "a", placement: 2 },
      { userId: "c", placement: 3 },
    ]);
  });

  it("breaks score ties with totalValue", () => {
    const players = [
      { userId: "a", score: 3, totalValue: 100 },
      { userId: "b", score: 3, totalValue: 200 },
    ];
    const result = calculatePlacements(players);
    expect(result[0].userId).toBe("b");
    expect(result[1].userId).toBe("a");
  });
});

describe("snakeDraftDistribute", () => {
  it("distributes cards equally in snake order", () => {
    const cards = [
      { id: "c1", coinValue: 800 },
      { id: "c2", coinValue: 700 },
      { id: "c3", coinValue: 600 },
      { id: "c4", coinValue: 500 },
      { id: "c5", coinValue: 400 },
      { id: "c6", coinValue: 300 },
      { id: "c7", coinValue: 200 },
      { id: "c8", coinValue: 100 },
    ];
    const placements = ["p1", "p2", "p3", "p4"];

    const result = snakeDraftDistribute(cards, placements);

    // Snake: p1,p2,p3,p4,p4,p3,p2,p1
    expect(result.get("p1")!.map(c => c.id)).toEqual(["c1", "c8"]);
    expect(result.get("p2")!.map(c => c.id)).toEqual(["c2", "c7"]);
    expect(result.get("p3")!.map(c => c.id)).toEqual(["c3", "c6"]);
    expect(result.get("p4")!.map(c => c.id)).toEqual(["c4", "c5"]);
  });

  it("gives each player equal number of cards", () => {
    const cards = Array.from({ length: 12 }, (_, i) => ({
      id: `c${i}`,
      coinValue: 100 - i,
    }));
    const placements = ["a", "b", "c"];
    const result = snakeDraftDistribute(cards, placements);
    expect(result.get("a")!.length).toBe(4);
    expect(result.get("b")!.length).toBe(4);
    expect(result.get("c")!.length).toBe(4);
  });

  it("1st place gets highest total value", () => {
    const cards = Array.from({ length: 8 }, (_, i) => ({
      id: `c${i}`,
      coinValue: (8 - i) * 100,
    }));
    const placements = ["first", "second"];
    const result = snakeDraftDistribute(cards, placements);
    const firstTotal = result.get("first")!.reduce((s, c) => s + c.coinValue, 0);
    const secondTotal = result.get("second")!.reduce((s, c) => s + c.coinValue, 0);
    expect(firstTotal).toBeGreaterThanOrEqual(secondTotal);
  });
});

describe("dealHands", () => {
  const mockCards = Array.from({ length: 20 }, (_, i) => ({
    card: `card-${i}`,
    coinValue: (i + 1) * 0.5,
    rarity: i % 5 === 0 ? "Ultra Rare" : i % 3 === 0 ? "Rare" : "Common",
    name: `Card ${i}`,
    image: `/img/${i}.png`,
  }));

  it("deals HAND_SIZE cards to each player", () => {
    const hands = dealHands(mockCards, ["p1", "p2"]);
    expect(hands).toHaveLength(2);
    expect(hands[0].dealtCards).toHaveLength(5);
    expect(hands[1].dealtCards).toHaveLength(5);
  });

  it("assigns correct player to each hand", () => {
    const hands = dealHands(mockCards, ["p1", "p2"]);
    expect(hands[0].player).toBe("p1");
    expect(hands[1].player).toBe("p2");
  });

  it("sets selectedIndex to null for all hands", () => {
    const hands = dealHands(mockCards, ["p1", "p2"]);
    expect(hands[0].selectedIndex).toBeNull();
    expect(hands[1].selectedIndex).toBeNull();
  });

  it("does not give the same card to two players", () => {
    const hands = dealHands(mockCards, ["p1", "p2"]);
    const allCardIds = hands.flatMap(h => h.dealtCards.map(c => c.card));
    const unique = new Set(allCardIds);
    expect(unique.size).toBe(allCardIds.length);
  });

  it("works with 4 players (needs 20 cards)", () => {
    const hands = dealHands(mockCards, ["p1", "p2", "p3", "p4"]);
    expect(hands).toHaveLength(4);
    hands.forEach(h => expect(h.dealtCards).toHaveLength(5));
  });

  it("shuffles cards (not always same distribution)", () => {
    const results = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const hands = dealHands(mockCards, ["p1", "p2"]);
      results.add(hands[0].dealtCards.map(c => c.card).join(","));
    }
    expect(results.size).toBeGreaterThan(1);
  });
});
