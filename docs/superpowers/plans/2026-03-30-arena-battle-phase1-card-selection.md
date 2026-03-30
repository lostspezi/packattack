# Arena Battle Phase 1: Card Selection Mechanic — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform battles from passive (automatic card comparison) to interactive (players choose 1 of 5 cards per round), while keeping the existing Elo, distribution, and economy systems intact.

**Architecture:** The orchestrator switches from sequential sleep-based rounds to an event-based model during clash: deal 5 cards per player → wait for selections (20s timeout) → reveal all simultaneously → determine winner. Redis stores selections; BullMQ handles timeouts. New SSE events (`hand_dealt`, `player_selected`, `cards_reveal`) drive the client. The existing `round_result` and `battle_end` events remain unchanged.

**Tech Stack:** Next.js 16 (App Router), TypeScript, MongoDB/Mongoose, Redis (ioredis), BullMQ, SSE, Vitest

**Spec:** `docs/superpowers/specs/2026-03-30-arena-battle-cardgame-design.md`

---

## File Structure

### New Files
- `app/api/battles/[id]/select-card/route.ts` — POST endpoint for card selection
- `lib/battle-selection.ts` — Selection logic: store in Redis, check completeness, handle timeout
- `__tests__/battle-selection.test.ts` — Tests for selection logic
- `__tests__/battle-orchestrator-cardgame.test.ts` — Tests for the new clash flow

### Modified Files
- `lib/battle-constants.ts` — Add new constants (HAND_SIZE, SELECTION_TIMEOUT, new timing values)
- `lib/battle-engine.ts` — Add `dealHands()` function
- `lib/battle-orchestrator.ts` — Rewrite clash phase (Phase 3) to event-based card selection
- `models/battle.ts` — Extend `IBattleRound` with hands/selections data
- `app/api/battles/[id]/events/route.ts` — Filter `hand_dealt` events per player (like `distribution`)
- `components/battles/battle-view.tsx` — Handle new SSE events on client
- `__tests__/battle-engine.test.ts` — Add tests for `dealHands()`

---

## Task 1: Add New Constants

**Files:**
- Modify: `lib/battle-constants.ts`

- [ ] **Step 1: Add card selection constants**

Add these constants after the existing round choreography constants in `lib/battle-constants.ts`:

```typescript
// Card Selection (new mechanic)
export const HAND_SIZE = 5;
export const SELECTION_TIMEOUT_MS = 20_000;

// New round choreography (replaces sequential reveal)
export const HAND_DEAL_MS = 2000;          // time to show hand cards appearing
export const HAND_REVEAL_MS = 3000;        // time for cards to flip face-up
export const SELECTION_WAIT_DISPLAY_MS = 1500; // display "waiting for players" after own selection
export const SIMULTANEOUS_REVEAL_MS = 2000;    // all cards flip at once
export const COIN_VALUE_EFFECT_THRESHOLDS = {
  medium: 1,    // $1+ = green glow, light sparks
  high: 5,      // $5+ = purple/gold glow, screen shake
  extreme: 20,  // $20+ = gold explosion, confetti
};
```

- [ ] **Step 2: Verify no import errors**

Run: `npx tsc --noEmit lib/battle-constants.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add lib/battle-constants.ts
git commit -m "feat(battle): add card selection constants"
```

---

## Task 2: Extend Battle Model with Hand/Selection Data

**Files:**
- Modify: `models/battle.ts`

- [ ] **Step 1: Add hand card interface and extend round interface**

In `models/battle.ts`, add a new interface `IBattleHandCard` before `IBattleRound`, then extend `IBattleRound` with hand data:

```typescript
export interface IBattleHandCard {
  player: Types.ObjectId;
  dealtCards: Array<{
    card: Types.ObjectId;
    coinValue: number;
    rarity: string;
    name: string;
    image: string;
  }>;
  selectedIndex: number | null; // 0-4, null = not yet selected
}
```

Add to `IBattleRound`:
```typescript
export interface IBattleRound {
  roundIndex: number;
  cards: IBattleRoundCard[];       // played cards (the selected ones)
  hands?: IBattleHandCard[];       // dealt hands per player (5 cards each)
  winnerId: Types.ObjectId | null;
  revealedAt: Date | null;
}
```

