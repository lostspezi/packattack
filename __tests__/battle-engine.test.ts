import { describe, it, expect } from "vitest";
import {
  generateBattleHand,
  evaluateRound,
  evaluateBattle,
  type BoxCardForBattle,
} from "@/lib/battle-engine";
import { Types } from "mongoose";

// ---------- Helpers ----------

function makeCard(coinValue: number, name?: string): BoxCardForBattle {
  return {
    cardId: new Types.ObjectId(),
    name: name ?? `Card-${coinValue}`,
    image: `/images/card-${coinValue}.jpg`,
    rarity: coinValue >= 200 ? "Rare" : coinValue >= 50 ? "Uncommon" : "Common",
    coinValue,
    weight: 1,
  };
}

function makeBoxCards(): BoxCardForBattle[] {
  // Simulate a realistic box: mostly low value, some medium, few high
  const cards: BoxCardForBattle[] = [];

  // Tier 1 (1-10): 40 cards
  for (let i = 0; i < 40; i++) cards.push(makeCard(1 + Math.floor(Math.random() * 10)));
  // Tier 2 (11-50): 15 cards
  for (let i = 0; i < 15; i++) cards.push(makeCard(11 + Math.floor(Math.random() * 40)));
  // Tier 3 (51-200): 8 cards
  for (let i = 0; i < 8; i++) cards.push(makeCard(51 + Math.floor(Math.random() * 150)));
  // Tier 4 (200+): 4 cards
  for (let i = 0; i < 4; i++) cards.push(makeCard(200 + Math.floor(Math.random() * 300)));

  return cards;
}

// ---------- generateBattleHand ----------

describe("generateBattleHand", () => {
  it("returns exactly 5 cards", () => {
    const hand = generateBattleHand(makeBoxCards());
    expect(hand).toHaveLength(5);
  });

  it("each card has required fields", () => {
    const hand = generateBattleHand(makeBoxCards());
    for (const card of hand) {
      expect(card.cardId).toBeDefined();
      expect(card.name).toBeTruthy();
      expect(card.image).toBeTruthy();
      expect(card.rarity).toBeTruthy();
      expect(typeof card.coinValue).toBe("number");
      expect(card.coinValue).toBeGreaterThan(0);
    }
  });

  it("distributes cards across tiers (2 low, 1 mid, 1 high, 1 premium)", () => {
    const boxCards = makeBoxCards();
    // Run multiple times to verify distribution pattern
    for (let run = 0; run < 20; run++) {
      const hand = generateBattleHand(boxCards);
      const tier1 = hand.filter((c) => c.coinValue >= 1 && c.coinValue <= 10);
      const tier2 = hand.filter((c) => c.coinValue >= 11 && c.coinValue <= 50);
      const tier3 = hand.filter((c) => c.coinValue >= 51 && c.coinValue <= 200);
      const tier4 = hand.filter((c) => c.coinValue > 200);

      expect(tier1.length).toBe(2);
      expect(tier2.length).toBe(1);
      expect(tier3.length).toBe(1);
      expect(tier4.length).toBe(1);
    }
  });

  it("handles fallback when a tier has no cards", () => {
    // Box with only low and high value cards (no medium)
    const cards: BoxCardForBattle[] = [];
    for (let i = 0; i < 30; i++) cards.push(makeCard(1));
    for (let i = 0; i < 10; i++) cards.push(makeCard(300));
    // No tier 2 (11-50) or tier 3 (51-200) cards

    const hand = generateBattleHand(cards);
    expect(hand).toHaveLength(5);
  });

  it("returns different hands on successive calls (randomness)", () => {
    const boxCards = makeBoxCards();
    const hands = Array.from({ length: 10 }, () => generateBattleHand(boxCards));
    const uniqueSignatures = new Set(hands.map((h) => h.map((c) => c.cardId.toString()).join(",")));
    // At least some variety expected
    expect(uniqueSignatures.size).toBeGreaterThan(1);
  });

  it("throws when box has fewer than 5 cards total", () => {
    const cards = [makeCard(1), makeCard(2), makeCard(3)];
    expect(() => generateBattleHand(cards)).toThrow();
  });
});

// ---------- evaluateRound ----------

