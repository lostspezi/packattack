import { describe, it, expect } from "vitest";
import {
  evaluateRound,
  evaluateBattle,
} from "@/lib/battle-engine";
import type { IVirtualCard } from "@/models/battle";
import { Types } from "mongoose";

// ---------- Helpers ----------

function makeVCard(coinValue: number, name = "Card"): IVirtualCard {
  return {
    cardId: new Types.ObjectId(),
    name,
    image: "",
    rarity: "Common",
    coinValue,
    conversionValue: 0,
    pullId: null,
  };
}

// ---------- evaluateRound ----------

describe("evaluateRound", () => {
  const p1 = new Types.ObjectId();
  const p2 = new Types.ObjectId();

  describe("highest_card mode", () => {
    it("player with highest coinValue wins", () => {
      const selections = [
        { player: p1, card: makeVCard(50, "A") },
        { player: p2, card: makeVCard(30, "B") },
      ];
      const result = evaluateRound(selections, "highest_card");
      expect(result.winner?.toString()).toBe(p1.toString());
    });

    it("returns null winner on tie for highest", () => {
      const selections = [
        { player: p1, card: makeVCard(50, "A") },
        { player: p2, card: makeVCard(50, "B") },
      ];
      const result = evaluateRound(selections, "highest_card");
      expect(result.winner).toBeNull();
    });

    it("works with 3+ players", () => {
      const p3 = new Types.ObjectId();
      const selections = [
        { player: p1, card: makeVCard(10, "A") },
        { player: p2, card: makeVCard(99, "B") },
        { player: p3, card: makeVCard(50, "C") },
      ];
      const result = evaluateRound(selections, "highest_card");
      expect(result.winner?.toString()).toBe(p2.toString());
    });

    it("tie among 3 players with same max value returns null", () => {
      const p3 = new Types.ObjectId();
      const selections = [
        { player: p1, card: makeVCard(50, "A") },
        { player: p2, card: makeVCard(50, "B") },
        { player: p3, card: makeVCard(30, "C") },
      ];
      const result = evaluateRound(selections, "highest_card");
      expect(result.winner).toBeNull();
    });
  });

  describe("lowest_card mode", () => {
    it("player with lowest coinValue wins", () => {
      const selections = [
        { player: p1, card: makeVCard(50, "A") },
        { player: p2, card: makeVCard(30, "B") },
      ];
      const result = evaluateRound(selections, "lowest_card");
      expect(result.winner?.toString()).toBe(p2.toString());
    });

    it("returns null winner on tie for lowest", () => {
      const selections = [
        { player: p1, card: makeVCard(20, "A") },
        { player: p2, card: makeVCard(20, "B") },
      ];
      const result = evaluateRound(selections, "lowest_card");
      expect(result.winner).toBeNull();
    });

    it("works with 3+ players, smallest wins", () => {
      const p3 = new Types.ObjectId();
      const selections = [
        { player: p1, card: makeVCard(10, "A") },
        { player: p2, card: makeVCard(99, "B") },
        { player: p3, card: makeVCard(50, "C") },
      ];
      const result = evaluateRound(selections, "lowest_card");
      expect(result.winner?.toString()).toBe(p1.toString());
    });
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