Update the Mongoose schema for `rounds` to include the `hands` sub-array:
```typescript
hands: [{
  player: { type: Schema.Types.ObjectId, ref: "User" },
  dealtCards: [{
    card: { type: Schema.Types.ObjectId, ref: "Card" },
    coinValue: Number,
    rarity: String,
    name: String,
    image: String,
  }],
  selectedIndex: { type: Number, default: null },
}],
```

- [ ] **Step 2: Verify model compiles**

Run: `npx tsc --noEmit models/battle.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add models/battle.ts
git commit -m "feat(battle): extend round schema with hand/selection data"
```

---

## Task 3: Implement `dealHands()` in Battle Engine

**Files:**
- Modify: `lib/battle-engine.ts`
- Test: `__tests__/battle-engine.test.ts`

- [ ] **Step 1: Write failing tests for dealHands**

Add to `__tests__/battle-engine.test.ts`:

```typescript
import { dealHands } from "@/lib/battle-engine";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/battle-engine.test.ts --reporter=verbose`
Expected: FAIL — `dealHands` is not exported

- [ ] **Step 3: Implement dealHands**

Add to `lib/battle-engine.ts`:

```typescript
import { HAND_SIZE } from "@/lib/battle-constants";

interface DealableCard {
  card: string;
  coinValue: number;
  rarity: string;
  name: string;
  image: string;
}

interface DealtHand {
  player: string;
  dealtCards: DealableCard[];
  selectedIndex: null;
}

export function dealHands(pool: DealableCard[], playerIds: string[]): DealtHand[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return playerIds.map((playerId, i) => ({
    player: playerId,
    dealtCards: shuffled.slice(i * HAND_SIZE, (i + 1) * HAND_SIZE),
    selectedIndex: null,
  }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/battle-engine.test.ts --reporter=verbose`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/battle-engine.ts __tests__/battle-engine.test.ts
git commit -m "feat(battle): add dealHands function for card selection"
```

---

## Task 4: Implement Selection Logic (`battle-selection.ts`)

**Files:**
- Create: `lib/battle-selection.ts`
- Test: `__tests__/battle-selection.test.ts`

- [ ] **Step 1: Write failing tests for selection logic**

Create `__tests__/battle-selection.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/battle-selection.test.ts --reporter=verbose`
Expected: FAIL — module not found

- [ ] **Step 3: Implement battle-selection.ts**

Create `lib/battle-selection.ts`:

```typescript
import { getRedis } from "@/lib/redis";

export function buildSelectionKey(battleId: string, roundIndex: number): string {
  return `battle:${battleId}:round:${roundIndex}:selections`;
}

export async function storeSelection(
  battleId: string,
  roundIndex: number,
  playerId: string,
  cardIndex: number
): Promise<void> {
  const redis = getRedis();
  await redis.hset(buildSelectionKey(battleId, roundIndex), playerId, cardIndex.toString());
}

export async function getSelections(
  battleId: string,
  roundIndex: number
): Promise<Record<string, number>> {
  const redis = getRedis();
  const raw = await redis.hgetall(buildSelectionKey(battleId, roundIndex));
  const result: Record<string, number> = {};
  for (const [key, val] of Object.entries(raw)) {
    result[key] = parseInt(val, 10);
  }
  return result;
}

export async function allPlayersSelected(
  battleId: string,
  roundIndex: number,
  playerIds: string[]
): Promise<boolean> {
  const selections = await getSelections(battleId, roundIndex);
  return playerIds.every((id) => id in selections);
}

export async function getSelectedCardIndex(
  battleId: string,
  roundIndex: number,
  playerId: string
): Promise<number | null> {
  const selections = await getSelections(battleId, roundIndex);
  return playerId in selections ? selections[playerId] : null;
}