describe("evaluateRound", () => {
  const p1 = new Types.ObjectId();
  const p2 = new Types.ObjectId();

  it("player with highest coinValue wins", () => {
    const selections = [
      { player: p1, card: { cardId: new Types.ObjectId(), name: "A", image: "", rarity: "Common", coinValue: 50 } },
      { player: p2, card: { cardId: new Types.ObjectId(), name: "B", image: "", rarity: "Common", coinValue: 30 } },
    ];
    const result = evaluateRound(selections);
    expect(result.winner?.toString()).toBe(p1.toString());
  });

  it("returns null winner on tie", () => {
    const selections = [
      { player: p1, card: { cardId: new Types.ObjectId(), name: "A", image: "", rarity: "Common", coinValue: 50 } },
      { player: p2, card: { cardId: new Types.ObjectId(), name: "B", image: "", rarity: "Common", coinValue: 50 } },
    ];
    const result = evaluateRound(selections);
    expect(result.winner).toBeNull();
  });

  it("works with 3+ players", () => {
    const p3 = new Types.ObjectId();
    const selections = [
      { player: p1, card: { cardId: new Types.ObjectId(), name: "A", image: "", rarity: "Common", coinValue: 10 } },
      { player: p2, card: { cardId: new Types.ObjectId(), name: "B", image: "", rarity: "Common", coinValue: 99 } },
      { player: p3, card: { cardId: new Types.ObjectId(), name: "C", image: "", rarity: "Common", coinValue: 50 } },
    ];
    const result = evaluateRound(selections);
    expect(result.winner?.toString()).toBe(p2.toString());
  });

  it("tie among 3 players with same max value returns null", () => {
    const p3 = new Types.ObjectId();
    const selections = [
      { player: p1, card: { cardId: new Types.ObjectId(), name: "A", image: "", rarity: "Common", coinValue: 50 } },
      { player: p2, card: { cardId: new Types.ObjectId(), name: "B", image: "", rarity: "Common", coinValue: 50 } },
      { player: p3, card: { cardId: new Types.ObjectId(), name: "C", image: "", rarity: "Common", coinValue: 30 } },
    ];
    const result = evaluateRound(selections);
    expect(result.winner).toBeNull();
  });
});

// ---------- evaluateBattle ----------

describe("evaluateBattle", () => {
  const p1 = new Types.ObjectId();
  const p2 = new Types.ObjectId();

  it("player with most round wins is the winner", () => {
    const roundWins = new Map<string, number>();
    roundWins.set(p1.toString(), 3);
    roundWins.set(p2.toString(), 2);

    const result = evaluateBattle(roundWins);
    expect(result.winner?.toString()).toBe(p1.toString());
    expect(result.needsSuddenDeath).toBe(false);
  });

  it("flags sudden death when tied", () => {
    const roundWins = new Map<string, number>();
    roundWins.set(p1.toString(), 2);
    roundWins.set(p2.toString(), 2);

    const result = evaluateBattle(roundWins);
    expect(result.winner).toBeNull();
    expect(result.needsSuddenDeath).toBe(true);
  });

  it("handles 3-player battle with clear winner", () => {
    const p3 = new Types.ObjectId();
    const roundWins = new Map<string, number>();
    roundWins.set(p1.toString(), 1);
    roundWins.set(p2.toString(), 4);
    roundWins.set(p3.toString(), 2);

    const result = evaluateBattle(roundWins);
    expect(result.winner?.toString()).toBe(p2.toString());
    expect(result.needsSuddenDeath).toBe(false);
  });

  it("flags sudden death when multiple players tied for first", () => {
    const p3 = new Types.ObjectId();
    const roundWins = new Map<string, number>();
    roundWins.set(p1.toString(), 3);
    roundWins.set(p2.toString(), 3);
    roundWins.set(p3.toString(), 1);

    const result = evaluateBattle(roundWins);
    expect(result.winner).toBeNull();
    expect(result.needsSuddenDeath).toBe(true);
    expect(result.tiedPlayers).toHaveLength(2);
  });

  it("identifies clear winner even when others are tied", () => {
    const p3 = new Types.ObjectId();
    const roundWins = new Map<string, number>();
    roundWins.set(p1.toString(), 5);
    roundWins.set(p2.toString(), 1);
    roundWins.set(p3.toString(), 1);

    const result = evaluateBattle(roundWins);
    expect(result.winner?.toString()).toBe(p1.toString());
    expect(result.needsSuddenDeath).toBe(false);
  });
});
