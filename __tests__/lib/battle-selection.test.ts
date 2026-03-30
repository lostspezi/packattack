import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildSelectionKey,
  storeSelection,
  getSelections,
  allPlayersSelected,
  getSelectedCardIndex,
  clearSelections,
} from "@/lib/battle-selection";

// Mock Redis
const mockRedis = {
  hset: vi.fn().mockResolvedValue(1),
  hgetall: vi.fn().mockResolvedValue({}),
  del: vi.fn().mockResolvedValue(1),
};

vi.mock("@/lib/redis", () => ({
  getRedis: () => mockRedis,
}));

describe("battle-selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildSelectionKey", () => {
    it("builds correct Redis key", () => {
      expect(buildSelectionKey("battle123", 2)).toBe("battle:battle123:round:2:selections");
    });
  });

  describe("storeSelection", () => {
    it("stores player selection in Redis hash", async () => {
      await storeSelection("battle123", 2, "player1", 3);
      expect(mockRedis.hset).toHaveBeenCalledWith(
        "battle:battle123:round:2:selections",
        "player1",
        "3"
      );
    });
  });

  describe("getSelections", () => {
    it("returns all stored selections", async () => {
      mockRedis.hgetall.mockResolvedValueOnce({ player1: "2", player2: "4" });
      const selections = await getSelections("battle123", 0);
      expect(selections).toEqual({ player1: 2, player2: 4 });
    });

    it("returns empty object when no selections", async () => {
      mockRedis.hgetall.mockResolvedValueOnce({});
      const selections = await getSelections("battle123", 0);
      expect(selections).toEqual({});
    });
  });

  describe("allPlayersSelected", () => {
    it("returns true when all players have selected", async () => {
      mockRedis.hgetall.mockResolvedValueOnce({ p1: "0", p2: "3" });
      const result = await allPlayersSelected("battle123", 0, ["p1", "p2"]);
      expect(result).toBe(true);
    });

    it("returns false when some players missing", async () => {
      mockRedis.hgetall.mockResolvedValueOnce({ p1: "0" });
      const result = await allPlayersSelected("battle123", 0, ["p1", "p2"]);
      expect(result).toBe(false);
    });
  });

  describe("getSelectedCardIndex", () => {
    it("returns selection index for a player", async () => {
      mockRedis.hgetall.mockResolvedValueOnce({ p1: "3", p2: "1" });
      const index = await getSelectedCardIndex("battle123", 0, "p1");
      expect(index).toBe(3);
    });

    it("returns null for player who has not selected", async () => {
      mockRedis.hgetall.mockResolvedValueOnce({ p2: "1" });
      const index = await getSelectedCardIndex("battle123", 0, "p1");
      expect(index).toBeNull();
    });
  });

  describe("clearSelections", () => {
    it("deletes the Redis key", async () => {
      await clearSelections("battle123", 2);
      expect(mockRedis.del).toHaveBeenCalledWith("battle:battle123:round:2:selections");
    });
  });
});
