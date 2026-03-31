import { describe, it, expect } from "vitest";
import {
  distributeSnakeDraft,
  distributeByMode,
} from "@/lib/battle-distribution";
import type { IVirtualCard } from "@/models/battle";
import { Types } from "mongoose";

// ---------- Helpers ----------

function makeVCard(coinValue: number, name?: string): IVirtualCard {
  return {
    cardId: new Types.ObjectId(),
    name: name ?? `Card-${coinValue}`,
    image: `/images/card.jpg`,
    rarity: "Common",
    coinValue,
    conversionValue: 0,
    pullId: null,
  };
}

const p1 = new Types.ObjectId();
const p2 = new Types.ObjectId();
const p3 = new Types.ObjectId();
const p4 = new Types.ObjectId();

// ---------- Snake Draft ----------

describe("distributeSnakeDraft", () => {
  it("distributes cards in snake order for 2 players", () => {
    const cards = [100, 80, 60, 40, 20, 10].map((v) => makeVCard(v));
    const ranking = [p1.toString(), p2.toString()]; // p1 won

    const result = distributeSnakeDraft(cards, ranking);

    // Snake: P1, P2, P2, P1, P1, P2
    expect(result.get(p1.toString())!.map((c) => c.coinValue)).toEqual([100, 40, 20]);
    expect(result.get(p2.toString())!.map((c) => c.coinValue)).toEqual([80, 60, 10]);
  });

  it("distributes cards in snake order for 3 players", () => {
    const cards = [100, 80, 60, 40, 20, 10].map((v) => makeVCard(v));
    const ranking = [p1.toString(), p2.toString(), p3.toString()];

    const result = distributeSnakeDraft(cards, ranking);

    // Snake: P1, P2, P3, P3, P2, P1
    expect(result.get(p1.toString())!.map((c) => c.coinValue)).toEqual([100, 10]);
    expect(result.get(p2.toString())!.map((c) => c.coinValue)).toEqual([80, 20]);
    expect(result.get(p3.toString())!.map((c) => c.coinValue)).toEqual([60, 40]);
  });

  it("distributes cards in snake order for 4 players", () => {
    const cards = [100, 80, 60, 40, 20, 10, 8, 5].map((v) => makeVCard(v));
    const ranking = [p1.toString(), p2.toString(), p3.toString(), p4.toString()];

    const result = distributeSnakeDraft(cards, ranking);

    // Snake: P1, P2, P3, P4, P4, P3, P2, P1
    expect(result.get(p1.toString())!.map((c) => c.coinValue)).toEqual([100, 5]);
    expect(result.get(p2.toString())!.map((c) => c.coinValue)).toEqual([80, 8]);
    expect(result.get(p3.toString())!.map((c) => c.coinValue)).toEqual([60, 10]);
    expect(result.get(p4.toString())!.map((c) => c.coinValue)).toEqual([40, 20]);
  });

  it("sorts cards by coinValue descending before distributing", () => {
    const cards = [10, 100, 40, 80].map((v) => makeVCard(v));
    const ranking = [p1.toString(), p2.toString()];

    const result = distributeSnakeDraft(cards, ranking);

    // Snake: P1, P2, P2, P1 → P1 gets 100+10, P2 gets 80+40
    expect(result.get(p1.toString())!.map((c) => c.coinValue)).toEqual([100, 10]);
    expect(result.get(p2.toString())!.map((c) => c.coinValue)).toEqual([80, 40]);
  });

  it("handles empty card list", () => {
    const result = distributeSnakeDraft([], [p1.toString(), p2.toString()]);
    expect(result.get(p1.toString())).toEqual([]);
    expect(result.get(p2.toString())).toEqual([]);
  });
});

// ---------- Mode Distribution ----------

describe("distributeByMode", () => {
  describe("lowest_card", () => {
    it("winner gets lowest card from each loser", () => {
      const playerCards = new Map<string, IVirtualCard[]>();
      playerCards.set(p1.toString(), [makeVCard(100), makeVCard(50), makeVCard(80)]);
      playerCards.set(p2.toString(), [makeVCard(10), makeVCard(30), makeVCard(5)]);

      const result = distributeByMode("lowest_card", p1.toString(), playerCards);

      expect(result).toHaveLength(1);
      expect(result[0].from.toString()).toBe(p2.toString());
      expect(result[0].to.toString()).toBe(p1.toString());
      expect(result[0].cards).toHaveLength(1);
      expect(result[0].cards[0].coinValue).toBe(5);
    });

    it("picks first drawn card on tie for lowest", () => {
      const playerCards = new Map<string, IVirtualCard[]>();
      playerCards.set(p1.toString(), [makeVCard(100)]);
      const card1 = makeVCard(5, "First-5");
      const card2 = makeVCard(5, "Second-5");
      playerCards.set(p2.toString(), [card1, makeVCard(30), card2]);

      const result = distributeByMode("lowest_card", p1.toString(), playerCards);

      expect(result[0].cards[0].name).toBe("First-5");
    });
  });

  describe("highest_card", () => {
    it("winner gets highest card from each loser", () => {
      const playerCards = new Map<string, IVirtualCard[]>();
      playerCards.set(p1.toString(), [makeVCard(100)]);
      playerCards.set(p2.toString(), [makeVCard(10), makeVCard(90), makeVCard(5)]);

      const result = distributeByMode("highest_card", p1.toString(), playerCards);

      expect(result).toHaveLength(1);
      expect(result[0].cards[0].coinValue).toBe(90);
    });
  });

  describe("all_cards", () => {
    it("winner gets all cards from each loser", () => {
      const playerCards = new Map<string, IVirtualCard[]>();
      playerCards.set(p1.toString(), [makeVCard(100)]);
      playerCards.set(p2.toString(), [makeVCard(10), makeVCard(30)]);

      const result = distributeByMode("all_cards", p1.toString(), playerCards);

      expect(result).toHaveLength(1);
      expect(result[0].cards).toHaveLength(2);
    });

    it("works with 3 players — winner gets from all losers", () => {
      const playerCards = new Map<string, IVirtualCard[]>();
      playerCards.set(p1.toString(), [makeVCard(100)]);
      playerCards.set(p2.toString(), [makeVCard(10)]);
      playerCards.set(p3.toString(), [makeVCard(20)]);

      const result = distributeByMode("all_cards", p1.toString(), playerCards);

      expect(result).toHaveLength(2);
      const totalCards = result.reduce((sum, t) => sum + t.cards.length, 0);
      expect(totalCards).toBe(2);
    });
  });

  describe("snake_draft", () => {
    it("delegates to snake draft distribution", () => {
      const playerCards = new Map<string, IVirtualCard[]>();
      playerCards.set(p1.toString(), [makeVCard(100), makeVCard(50)]);
      playerCards.set(p2.toString(), [makeVCard(80), makeVCard(10)]);

      const result = distributeByMode("snake_draft", p1.toString(), playerCards);

      // In snake_draft mode, transfers represent the final allocation
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
