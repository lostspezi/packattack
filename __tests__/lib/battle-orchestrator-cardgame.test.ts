import { describe, it, expect, vi, beforeEach } from "vitest";
import { dealHands } from "@/lib/battle-engine";
import {
  buildSelectionKey,
  storeSelection,
  getSelections,
  allPlayersSelected,
  clearSelections,
} from "@/lib/battle-selection";
import { HAND_SIZE, SELECTION_TIMEOUT_MS } from "@/lib/battle-constants";

// Mock Redis
const selectionStore: Record<string, Record<string, string>> = {};

const mockRedis = {
  hset: vi.fn(async (key: string, field: string, value: string) => {
    if (!selectionStore[key]) selectionStore[key] = {};
    selectionStore[key][field] = value;
    return 1;
  }),
  hgetall: vi.fn(async (key: string) => selectionStore[key] || {}),
  del: vi.fn(async (key: string) => {
    delete selectionStore[key];
    return 1;
  }),
};

vi.mock("@/lib/redis", () => ({
  getRedis: () => mockRedis,
}));

describe("Card Selection Integration", () => {
  beforeEach(() => {
    Object.keys(selectionStore).forEach((k) => delete selectionStore[k]);
    vi.clearAllMocks();
  });

  it("complete round flow: deal → select → resolve", async () => {
    const battleId = "test-battle-1";
    const playerIds = ["player-a", "player-b"];

    // 1. Create a pool of cards (10 for 2 players × HAND_SIZE)
    const pool = Array.from({ length: playerIds.length * HAND_SIZE }, (_, i) => ({
      card: `card-${i}`,
      coinValue: (i + 1) * 1.5,
      rarity: "Common",
      name: `Test Card ${i}`,
      image: `/img/${i}.png`,
    }));

    // 2. Deal hands
    const hands = dealHands(pool, playerIds);
    expect(hands).toHaveLength(2);
    expect(hands[0].dealtCards).toHaveLength(HAND_SIZE);
    expect(hands[1].dealtCards).toHaveLength(HAND_SIZE);

    // 3. Players select cards
    await storeSelection(battleId, 0, "player-a", 2);
    expect(await allPlayersSelected(battleId, 0, playerIds)).toBe(false);

    await storeSelection(battleId, 0, "player-b", 4);
    expect(await allPlayersSelected(battleId, 0, playerIds)).toBe(true);

    // 4. Get selections
    const selections = await getSelections(battleId, 0);
    expect(selections["player-a"]).toBe(2);
    expect(selections["player-b"]).toBe(4);

    // 5. Build played cards
    const playedCards = playerIds.map((pid) => {
      const hand = hands.find((h) => h.player === pid)!;
      const card = hand.dealtCards[selections[pid]];
      return { playerId: pid, coinValue: card.coinValue };
    });

    // 6. Winner is whoever has higher coinValue
    const winner = playedCards.reduce((a, b) => (a.coinValue > b.coinValue ? a : b));
    expect(winner.playerId).toBeDefined();

    // 7. Cleanup
    await clearSelections(battleId, 0);
    const afterClear = await getSelections(battleId, 0);
    expect(Object.keys(afterClear)).toHaveLength(0);
  });

  it("timeout assigns random card to non-selecting player", async () => {
    const battleId = "test-battle-2";
    const playerIds = ["player-a", "player-b"];

    // Only player-a selects
    await storeSelection(battleId, 0, "player-a", 1);
    expect(await allPlayersSelected(battleId, 0, playerIds)).toBe(false);

    // Simulate timeout: assign random to player-b
    const selections = await getSelections(battleId, 0);
    for (const pid of playerIds) {
      if (!(pid in selections)) {
        const randomIndex = Math.floor(Math.random() * HAND_SIZE);
        await storeSelection(battleId, 0, pid, randomIndex);
      }
    }

    expect(await allPlayersSelected(battleId, 0, playerIds)).toBe(true);
    const finalSelections = await getSelections(battleId, 0);
    expect(finalSelections["player-a"]).toBe(1);
    expect(finalSelections["player-b"]).toBeGreaterThanOrEqual(0);
    expect(finalSelections["player-b"]).toBeLessThan(HAND_SIZE);
  });
});