export async function clearSelections(
  battleId: string,
  roundIndex: number
): Promise<void> {
  const redis = getRedis();
  await redis.del(buildSelectionKey(battleId, roundIndex));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/battle-selection.test.ts --reporter=verbose`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/battle-selection.ts __tests__/battle-selection.test.ts
git commit -m "feat(battle): add Redis-based card selection storage"
```

---

## Task 5: Create `select-card` API Endpoint

**Files:**
- Create: `app/api/battles/[id]/select-card/route.ts`

- [ ] **Step 1: Implement the endpoint**

Create `app/api/battles/[id]/select-card/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import Battle from "@/models/battle";
import { connectDB } from "@/lib/db";
import { storeSelection, getSelectedCardIndex, allPlayersSelected } from "@/lib/battle-selection";
import { HAND_SIZE } from "@/lib/battle-constants";
import { getRedis } from "@/lib/redis";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { roundIndex, cardIndex } = await req.json();

  if (typeof roundIndex !== "number" || typeof cardIndex !== "number") {
    return NextResponse.json({ error: "roundIndex and cardIndex are required" }, { status: 400 });
  }

  if (cardIndex < 0 || cardIndex >= HAND_SIZE) {
    return NextResponse.json({ error: `cardIndex must be 0-${HAND_SIZE - 1}` }, { status: 400 });
  }

  await connectDB();
  const battle = await Battle.findById(id);

  if (!battle) {
    return NextResponse.json({ error: "Battle not found" }, { status: 404 });
  }

  if (battle.status !== "clash") {
    return NextResponse.json({ error: "Battle is not in clash phase" }, { status: 400 });
  }

  if (roundIndex !== battle.currentRound) {
    return NextResponse.json({ error: "Wrong round" }, { status: 400 });
  }

  const userId = session.user.id;
  const playerIndex = battle.players.findIndex(
    (p: { user: { toString(): string } }) => p.user.toString() === userId
  );
  if (playerIndex === -1) {
    return NextResponse.json({ error: "Not a player in this battle" }, { status: 403 });
  }

  // Check if already selected this round
  const existing = await getSelectedCardIndex(id, roundIndex, userId);
  if (existing !== null) {
    return NextResponse.json({ error: "Already selected a card this round" }, { status: 400 });
  }

  // Validate the round has hands data and this player has a hand
  const round = battle.rounds[roundIndex];
  if (!round?.hands) {
    return NextResponse.json({ error: "Hand not dealt yet" }, { status: 400 });
  }
  const hand = round.hands.find(
    (h: { player: { toString(): string } }) => h.player.toString() === userId
  );
  if (!hand) {
    return NextResponse.json({ error: "No hand found for player" }, { status: 400 });
  }

  // Store selection in Redis
  await storeSelection(id, roundIndex, userId, cardIndex);

  // Update hand in DB
  const handIndex = round.hands.findIndex(
    (h: { player: { toString(): string } }) => h.player.toString() === userId
  );
  await Battle.updateOne(
    { _id: id },
    { $set: { [`rounds.${roundIndex}.hands.${handIndex}.selectedIndex`]: cardIndex } }
  );

  // Publish that this player has selected (no card details!)
  const redis = getRedis();
  const event = JSON.stringify({ type: "player_selected", userId, roundIndex });
  await redis.publish(`battle:${id}`, event);

  // Check if all players have now selected
  const playerIds = battle.players.map((p: { user: { toString(): string } }) => p.user.toString());
  const allDone = await allPlayersSelected(id, roundIndex, playerIds);

  return NextResponse.json({ selected: true, allSelected: allDone });
}
```

- [ ] **Step 2: Verify the endpoint compiles**

Run: `npx tsc --noEmit app/api/battles/[id]/select-card/route.ts`
Expected: No errors (or only errors from existing code)

- [ ] **Step 3: Commit**

```bash
git add app/api/battles/[id]/select-card/route.ts
git commit -m "feat(battle): add select-card API endpoint"
```

---

## Task 6: Add `hand_dealt` Filtering to SSE Events Route

**Files:**
- Modify: `app/api/battles/[id]/events/route.ts`

- [ ] **Step 1: Add hand_dealt filtering alongside existing distribution filtering**

In `app/api/battles/[id]/events/route.ts`, find the section where `distribution` events are filtered (the `if (parsed.type === "distribution" && parsed.targetUserId !== userId)` check). Add a similar filter for `hand_dealt` right next to it:

```typescript
// Existing filter:
if (parsed.type === "distribution" && parsed.targetUserId !== userId) {
  return;
}

// Add this new filter:
if (parsed.type === "hand_dealt" && parsed.targetUserId !== userId) {
  return;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/battles/[id]/events/route.ts
git commit -m "feat(battle): filter hand_dealt SSE events per player"
```

---

## Task 7: Rewrite Orchestrator Clash Phase

This is the most complex task. The orchestrator's Phase 3 (clash rounds) changes from sequential-automatic to event-based card selection.

**Files:**
- Modify: `lib/battle-orchestrator.ts`

- [ ] **Step 1: Add imports for new modules**

At the top of `lib/battle-orchestrator.ts`, add:

```typescript
import { dealHands } from "@/lib/battle-engine";
import {
  storeSelection,
  getSelections,
  allPlayersSelected,
  clearSelections,
} from "@/lib/battle-selection";
import {
  HAND_SIZE,
  SELECTION_TIMEOUT_MS,
  HAND_DEAL_MS,
  HAND_REVEAL_MS,
  SELECTION_WAIT_DISPLAY_MS,
  SIMULTANEOUS_REVEAL_MS,
  COIN_VALUE_EFFECT_THRESHOLDS,
} from "@/lib/battle-constants";
```

- [ ] **Step 2: Add waitForSelections helper function**

Add this helper before `runBattle()`:

```typescript
async function waitForSelections(
  battleId: string,
  roundIndex: number,
  playerIds: string[],
  timeoutMs: number
): Promise<Record<string, number>> {
  const pollInterval = 500;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const allDone = await allPlayersSelected(battleId, roundIndex, playerIds);
    if (allDone) {
      return getSelections(battleId, roundIndex);
    }
    await sleep(pollInterval);
  }

  // Timeout — get whatever selections exist, fill missing with random
  const selections = await getSelections(battleId, roundIndex);
  for (const playerId of playerIds) {
    if (!(playerId in selections)) {
      const randomIndex = Math.floor(Math.random() * HAND_SIZE);
      selections[playerId] = randomIndex;
      await storeSelection(battleId, roundIndex, playerId, randomIndex);
    }
  }
  return selections;
}
```

- [ ] **Step 3: Add getCoinValueEffectTier helper**

Add this helper:

```typescript
function getCoinValueEffectTier(coinValue: number): string {
  if (coinValue >= COIN_VALUE_EFFECT_THRESHOLDS.extreme) return "extreme";
  if (coinValue >= COIN_VALUE_EFFECT_THRESHOLDS.high) return "high";
  if (coinValue >= COIN_VALUE_EFFECT_THRESHOLDS.medium) return "medium";
  return "low";
}
```

- [ ] **Step 4: Rewrite the CLASH ROUNDS section (Phase 3)**

Replace the entire clash rounds section in `runBattle()` (the section after `opening_complete` is published and before the finish/placement section). The old code handles rounds sequentially with automatic reveals. Replace it with:

```typescript
// ── PHASE 3: CLASH ROUNDS — CARD SELECTION ──────────────────

await Battle.updateOne({ _id: battleId }, { $set: { status: "clash" } });

const scores: Map<string, number> = new Map();
const playerIds = freshBattle.players.map(
  (p: { user: { toString(): string } }) => p.user.toString()
);
for (const pid of playerIds) scores.set(pid, 0);

for (let r = 0; r < totalRounds; r++) {
  // 1. Round announcement
  publish(battleId, {
    type: "round_announce",
    roundIndex: r,
    totalRounds,
  });
  await sleep(ROUND_ANNOUNCE_MS);

  // 2. Deal hands — pick 5 cards per player from the round's card pool
  const roundPulls = allPulls.filter((p) => p.roundIndex === r);
  const hands = dealHands(
    roundPulls.map((p) => ({
      card: p.cardId,
      coinValue: p.coinValue,
      rarity: p.rarity,
      name: p.name,
      image: p.image,
    })),
    playerIds
  );

  // Store hands in DB
  await Battle.updateOne(
    { _id: battleId },
    { $set: { [`rounds.${r}.hands`]: hands.map((h) => ({
      player: h.player,
      dealtCards: h.dealtCards,
      selectedIndex: null,
    }))}}
  );

  // 3. Send hand_dealt to each player (player-specific — filtered by events route)
  for (const hand of hands) {
    publish(battleId, {
      type: "hand_dealt",
      targetUserId: hand.player,
      roundIndex: r,
      cards: hand.dealtCards.map((c, i) => ({
        index: i,
        card: c.card,
        coinValue: c.coinValue,
        rarity: c.rarity,
        name: c.name,
        image: c.image,
      })),
    });
  }
  await sleep(HAND_DEAL_MS + HAND_REVEAL_MS);

  // 4. Wait for all players to select (or timeout)
  const selections = await waitForSelections(
    battleId,
    r,
    playerIds,
    SELECTION_TIMEOUT_MS
  );

  await sleep(SELECTION_WAIT_DISPLAY_MS);

  // 5. Build played cards from selections
  const playedCards = playerIds.map((pid) => {
    const hand = hands.find((h) => h.player === pid)!;
    const selectedIdx = selections[pid];
    const card = hand.dealtCards[selectedIdx];
    return {
      player: pid,
      card: card.card,
      coinValue: card.coinValue,
      rarity: card.rarity,
      name: card.name,
      image: card.image,
    };
  });

  // 6. Simultaneous reveal — send all cards to everyone
  const maxCoinValue = Math.max(...playedCards.map((c) => c.coinValue));
  publish(battleId, {
    type: "cards_reveal",
    roundIndex: r,
    cards: playedCards.map((c) => ({
      playerId: c.player,
      card: { _id: c.card, name: c.name, image: c.image },
      coinValue: c.coinValue,
      rarity: c.rarity,
      effectTier: getCoinValueEffectTier(c.coinValue),
    })),
    highestEffectTier: getCoinValueEffectTier(maxCoinValue),
  });
  await sleep(SIMULTANEOUS_REVEAL_MS);

  // 7. Determine winner
  const roundCards = playedCards.map((c) => ({
    playerId: c.player,
    coinValue: c.coinValue,
    rarity: c.rarity,
  }));
  const winnerId = determineRoundWinner(roundCards);
  const isClose = isCloseMatch(roundCards);

  // 8. Update DB: store played cards and winner in round
  await Battle.updateOne(
    { _id: battleId },
    {
      $set: {
        [`rounds.${r}.cards`]: playedCards.map((c) => ({
          player: c.player,
          card: c.card,
          rarity: c.rarity,
          coinValue: c.coinValue,
        })),
        [`rounds.${r}.winnerId`]: winnerId,
        [`rounds.${r}.revealedAt`]: new Date(),
        currentRound: r,
      },
    }
  );

  // Update scores
  if (winnerId) {
    scores.set(winnerId, (scores.get(winnerId) || 0) + 1);
    await Battle.updateOne(
      { _id: battleId, "players.user": winnerId },
      { $inc: { "players.$.score": 1 } }
    );
  }

  // 9. Publish round result
  publish(battleId, {
    type: "round_result",
    roundIndex: r,
    winnerId,
    scores: Object.fromEntries(scores),
    isClose,
  });

  // Timing for winner reveal
  await sleep(isClose ? WINNER_CLOSE_REVEAL_MS : WINNER_REVEAL_MS);
  await sleep(SCORE_UPDATE_MS);

  // Cleanup Redis selections for this round
  await clearSelections(battleId, r);

  // Round transition (except after last round)
  if (r < totalRounds - 1) {
    await sleep(ROUND_TRANSITION_MS);
  }
}
```

- [ ] **Step 5: Adjust card pool allocation in Opening phase**

The opening phase currently builds `allPulls` and assigns `roundIndex` to each card. With the new system, we need `HAND_SIZE × playerCount` cards per round instead of `1 × playerCount`. Find the section where `roundIndex` is assigned to each pull and update the math:

```typescript
// In the opening phase, where roundIndex is computed:
// OLD: roundIndex: Math.floor(cardIndexInPlayer / cardsPerPack)
// or similar assignment that gives 1 card per round per player
//
// NEW: Each round needs HAND_SIZE cards per player.
// Total cards per player = totalRounds * HAND_SIZE
// roundIndex = Math.floor(cardIndexInPlayer / HAND_SIZE)
```

The exact modification depends on how `allPulls` assigns `roundIndex`. The key change: instead of `packsPerPlayer` packs with `cardsPerPack` cards each producing 1 card per round, we now need `totalRounds × HAND_SIZE` cards per player. The `totalRounds` calculation changes to:

```typescript
const totalCardsPerPlayer = HAND_SIZE * packsPerPlayer; // e.g., 5 * 2 = 10 cards
const totalRounds = packsPerPlayer; // number of rounds stays = packsPerPlayer
// Each round: deal HAND_SIZE=5 cards per player from that round's pool
```

Note: `packsPerPlayer` determines how many rounds are played. Each round uses `HAND_SIZE` cards per player. So total cards per player = `packsPerPlayer × HAND_SIZE`. The box must have enough stock.

- [ ] **Step 6: Verify orchestrator compiles**

Run: `npx tsc --noEmit lib/battle-orchestrator.ts`
Expected: No type errors

- [ ] **Step 7: Commit**

```bash
git add lib/battle-orchestrator.ts
git commit -m "feat(battle): rewrite clash phase to event-based card selection"
```

---

## Task 8: Update Client SSE Handlers

**Files:**
- Modify: `components/battles/battle-view.tsx`

- [ ] **Step 1: Add new state variables**

In `BattleView`, add these state variables alongside the existing ones:

```typescript
const [handCards, setHandCards] = useState<HandCard[] | null>(null);
const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
const [playersSelected, setPlayersSelected] = useState<Set<string>>(new Set());
const [revealedPlayedCards, setRevealedPlayedCards] = useState<PlayedCard[] | null>(null);
```

Add these type definitions near the top of the file:

```typescript
interface HandCard {
  index: number;
  card: string;
  coinValue: number;
  rarity: string;
  name: string;
  image: string;
}

interface PlayedCard {
  playerId: string;
  card: { _id: string; name: string; image: string };
  coinValue: number;
  rarity: string;
  effectTier: string;
}
```

- [ ] **Step 2: Add SSE event handlers for new events**

Add these event listeners in the `connectSSE` function, alongside the existing ones:

```typescript
es.addEventListener("hand_dealt", (e) => {
  const data = JSON.parse(e.data);
  setHandCards(data.cards);
  setSelectedCardIndex(null);
  setPlayersSelected(new Set());
  setRevealedPlayedCards(null);
});

es.addEventListener("player_selected", (e) => {
  const data = JSON.parse(e.data);
  setPlayersSelected((prev) => new Set([...prev, data.userId]));
});

es.addEventListener("cards_reveal", (e) => {
  const data = JSON.parse(e.data);
  setRevealedPlayedCards(data.cards);
  setHandCards(null); // Hide hand after reveal
});
```

- [ ] **Step 3: Add card selection handler function**

Add this function inside the component:

```typescript
const handleSelectCard = async (cardIndex: number) => {
  if (!battle || selectedCardIndex !== null) return;
  setSelectedCardIndex(cardIndex);
  try {
    await fetch(`/api/battles/${battle._id}/select-card`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roundIndex: battle.currentRound, cardIndex }),
    });
  } catch (err) {
    console.error("Failed to select card:", err);
    setSelectedCardIndex(null);
  }
};
```

- [ ] **Step 4: Clear round_announce handler to reset card state**

Update the existing `round_announce` handler to also clear card selection state:

```typescript
es.addEventListener("round_announce", (e) => {
  const data = JSON.parse(e.data);
  setRoundAnnounce(data);
  setRevealedCards({});
  setRoundResult(null);
  // Clear card selection state for new round:
  setHandCards(null);
  setSelectedCardIndex(null);
  setPlayersSelected(new Set());
  setRevealedPlayedCards(null);
});
```

- [ ] **Step 5: Commit**

```bash
git add components/battles/battle-view.tsx
git commit -m "feat(battle): add client-side card selection SSE handlers"
```

---

## Task 9: Add Temporary Card Selection UI (Placeholder for PixiJS)

This creates a minimal DOM-based card selection UI that works before PixiJS is integrated in Phase 2/3. It will be replaced later.

**Files:**
- Modify: `components/battles/battle-clash.tsx`

- [ ] **Step 1: Add card hand display and selection UI**

Add a card selection section to the `BattleClash` component. This should be rendered when `handCards` is not null and the user `isPlayer`. The exact placement depends on the current component structure, but add it below the existing round content:

```tsx
{/* Card Selection Hand */}
{isPlayer && handCards && (
  <div className="mt-6 space-y-3">
    <p className="text-center text-sm text-text-secondary tracking-widest uppercase">
      {selectedCardIndex !== null
        ? `Karte gewählt — Warte auf Gegner... (${playersSelected.size}/${battle.players.length})`
        : "Wähle eine Karte"}
    </p>
    <div className="flex justify-center gap-3">
      {handCards.map((card) => (
        <button
          key={card.index}
          onClick={() => handleSelectCard(card.index)}
          disabled={selectedCardIndex !== null}
          className={`
            relative w-20 rounded-lg border-2 p-3 text-center transition-all
            ${selectedCardIndex === card.index
              ? "border-pa-green -translate-y-3 shadow-[0_0_20px_rgba(155,255,0,0.3)]"
              : selectedCardIndex !== null
                ? "border-white/10 opacity-40"
                : "border-white/10 hover:border-pa-green/50 hover:-translate-y-1 cursor-pointer"
            }
          `}
        >
          <div className="text-xs text-text-secondary">{card.rarity}</div>
          <div className="mt-1 text-lg font-bold text-pa-green">
            ${card.coinValue.toFixed(2)}
          </div>
          <div className="mt-1 truncate text-xs text-text-secondary">{card.name}</div>
        </button>
      ))}
    </div>
  </div>
)}

{/* Revealed Cards (after all players selected) */}
{revealedPlayedCards && (
  <div className="mt-6 space-y-3">
    <div className="flex justify-center items-center gap-6">
      {revealedPlayedCards.map((card, i) => (
        <div key={i} className="text-center">
          <div className="text-xs text-text-secondary mb-1">
            {battle.players.find(p => p.user._id === card.playerId)?.user.name ?? "Player"}
          </div>
          <div className={`
            w-20 rounded-lg border-2 p-3
            ${card.effectTier === "extreme" ? "border-yellow-400 shadow-[0_0_30px_rgba(255,215,0,0.4)]" :
              card.effectTier === "high" ? "border-purple-400 shadow-[0_0_20px_rgba(200,100,255,0.3)]" :
              card.effectTier === "medium" ? "border-pa-green shadow-[0_0_15px_rgba(155,255,0,0.2)]" :
              "border-white/20"}
          `}>
            <div className="text-lg font-bold" style={{
              color: card.effectTier === "extreme" ? "#ffd54f" :
                     card.effectTier === "high" ? "#c864ff" :
                     "#9BFF00"
            }}>
              ${card.coinValue.toFixed(2)}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 2: Ensure the new props are passed to BattleClash**

The `handCards`, `selectedCardIndex`, `playersSelected`, `revealedPlayedCards`, `handleSelectCard`, `isPlayer`, and `battle` must be passed from `BattleView` to `BattleClash`. Update the props interface and the component call in `BattleView` accordingly.

- [ ] **Step 3: Commit**

```bash
git add components/battles/battle-clash.tsx components/battles/battle-view.tsx
git commit -m "feat(battle): add temporary card selection UI for clash phase"
```

---

## Task 10: Integration Test — Full Battle Flow

**Files:**
- Create: `__tests__/battle-orchestrator-cardgame.test.ts`

- [ ] **Step 1: Write integration test for the new clash flow**

Create `__tests__/battle-orchestrator-cardgame.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run __tests__/battle-orchestrator-cardgame.test.ts --reporter=verbose`
Expected: All tests PASS

- [ ] **Step 3: Run all battle tests to ensure no regressions**

Run: `npx vitest run __tests__/battle-engine.test.ts __tests__/battle-elo.test.ts __tests__/battle-selection.test.ts __tests__/battle-orchestrator-cardgame.test.ts --reporter=verbose`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add __tests__/battle-orchestrator-cardgame.test.ts
git commit -m "test(battle): add integration tests for card selection flow"
```

---

## Task 11: Manual Verification

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Create a test battle with 2 players**

Open two browser windows logged in as different users. Create a battle, have both join, pass ready check.

- [ ] **Step 3: Verify the new clash flow**

During clash phase:
- Each player should see 5 cards at the bottom of the screen with coin values
- Clicking a card should highlight it and disable further selection
- After both players select (or timeout), all cards should reveal
- The player with the higher coin value should win the round
- Scores should update correctly
- After all rounds: placements, Elo changes, and distribution should work as before

- [ ] **Step 4: Test timeout behavior**

Start a round and have one player NOT select a card. After 20 seconds, a random card should be auto-selected and the round should resolve.

- [ ] **Step 5: Final commit with any fixes**

```bash
git add -A
git commit -m "fix(battle): address issues found during manual testing"
```

---

## Summary

| Task | What | Est. |
|------|------|------|
| 1 | Add constants | 2 min |
| 2 | Extend Battle model | 5 min |
| 3 | `dealHands()` + tests | 10 min |
| 4 | `battle-selection.ts` + tests | 10 min |
| 5 | `select-card` endpoint | 10 min |
| 6 | SSE event filtering | 2 min |
| 7 | Orchestrator rewrite | 20 min |
| 8 | Client SSE handlers | 10 min |
| 9 | Temporary UI | 10 min |
| 10 | Integration tests | 10 min |
| 11 | Manual verification | 15 min |
