import { describe, it, expect } from "vitest";
import {
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

});
