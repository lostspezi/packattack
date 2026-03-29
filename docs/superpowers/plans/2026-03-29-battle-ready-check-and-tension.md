# Battle Ready-Check & Spannungsaufbau Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a LoL-style ready-check before battle start and rework round choreography for dramatic tension with sequential card reveals, rarity effects, close-match spotlights, and draw support.

**Architecture:** Server-driven via battle-orchestrator with SSE events controlling all timings. New `ready_check` status in battle model. Round reveals change from bulk (`round_reveal`) to individual (`card_reveal`) events with randomized reveal order. Winner logic simplified to coinValue-only with draw support.

**Tech Stack:** MongoDB/Mongoose, Redis Pub/Sub, Next.js API Routes, React client components, CSS animations

---

## File Structure

| File | Responsibility |
|------|----------------|
| `models/battle.ts` | Add `ready` field to player schema, `readyCheckStartedAt` to battle, `ready_check` status |
| `lib/battle-constants.ts` | New timing constants for ready-check and round choreography |
| `lib/battle-engine.ts` | Simplified winner logic (coinValue only, draw support), `isClose` calculation |
| `lib/battle-orchestrator.ts` | Ready-check flow, new round choreography with individual card reveals |
| `app/api/battles/[id]/ready/route.ts` | New endpoint for ready confirmation |
| `app/api/battles/[id]/join/route.ts` | Trigger ready-check instead of direct `runBattle()` |
| `app/api/battles/[id]/events/route.ts` | Include ready-check state in sync payload |
| `components/battles/battle-view.tsx` | Handle new SSE events |
| `components/battles/battle-lobby.tsx` | Ready-check UI (button, timer, checkmarks) |
| `components/battles/battle-clash.tsx` | New sequential reveal choreography, draw display, close-match spotlight |
| `components/battles/card-flip.tsx` | Rarity-based glow/shake/particle effects |

---

### Task 1: Battle Model — Add ready-check fields

**Files:**
- Modify: `models/battle.ts`

- [ ] **Step 1: Add `ready` to IBattlePlayer interface**

In `models/battle.ts`, add `ready` to the `IBattlePlayer` interface after line 24 (`eloChange`):

```typescript
export interface IBattlePlayer {
  user: Types.ObjectId;
  joinedAt: Date;
  coinsReserved: number;
  eloAtStart: number;
  score: number;
  placement: number | null;
  eloChange: number | null;
  ready: boolean;
}
```

- [ ] **Step 2: Add `readyCheckStartedAt` to IBattle interface and update status union**

Update the `IBattle` interface:

```typescript
export interface IBattle extends Document {
  slug: string;
  createdBy: Types.ObjectId;
  box: Types.ObjectId;
  packsPerPlayer: number;
  maxPlayers: number;
  status: "waiting" | "ready_check" | "countdown" | "opening" | "clash" | "finished" | "cancelled";
  visibility: "public" | "private";
  minElo: number | null;
  players: IBattlePlayer[];
  rounds: IBattleRound[];
  currentRound: number;
  totalRounds: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  readyCheckStartedAt: Date | null;
  seasonId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 3: Update BattlePlayerSchema to include `ready`**

Add to the `BattlePlayerSchema`:

```typescript
const BattlePlayerSchema = new Schema<IBattlePlayer>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    joinedAt: { type: Date, default: Date.now },
    coinsReserved: { type: Number, required: true },
    eloAtStart: { type: Number, required: true },
    score: { type: Number, default: 0 },
    placement: { type: Number, default: null },
    eloChange: { type: Number, default: null },
    ready: { type: Boolean, default: false },
  },
  { _id: false }
);
```

- [ ] **Step 4: Update BattleSchema with `readyCheckStartedAt` and new status enum**

```typescript
const BattleSchema = new Schema<IBattle>(
  {
    slug: { type: String, required: true, unique: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    box: { type: Schema.Types.ObjectId, ref: "Box", required: true },
    packsPerPlayer: { type: Number, required: true, min: 1, max: 10 },
    maxPlayers: { type: Number, required: true, min: 2 },
    status: {
      type: String,
      enum: ["waiting", "ready_check", "countdown", "opening", "clash", "finished", "cancelled"],
      default: "waiting",
      required: true,
    },
    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "public",
    },
    minElo: { type: Number, default: null },
    players: { type: [BattlePlayerSchema], default: [] },
    rounds: { type: [BattleRoundSchema], default: [] },
    currentRound: { type: Number, default: 0 },
    totalRounds: { type: Number, required: true },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    readyCheckStartedAt: { type: Date, default: null },
    seasonId: { type: Schema.Types.ObjectId, ref: "Season", default: null },
  },
  { timestamps: true }
);
```

- [ ] **Step 5: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors related to battle.ts (there may be downstream errors which will be fixed in later tasks).

- [ ] **Step 6: Commit**

```bash
git add models/battle.ts
git commit -m "feat(battle): add ready-check fields to battle model

- Add ready: boolean to IBattlePlayer
- Add readyCheckStartedAt to IBattle
- Add ready_check to status enum"
```

---

### Task 2: Battle Constants — Add timing constants

**Files:**
- Modify: `lib/battle-constants.ts`

- [ ] **Step 1: Replace old round pause constants and add new timing constants**

Replace the existing round timing constants (lines 18-21) and add new ones after line 24:

```typescript
// --- Battle ---
export const BATTLE_COUNTDOWN_SECONDS = 3;  // "3-2-1-FIGHT!" after all ready
export const BATTLE_MAX_PLAYERS = 20;
export const BATTLE_MIN_PLAYERS = 2;
export const BATTLE_MAX_PACKS = 10;

// --- Ready Check ---
export const READY_CHECK_TIMEOUT_SECONDS = 30;

// --- Round Choreography (all values in ms) ---
export const ROUND_ANNOUNCE_MS = 3000;
export const ROUND_BUILDUP_MS = 3000;
export const CARD_REVEAL_FLIP_MS = 1000;
export const CARD_REVEAL_DISPLAY_MS = 4000;
export const CARD_REVEAL_RARE_BONUS_MS = 2000;    // Extra display for Rare+ (RARITY_ORDER >= 3)
export const CARD_REVEAL_ULTRA_BONUS_MS = 4000;    // Extra display for Ultra Rare+ (RARITY_ORDER >= 5)
export const BETWEEN_REVEALS_MS = 3000;
export const COMPARISON_PAUSE_MS = 4000;
export const WINNER_REVEAL_MS = 3000;
export const WINNER_CLOSE_REVEAL_MS = 8000;
export const SCORE_UPDATE_MS = 3000;
export const ROUND_TRANSITION_MS = 2000;
export const CLOSE_MATCH_THRESHOLD = 0.2;  // 20% coinValue difference = "close"
```

- [ ] **Step 2: Commit**

```bash
git add lib/battle-constants.ts
git commit -m "feat(battle): add ready-check and round choreography timing constants"
```

---

### Task 3: Battle Engine — Simplify winner logic with draw support

**Files:**
- Modify: `lib/battle-engine.ts`

- [ ] **Step 1: Rewrite `determineRoundWinner` to return `null` on draw**

Replace the `determineRoundWinner` function (lines 9-22):

```typescript
/**
 * Determine the winner of a single round.
 * Only criterion: highest coinValue. Equal coinValue = draw (returns null).
 */
export function determineRoundWinner(cards: RoundCard[]): string | null {
  if (cards.length === 0) return null;

  const maxCoinValue = Math.max(...cards.map((c) => c.coinValue));
  const topCards = cards.filter((c) => c.coinValue === maxCoinValue);

  // Draw: multiple cards with the same top coinValue
  if (topCards.length > 1) return null;

  return topCards[0].playerId;
}
```

- [ ] **Step 2: Add `isCloseMatch` function**

Add after the `determineRoundWinner` function:

```typescript
/**
 * Determine if a round result is a close match.
 * Close = top two coinValues differ by less than 20% of the higher value.
 */
export function isCloseMatch(cards: RoundCard[]): boolean {
  if (cards.length < 2) return false;
  const sorted = [...cards].sort((a, b) => b.coinValue - a.coinValue);
  const top = sorted[0].coinValue;
  const second = sorted[1].coinValue;
  if (top === 0) return false;
  return (top - second) / top < CLOSE_MATCH_THRESHOLD;
}
```

- [ ] **Step 3: Add the import for CLOSE_MATCH_THRESHOLD**

Update the import at the top of the file (line 1):

```typescript
import { RARITY_ORDER, CLOSE_MATCH_THRESHOLD } from "./battle-constants";
```

- [ ] **Step 4: Update `getRevealDelayMs` to return per-card extra delay**

Replace the `getRevealDelayMs` function (lines 75-80):

```typescript
/**
 * Get extra display time in ms for a card based on its rarity.
 * Rare+ (order >= 3): +2000ms. Ultra Rare+ (order >= 5): +4000ms.
 */
export function getRarityBonusMs(rarity: string): number {
  const order = RARITY_ORDER[rarity] ?? 1;
  if (order >= 5) return CARD_REVEAL_ULTRA_BONUS_MS;
  if (order >= 3) return CARD_REVEAL_RARE_BONUS_MS;
  return 0;
}
```

- [ ] **Step 5: Add imports for the new constants**

Update the import to include the new constants:

```typescript
import {
  RARITY_ORDER,
  CLOSE_MATCH_THRESHOLD,
  CARD_REVEAL_RARE_BONUS_MS,
  CARD_REVEAL_ULTRA_BONUS_MS,
} from "./battle-constants";
```

- [ ] **Step 6: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: May show errors in `battle-orchestrator.ts` where `getRevealDelayMs` was called — this will be fixed in Task 5.

- [ ] **Step 7: Commit**

```bash
git add lib/battle-engine.ts lib/battle-constants.ts
git commit -m "feat(battle): simplify winner logic to coinValue-only with draw support

- determineRoundWinner returns null on equal coinValue (draw)
- Add isCloseMatch() for close-result spotlight
- Replace getRevealDelayMs with getRarityBonusMs for per-card timing"
```

---

### Task 4: Ready Endpoint — POST /api/battles/[id]/ready

**Files:**
- Create: `app/api/battles/[id]/ready/route.ts`

- [ ] **Step 1: Create the ready endpoint**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Battle from "@/models/battle";
import { getRedis } from "@/lib/redis";
import { runBattle } from "@/lib/battle-orchestrator";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await connectDB();

    const battle = await Battle.findById(id);
    if (!battle) {
      return NextResponse.json({ error: "Battle not found" }, { status: 404 });
    }

    if (battle.status !== "ready_check") {
      return NextResponse.json(
        { error: "Battle is not in ready check phase" },
        { status: 400 }
      );
    }

    const playerIndex = battle.players.findIndex(
      (p) => p.user.toString() === userId
    );
    if (playerIndex === -1) {
      return NextResponse.json(
        { error: "You are not in this battle" },
        { status: 403 }
      );
    }

    if (battle.players[playerIndex].ready) {
      return NextResponse.json({ ready: true, alreadyReady: true });
    }

    // Set player as ready
    await Battle.updateOne(
      { _id: id },
      { $set: { [`players.${playerIndex}.ready`]: true } }
    );

    // Publish player_ready event
    const redis = getRedis();
    await redis.publish(
      `battle:${id}`,
      JSON.stringify({ type: "player_ready", userId })
    );

    // Check if all players are now ready
    const updatedBattle = await Battle.findById(id).lean();
    if (!updatedBattle) {
      return NextResponse.json({ error: "Battle not found" }, { status: 404 });
    }

    const allReady = updatedBattle.players.every((p) => p.ready);

    if (allReady) {
      // All players ready — start the battle
      runBattle(id).catch(console.error);
    }

    return NextResponse.json({ ready: true, allReady });
  } catch (err) {
    console.error("[battles/[id]/ready POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/battles/[id]/ready/route.ts
git commit -m "feat(battle): add POST /api/battles/[id]/ready endpoint"
```

---

### Task 5: Battle Orchestrator — Ready-check flow and new round choreography

**Files:**
- Modify: `lib/battle-orchestrator.ts`

- [ ] **Step 1: Update imports**

Replace the imports at the top of the file (lines 1-16):

```typescript
import mongoose, { AnyBulkWriteOperation } from "mongoose";
import { getRedis } from "./redis";
import { drawPacks, PackCard } from "./pack-engine";
import {
  determineRoundWinner,
  calculatePlacements,
  snakeDraftDistribute,
  getRarityBonusMs,
  isCloseMatch,
} from "./battle-engine";
import { calculateEloChanges } from "./battle-elo";
import {
  RARITY_ORDER,
  BATTLE_COUNTDOWN_SECONDS,
  READY_CHECK_TIMEOUT_SECONDS,
  ROUND_ANNOUNCE_MS,
  ROUND_BUILDUP_MS,
  CARD_REVEAL_FLIP_MS,
  CARD_REVEAL_DISPLAY_MS,
  BETWEEN_REVEALS_MS,
  COMPARISON_PAUSE_MS,
  WINNER_REVEAL_MS,
  WINNER_CLOSE_REVEAL_MS,
  SCORE_UPDATE_MS,
  ROUND_TRANSITION_MS,
} from "./battle-constants";
import Battle from "@/models/battle";
import BattlePull from "@/models/battle-pull";
import Box from "@/models/box";
import Card from "@/models/card";
import User from "@/models/user";
```

- [ ] **Step 2: Add `startReadyCheck` function after the `publish` helper**

```typescript
/* ------------------------------------------------------------------ */
/*  Ready-check                                                        */
/* ------------------------------------------------------------------ */

export async function startReadyCheck(battleId: string): Promise<void> {
  await Battle.updateOne(
    { _id: battleId },
    {
      $set: {
        status: "ready_check",
        readyCheckStartedAt: new Date(),
      },
    },
  );

  publish(battleId, {
    type: "ready_check_start",
    timeoutSeconds: READY_CHECK_TIMEOUT_SECONDS,
  });

  // Wait for the timeout period
  await sleep(READY_CHECK_TIMEOUT_SECONDS * 1000);

  // Re-check battle state — it may have already started if all went ready
  const battle = await Battle.findById(battleId).lean();
  if (!battle || battle.status !== "ready_check") {
    // Battle already started (all players went ready) or was cancelled
    return;
  }

  // Kick non-ready players and refund their coins
  const CoinTransaction = (await import("@/models/coin-transaction")).default;
  const notReadyPlayers = battle.players.filter((p) => !p.ready);
  const readyPlayers = battle.players.filter((p) => p.ready);

  for (const player of notReadyPlayers) {
    const refundAmount = player.coinsReserved;
    if (refundAmount > 0) {
      await User.updateOne(
        { _id: player.user },
        { $inc: { coins: refundAmount } },
      );
      await CoinTransaction.create({
        userId: player.user,
        amount: refundAmount,
        type: "battle_refund",
        relatedBattleId: new mongoose.Types.ObjectId(battleId),
      });
    }
  }

  // Remove non-ready players, reset ready status on remaining, go back to waiting
  const kickedUserIds = notReadyPlayers.map((p) => p.user.toString());

  await Battle.updateOne(
    { _id: battleId },
    {
      $set: {
        status: "waiting",
        readyCheckStartedAt: null,
      },
      $pull: {
        players: { user: { $in: notReadyPlayers.map((p) => p.user) } },
      },
    },
  );

  // Reset ready status for remaining players
  if (readyPlayers.length > 0) {
    for (let i = 0; i < readyPlayers.length; i++) {
      await Battle.updateOne(
        { _id: battleId, "players.user": readyPlayers[i].user },
        { $set: { "players.$.ready": false } },
      );
    }
  }

  publish(battleId, {
    type: "players_kicked",
    kickedUserIds,
    refunded: true,
  });
}
```

- [ ] **Step 3: Rewrite the CLASH ROUNDS section of `runBattle`**

Replace the entire section 3 "CLASH ROUNDS" (lines 197-292) with the new choreography:

```typescript
    /* ============================================================== */
    /*  3. CLASH ROUNDS — sequential reveal with tension               */
    /* ============================================================== */
    await Battle.updateOne({ _id: battleId }, { $set: { status: "clash" } });

    // Track scores locally
    const scores = new Map<string, number>();
    for (const player of battle.players) {
      scores.set(player.user.toString(), 0);
    }

    const playerIds = battle.players.map((p) => p.user.toString());

    for (let r = 0; r < totalRounds; r++) {
      const round = rounds[r];

      // Load card details for reveal
      const cardIds = round.cards.map((c) => c.card);
      const revealCards = await Card.find({ _id: { $in: cardIds } })
        .select("name image")
        .lean();
      const revealMap = new Map(
        revealCards.map((c) => [c._id.toString(), c]),
      );

      // Randomize reveal order each round
      const revealOrder = [...playerIds].sort(() => Math.random() - 0.5);

      // --- Step 1: Round announcement ---
      publish(battleId, {
        type: "round_announce",
        roundIndex: r,
        totalRounds,
        revealOrder,
      });
      await sleep(ROUND_ANNOUNCE_MS);

      // --- Step 2: Buildup (cards appear face-down) ---
      await sleep(ROUND_BUILDUP_MS);

      // --- Step 3: Reveal cards one by one ---
      for (let i = 0; i < revealOrder.length; i++) {
        const playerId = revealOrder[i];
        const cardData = round.cards.find((c) => c.player.toString() === playerId);
        if (!cardData) continue;

        const doc = revealMap.get(cardData.card.toString());
        const rarityBonus = getRarityBonusMs(cardData.rarity);

        publish(battleId, {
          type: "card_reveal",
          roundIndex: r,
          playerId,
          card: {
            _id: cardData.card.toString(),
            name: doc?.name ?? "Unknown",
            image: doc?.image ?? null,
          },
          rarity: cardData.rarity,
          coinValue: cardData.coinValue,
        });

        // Wait for flip animation + display time + rarity bonus
        await sleep(CARD_REVEAL_FLIP_MS + CARD_REVEAL_DISPLAY_MS + rarityBonus);

        // Pause between reveals (except after last card)
        if (i < revealOrder.length - 1) {
          await sleep(BETWEEN_REVEALS_MS);
        }
      }

      // --- Step 4: Comparison pause ---
      await sleep(COMPARISON_PAUSE_MS);

      // --- Step 5: Determine winner ---
      const roundCards = round.cards.map((c) => ({
        playerId: c.player.toString(),
        coinValue: c.coinValue,
        rarity: c.rarity,
      }));
      const winnerId = determineRoundWinner(roundCards);
      const closeMatch = isCloseMatch(roundCards);

      // Update local rounds array
      round.winnerId = winnerId ? new mongoose.Types.ObjectId(winnerId) : null;

      // Update local score (only if there is a winner, not on draw)
      if (winnerId) {
        scores.set(winnerId, (scores.get(winnerId) ?? 0) + 1);
      }

      // Update battle in DB
      const dbUpdate: Record<string, unknown> = {
        [`rounds.${r}.winnerId`]: winnerId
          ? new mongoose.Types.ObjectId(winnerId)
          : null,
        [`rounds.${r}.revealedAt`]: new Date(),
        currentRound: r + 1,
      };
      if (winnerId) {
        dbUpdate[`players.$[p].score`] = scores.get(winnerId);
      }

      await Battle.updateOne(
        { _id: battleId },
        { $set: dbUpdate },
        winnerId
          ? {
              arrayFilters: [
                { "p.user": new mongoose.Types.ObjectId(winnerId) },
              ],
            }
          : {},
      );

      // --- Step 6: Publish round result ---
      publish(battleId, {
        type: "round_result",
        roundIndex: r,
        winnerId,
        scores: Object.fromEntries(scores),
        isClose: closeMatch,
      });

      // Wait for winner reveal animation
      const winnerRevealTime = closeMatch
        ? WINNER_CLOSE_REVEAL_MS
        : WINNER_REVEAL_MS;
      await sleep(winnerRevealTime);

      // Score update display
      await sleep(SCORE_UPDATE_MS);

      // Transition to next round (except after last)
      if (r < totalRounds - 1) {
        await sleep(ROUND_TRANSITION_MS);
      }
    }
```

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: Clean or only downstream client-side errors (fixed in later tasks).

- [ ] **Step 5: Commit**

```bash
git add lib/battle-orchestrator.ts
git commit -m "feat(battle): add ready-check flow and sequential round choreography

- startReadyCheck(): 30s timer, kick non-ready, refund coins
- Rounds: announce → buildup → sequential card_reveal → comparison → result
- Randomized reveal order per round
- Rarity bonus display time
- Close match detection for spotlight animation"
```

---

### Task 6: Join Route — Trigger ready-check instead of direct battle start

**Files:**
- Modify: `app/api/battles/[id]/join/route.ts`

- [ ] **Step 1: Import `startReadyCheck` instead of `runBattle`**

Replace line 9:

```typescript
import { startReadyCheck } from "@/lib/battle-orchestrator";
```

- [ ] **Step 2: Update the active battle check to include `ready_check` status**

Replace line 44:

```typescript
      status: { $in: ["waiting", "ready_check", "countdown", "opening", "clash"] },
```

- [ ] **Step 3: Replace `runBattle` call with `startReadyCheck`**

Replace lines 179-182:

```typescript
    // If battle is now full, start ready check
    if (updatedBattle.players.length >= updatedBattle.maxPlayers) {
      startReadyCheck(updatedBattle._id.toString()).catch(console.error);
    }
```

- [ ] **Step 4: Commit**

```bash
git add app/api/battles/[id]/join/route.ts
git commit -m "feat(battle): trigger ready-check on full lobby instead of direct battle start"
```

---

### Task 7: Events Route — Include ready-check state in sync

**Files:**
- Modify: `app/api/battles/[id]/events/route.ts`

- [ ] **Step 1: Add ready-check fields to the sync payload**

In the `syncPayload` (around line 82), add `readyCheckStartedAt` and `packsPerPlayer`:

```typescript
      const syncPayload = JSON.stringify({
        type: "sync",
        battle: {
          _id: battleId,
          slug: battle.slug,
          status: battle.status,
          currentRound: battle.currentRound,
          totalRounds: battle.totalRounds,
          players: battle.players,
          box: battle.box,
          visibility: battle.visibility,
          maxPlayers: battle.maxPlayers,
          packsPerPlayer: battle.packsPerPlayer,
          rounds: battle.rounds,
          readyCheckStartedAt: battle.readyCheckStartedAt,
          spectatorCount,
        },
        isPlayer,
        ...(myCards !== null ? { myCards } : {}),
      });
```

- [ ] **Step 2: Commit**

```bash
git add app/api/battles/[id]/events/route.ts
git commit -m "feat(battle): include ready-check state in SSE sync payload"
```

---

### Task 8: Battle View — Handle new SSE events

**Files:**
- Modify: `components/battles/battle-view.tsx`

- [ ] **Step 1: Update the Battle interface to include `readyCheckStartedAt`**

Add to the `Battle` interface (after `visibility`, around line 51):

```typescript
interface Battle {
  _id: string;
  slug: string;
  status: "waiting" | "ready_check" | "countdown" | "opening" | "clash" | "finished" | "cancelled";
  maxPlayers: number;
  packsPerPlayer: number;
  players: BattlePlayer[];
  rounds: Round[];
  currentRound: number;
  totalRounds: number;
  box: { name: Record<string, string>; image?: string };
  visibility: string;
  readyCheckStartedAt: string | null;
}
```

- [ ] **Step 2: Add `ready` field to BattlePlayer interface**

```typescript
interface BattlePlayer {
  user: {
    _id: string;
    name: string;
    username?: string;
    image?: string;
    elo: number;
  };
  score: number;
  placement: number | null;
  eloChange: number | null;
  eloAtStart: number;
  ready: boolean;
}
```

- [ ] **Step 3: Add state for current round reveal data**

Add new state variables after line 88 (`const [error, setError]`):

```typescript
  const [revealedCards, setRevealedCards] = useState<Record<string, RoundCard>>({});
  const [roundAnnounce, setRoundAnnounce] = useState<{ roundIndex: number; revealOrder: string[] } | null>(null);
  const [roundResult, setRoundResult] = useState<{ winnerId: string | null; isClose: boolean } | null>(null);
```

- [ ] **Step 4: Add SSE handlers for new events**

Add these event listeners inside `connectSSE`, after the `player_left` handler (after line 168):

```typescript
    es.addEventListener("ready_check_start", (e) => {
      try {
        const data = JSON.parse(e.data);
        setBattle((prev) => prev ? {
          ...prev,
          status: "ready_check",
          readyCheckStartedAt: new Date().toISOString(),
        } : prev);
      } catch { /* ignore */ }
    });

    es.addEventListener("player_ready", (e) => {
      try {
        const data = JSON.parse(e.data);
        setBattle((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            players: prev.players.map((p) =>
              p.user._id === data.userId ? { ...p, ready: true } : p
            ),
          };
        });
      } catch { /* ignore */ }
    });

    es.addEventListener("players_kicked", (e) => {
      try {
        const data = JSON.parse(e.data);
        const kickedIds: string[] = data.kickedUserIds ?? [];
        setBattle((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            status: "waiting",
            readyCheckStartedAt: null,
            players: prev.players
              .filter((p) => !kickedIds.includes(p.user._id))
              .map((p) => ({ ...p, ready: false })),
          };
        });
      } catch { /* ignore */ }
    });

    es.addEventListener("round_announce", (e) => {
      try {
        const data = JSON.parse(e.data);
        setRoundAnnounce({ roundIndex: data.roundIndex, revealOrder: data.revealOrder });
        setRevealedCards({});
        setRoundResult(null);
      } catch { /* ignore */ }
    });

    es.addEventListener("card_reveal", (e) => {
      try {
        const data = JSON.parse(e.data);
        const card: RoundCard = {
          player: data.playerId,
          card: data.card ?? { _id: data.cardId, name: data.name, image: data.image ?? null },
          rarity: data.rarity,
          coinValue: data.coinValue ?? 0,
        };
        setRevealedCards((prev) => ({ ...prev, [data.playerId]: card }));
        setBattle((prev) => {
          if (!prev) return prev;
          return { ...prev, status: "clash", currentRound: data.roundIndex };
        });
      } catch { /* ignore */ }
    });
```

- [ ] **Step 5: Update the `round_result` handler to include `isClose`**

Replace the existing `round_result` handler (lines 210-226):

```typescript
    es.addEventListener("round_result", (e) => {
      try {
        const data = JSON.parse(e.data);
        setRoundResult({ winnerId: data.winnerId ?? null, isClose: data.isClose ?? false });
        setBattle((prev) => {
          if (!prev) return prev;
          const updatedRounds = prev.rounds.map((r) =>
            r.roundIndex === data.roundIndex ? { ...r, winnerId: data.winnerId ?? null } : r
          );
          const scoresMap = data.scores as Record<string, number> | undefined;
          const updatedPlayers = prev.players.map((p) => {
            const newScore = scoresMap?.[p.user._id];
            return newScore !== undefined ? { ...p, score: newScore } : p;
          });
          return { ...prev, rounds: updatedRounds, players: updatedPlayers };
        });
      } catch { /* ignore */ }
    });
```

- [ ] **Step 6: Remove the old `round_reveal` and `opening_complete` handlers**

Remove the `round_reveal` handler (lines 181-208) and the `opening_complete` handler (lines 177-179). These events no longer exist in the new flow.

Replace the `opening_complete` handler with a no-op that just updates status:

```typescript
    es.addEventListener("opening_complete", () => {
      setBattle((prev) => prev ? { ...prev, status: "clash" } : prev);
    });
```

- [ ] **Step 7: Update the `isWaiting` check to include `ready_check`**

Replace line 324:

```typescript
  const isWaiting = battle.status === "waiting" || battle.status === "ready_check" || battle.status === "countdown";
```

- [ ] **Step 8: Pass new props to BattleClash and BattleLobby**

Update the BattleLobby render (around line 333):

```typescript
        {isWaiting && (
          <BattleLobby
            battle={battle}
            dict={dict}
            lang={lang}
            isPlayer={isPlayer}
            onJoin={() => fetchBattle()}
            onLeave={() => fetchBattle()}
          />
        )}
```

Update the BattleClash render (around line 343):

```typescript
        {isClashing && (
          <BattleClash
            battle={battle}
            currentRound={battle.currentRound}
            rounds={battle.rounds}
            players={battle.players}
            dict={dict}
            revealedCards={revealedCards}
            roundAnnounce={roundAnnounce}
            roundResult={roundResult}
          />
        )}
```

- [ ] **Step 9: Commit**

```bash
git add components/battles/battle-view.tsx
git commit -m "feat(battle): handle ready-check and sequential reveal SSE events in battle-view"
```

---

### Task 9: Battle Lobby — Ready-check UI

**Files:**
- Modify: `components/battles/battle-lobby.tsx`

- [ ] **Step 1: Add ready-check state and timer**

Add state variables after line 55 (`const [countdown, setCountdown]`):

```typescript
  const [readying, setReadying] = useState(false);
  const [readyTimer, setReadyTimer] = useState<number | null>(null);
```

Add a computed value after `isCountdown` (line 61):

```typescript
  const isReadyCheck = battle.status === "ready_check";
```

- [ ] **Step 2: Add ready-check countdown timer effect**

Add after the existing countdown useEffect (after line 80):

```typescript
  // Ready-check countdown timer
  useEffect(() => {
    if (!isReadyCheck) {
      setReadyTimer(null);
      return;
    }
    setReadyTimer(30);
    const iv = setInterval(() => {
      setReadyTimer((t) => {
        if (t === null || t <= 1) { clearInterval(iv); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [isReadyCheck]);
```

- [ ] **Step 3: Add `handleReady` function**

Add after the `handleLeave` function (after line 116):

```typescript
  async function handleReady() {
    setReadying(true);
    setActionError("");
    try {
      const res = await fetch(`/api/battles/${battle._id}/ready`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || dict["readyError"] || "Ready fehlgeschlagen.");
      }
    } catch {
      setActionError(dict["error_generic"] || "Ein Fehler ist aufgetreten.");
    } finally {
      setReadying(false);
    }
  }
```

- [ ] **Step 4: Add ready-check overlay**

Replace the existing countdown overlay (lines 121-130) with both ready-check and countdown overlays:

```typescript
      {/* Ready-check overlay */}
      {isReadyCheck && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-[14px] bg-bg/90 backdrop-blur-sm">
          <p className="text-sm font-medium text-text-secondary">
            {dict["readyCheckTitle"] ?? "Bist du bereit?"}
          </p>
          <span className="text-6xl font-extrabold tabular-nums text-pa-green animate-pulse">
            {readyTimer ?? 30}
          </span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {battle.players.map((p) => (
              <div
                key={p.user._id}
                className={[
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all",
                  p.ready
                    ? "bg-pa-green/20 text-pa-green border border-pa-green/40"
                    : "bg-surface text-text-secondary border border-border",
                ].join(" ")}
              >
                {p.ready ? "✓" : "…"} {p.user.username ?? p.user.name}
              </div>
            ))}
          </div>
          {isPlayer && !battle.players.find((p) => p.user._id === (session?.user as { id?: string })?.id)?.ready && (
            <Button
              variant="accent"
              size="lg"
              loading={readying}
              onClick={handleReady}
            >
              {dict["ready"] ?? "Ready!"}
            </Button>
          )}
        </div>
      )}

      {/* Countdown overlay (3-2-1-FIGHT after all ready) */}
      {isCountdown && countdown !== null && countdown > 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[14px] bg-bg/90 backdrop-blur-sm">
          <p className="mb-2 text-sm font-medium text-text-secondary">
            {dict["battleStarting"] ?? "Battle startet in..."}
          </p>
          <span className="text-8xl font-extrabold text-pa-green tabular-nums animate-pulse">
            {countdown}
          </span>
        </div>
      )}
```

- [ ] **Step 5: Fix the countdown timer to use BATTLE_COUNTDOWN_SECONDS (now 3)**

Update the countdown effect (lines 70-80) to use 3 instead of hardcoded 5:

```typescript
  useEffect(() => {
    if (!isCountdown || countdown !== null) return;
    setCountdown(3);
    const iv = setInterval(() => {
      setCountdown((c) => {
        if (c === null || c <= 1) { clearInterval(iv); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [isCountdown]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 6: The Ready-check overlay needs the current user's ID. Import `useSession`**

At the top of the file, add the import:

```typescript
import { useSession } from "next-auth/react";
```

Inside the component, add after line 52:

```typescript
  const { data: session } = useSession();
  const currentUserId = (session?.user as { id?: string } | undefined)?.id;
```

Then update the ready button condition to use `currentUserId`:

```typescript
          {isPlayer && !battle.players.find((p) => p.user._id === currentUserId)?.ready && (
```

- [ ] **Step 7: Hide join/leave buttons during ready-check**

Update the actions section (lines 187-203) to hide during ready check:

```typescript
      {/* Actions */}
      {!isReadyCheck && !isCountdown && (
        <div className="flex flex-wrap items-center gap-3">
          {isPlayer ? (
            <Button variant="danger" size="md" loading={leaving} onClick={handleLeave}>
              {dict["leaveBattle"] ?? "Verlassen"}
            </Button>
          ) : (
            <Button
              variant="accent"
              size="md"
              loading={joining}
              disabled={isFull || joining}
              onClick={handleJoin}
            >
              {isFull ? (dict["battleFull"] ?? "Voll") : (dict["join"] ?? "Beitreten")}
            </Button>
          )}
        </div>
      )}
```

- [ ] **Step 8: Commit**

```bash
git add components/battles/battle-lobby.tsx
git commit -m "feat(battle): add ready-check UI to battle lobby

- 30s timer overlay with per-player ready status
- Ready button for players
- Hide join/leave during ready-check
- 3s countdown after all ready"
```

---

### Task 10: Battle Clash — New sequential reveal choreography

**Files:**
- Modify: `components/battles/battle-clash.tsx`

- [ ] **Step 1: Complete rewrite of battle-clash.tsx**

Replace the entire file content:

```typescript
"use client";

import { useState, useEffect } from "react";
import { Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CardFlip } from "./card-flip";

interface RoundCard {
  player: string;
  card: { _id: string; name: string; image?: string };
  rarity: string;
  coinValue: number;
}

interface Round {
  roundIndex: number;
  cards: RoundCard[];
  winnerId: string | null;
  revealedAt: string | null;
}

interface BattlePlayer {
  user: {
    _id: string;
    name: string;
    username?: string;
    image?: string;
    elo: number;
  };
  score: number;
  placement: number | null;
  eloChange: number | null;
  eloAtStart: number;
  ready: boolean;
}

interface Battle {
  _id: string;
  totalRounds: number;
  status: string;
}

interface BattleClashProps {
  battle: Battle;
  currentRound: number;
  rounds: Round[];
  players: BattlePlayer[];
  dict: Record<string, string>;
  revealedCards: Record<string, RoundCard>;
  roundAnnounce: { roundIndex: number; revealOrder: string[] } | null;
  roundResult: { winnerId: string | null; isClose: boolean } | null;
}

function getStreakCount(rounds: Round[], playerId: string): number {
  let streak = 0;
  for (let i = rounds.length - 1; i >= 0; i--) {
    if (rounds[i].winnerId === playerId) streak++;
    else break;
  }
  return streak;
}

export function BattleClash({
  battle,
  currentRound,
  rounds,
  players,
  dict,
  revealedCards,
  roundAnnounce,
  roundResult,
}: BattleClashProps) {
  const [showAnnounce, setShowAnnounce] = useState(false);
  const [spotlightIndex, setSpotlightIndex] = useState<number | null>(null);

  const isAnnouncing = roundAnnounce !== null && roundAnnounce.roundIndex === currentRound;
  const hasResult = roundResult !== null;
  const isDraw = hasResult && roundResult.winnerId === null;
  const winnerId = roundResult?.winnerId ?? null;
  const isClose = roundResult?.isClose ?? false;

  // Show round announcement animation
  useEffect(() => {
    if (!isAnnouncing) return;
    setShowAnnounce(true);
    const t = setTimeout(() => setShowAnnounce(false), 2500);
    return () => clearTimeout(t);
  }, [isAnnouncing, roundAnnounce?.roundIndex]);

  // Close-match spotlight animation
  useEffect(() => {
    if (!hasResult || !isClose || isDraw) {
      setSpotlightIndex(null);
      return;
    }
    // Cycle spotlight between top players
    const topPlayers = players
      .filter((p) => revealedCards[p.user._id])
      .map((p) => p.user._id);
    if (topPlayers.length < 2) return;

    let i = 0;
    setSpotlightIndex(0);
    const iv = setInterval(() => {
      i++;
      if (i >= 8) {
        clearInterval(iv);
        setSpotlightIndex(null);
        return;
      }
      setSpotlightIndex(i % topPlayers.length);
    }, 400);
    return () => clearInterval(iv);
  }, [hasResult, isClose, isDraw]); // eslint-disable-line react-hooks/exhaustive-deps

  // Determine display order: use reveal order if available, else player order
  const displayOrder = roundAnnounce?.revealOrder ?? players.map((p) => p.user._id);

  return (
    <div className="relative space-y-4">
      {/* Round announcement overlay */}
      {showAnnounce && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[14px] bg-bg/80 backdrop-blur-sm">
          <div className="text-center animate-in zoom-in-50 duration-500">
            <p className="text-sm font-medium text-text-secondary uppercase tracking-widest">
              {dict["round"] ?? "Runde"}
            </p>
            <p className="text-7xl font-black text-pa-green tabular-nums">
              {currentRound + 1}
            </p>
            <p className="text-sm text-text-secondary">
              {dict["of"] ?? "von"} {battle.totalRounds}
            </p>
          </div>
        </div>
      )}

      {/* Round counter */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-text-primary">
          {dict["round"] ?? "Runde"}{" "}
          <span className="text-pa-green">{currentRound + 1}</span>{" "}
          {dict["of"] ?? "von"}{" "}
          {battle.totalRounds}
        </h2>
        {isDraw && (
          <span className="rounded border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-sm font-bold text-yellow-400 animate-pulse">
            {dict["draw"] ?? "Unentschieden!"}
          </span>
        )}
      </div>

      {/* Player cards grid — ordered by reveal order */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {displayOrder.map((playerId, orderIdx) => {
          const player = players.find((p) => p.user._id === playerId);
          if (!player) return null;

          const playerCard = revealedCards[playerId];
          const isRevealed = !!playerCard;
          const isWinner = hasResult && winnerId === playerId;
          const isLoser = hasResult && winnerId !== null && winnerId !== playerId;
          const streak = getStreakCount(rounds, playerId);
          const onFire = streak >= 3;

          // Close-match spotlight: highlight the player the spotlight is on
          const isSpotlit = spotlightIndex !== null && displayOrder[spotlightIndex % displayOrder.length] === playerId;

          return (
            <Card
              key={playerId}
              variant="soft"
              className={[
                "flex flex-col items-center gap-3 p-4 transition-all duration-500",
                isWinner ? "border-pa-green/60 ring-2 ring-pa-green/30 bg-pa-green/5 scale-105" : "",
                isLoser ? "opacity-50 grayscale" : "",
                isDraw && hasResult ? "border-yellow-500/40 ring-1 ring-yellow-500/20" : "",
                isSpotlit ? "ring-2 ring-yellow-400/60 bg-yellow-400/5 scale-105" : "",
              ].join(" ")}
            >
              {/* Player header */}
              <div className="flex items-center gap-2 self-start">
                {player.user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={player.user.image}
                    alt={player.user.name}
                    className="h-7 w-7 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-pa-lila/30">
                    <Users className="h-4 w-4 text-text-secondary" />
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold text-text-primary">
                    {player.user.username ?? player.user.name}
                  </p>
                  {onFire && (
                    <p className="text-[10px] font-bold text-orange-400 animate-pulse">
                      🔥 {dict["onFire"] ?? "ON FIRE!"}
                    </p>
                  )}
                </div>
              </div>

              {/* Card flip */}
              <CardFlip
                key={`round-${currentRound}-${playerId}`}
                card={
                  playerCard
                    ? { name: playerCard.card.name, image: playerCard.card.image, rarity: playerCard.rarity, coinValue: playerCard.coinValue }
                    : { name: "?", rarity: "Common", coinValue: 0 }
                }
                revealed={isRevealed}
                delay={0}
              />

              {/* Winner badge */}
              {isWinner && (
                <span className="rounded border border-pa-green/30 bg-pa-green/10 px-2 py-0.5 text-[10px] font-bold text-pa-green animate-in zoom-in-75 duration-300">
                  ✓ {dict["winner"] ?? "Gewinner"}
                </span>
              )}

              {/* Draw badge */}
              {isDraw && hasResult && (
                <span className="rounded border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-[10px] font-bold text-yellow-400">
                  = {dict["draw"] ?? "Unentschieden"}
                </span>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/battles/battle-clash.tsx
git commit -m "feat(battle): rewrite clash component with sequential reveals and tension

- Sequential card reveals with per-player flip timing
- Round announcement overlay with zoom animation
- Close-match spotlight cycling between top players
- Draw display with yellow highlight
- Winner scale-up + loser grayscale
- Ordered by server-randomized reveal order"
```

---

### Task 11: Card Flip — Rarity-based visual effects

**Files:**
- Modify: `components/battles/card-flip.tsx`

- [ ] **Step 1: Enhance CardFlip with rarity effects**

Replace the entire file content:

```typescript
"use client";

import { useEffect, useState } from "react";
import { RARITY_ORDER } from "@/lib/battle-constants";

interface CardData {
  name: string;
  image?: string;
  rarity: string;
  coinValue: number;
}

interface CardFlipProps {
  card: CardData;
  revealed: boolean;
  delay?: number;
}

const RARITY_GLOW: Record<string, string> = {
  Common: "border-gray-400/60 shadow-gray-400/20",
  Uncommon: "border-green-400/60 shadow-green-400/30",
  Rare: "border-blue-400/60 shadow-blue-400/30",
  "Rare Holo": "border-blue-400/60 shadow-blue-400/30",
  Epic: "border-purple-400/60 shadow-purple-400/40",
  Legendary: "border-yellow-400/60 shadow-yellow-400/40",
  "Ultra Rare": "border-transparent shadow-lg",
};

const RARITY_BADGE: Record<string, string> = {
  Common: "bg-gray-500/20 text-gray-300",
  Uncommon: "bg-green-500/20 text-green-300",
  Rare: "bg-blue-500/20 text-blue-300",
  "Rare Holo": "bg-blue-500/20 text-blue-300",
  Epic: "bg-purple-500/20 text-purple-300",
  Legendary: "bg-yellow-500/20 text-yellow-300",
  "Ultra Rare": "bg-gradient-to-r from-pink-500/30 via-yellow-400/30 to-blue-500/30 text-white",
};

function getRarityTier(rarity: string): "common" | "rare" | "ultra" {
  const order = RARITY_ORDER[rarity] ?? 1;
  if (order >= 5) return "ultra";
  if (order >= 3) return "rare";
  return "common";
}

export function CardFlip({ card, revealed, delay = 0 }: CardFlipProps) {
  const [flipped, setFlipped] = useState(false);
  const [showEffects, setShowEffects] = useState(false);

  useEffect(() => {
    if (!revealed) return;
    const t = setTimeout(() => {
      setFlipped(true);
      // Show rarity effects after flip completes
      setTimeout(() => setShowEffects(true), 700);
    }, delay);
    return () => clearTimeout(t);
  }, [revealed, delay]);

  const glow = RARITY_GLOW[card.rarity] ?? RARITY_GLOW["Common"];
  const badge = RARITY_BADGE[card.rarity] ?? RARITY_BADGE["Common"];
  const tier = getRarityTier(card.rarity);

  return (
    <div className="perspective-500 w-32 h-44">
      <div
        className={[
          "relative h-full w-full transition-transform duration-700",
          showEffects && tier === "ultra" ? "animate-[shake_0.3s_ease-in-out_2]" : "",
        ].join(" ")}
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Back face */}
        <div
          className="absolute inset-0 rounded-[10px] border border-pa-lila/40 bg-gradient-to-br from-pa-lila/30 to-bg/80 flex items-center justify-center"
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="h-10 w-10 rounded-full bg-pa-lila/20 border border-pa-lila/40 flex items-center justify-center">
            <span className="text-lg">⚔️</span>
          </div>
        </div>

        {/* Front face */}
        <div
          className={[
            "absolute inset-0 rounded-[10px] border-2 overflow-hidden flex flex-col",
            glow,
            tier === "ultra"
              ? "shadow-[0_0_24px_6px_rgba(250,200,50,0.45)]"
              : tier === "rare"
              ? "shadow-[0_0_14px_3px_rgba(100,150,255,0.3)]"
              : "shadow-md",
          ].join(" ")}
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            background: tier === "ultra"
              ? "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)"
              : "var(--color-surface, #1a1a1a)",
          }}
        >
          {/* Rarity glow overlay */}
          {showEffects && tier !== "common" && (
            <div
              className={[
                "absolute inset-0 z-10 pointer-events-none rounded-[10px] animate-pulse",
                tier === "ultra"
                  ? "bg-gradient-to-t from-yellow-400/20 via-transparent to-yellow-400/10"
                  : "bg-gradient-to-t from-blue-400/15 via-transparent to-blue-400/5",
              ].join(" ")}
            />
          )}

          {/* Particle dots for ultra rare */}
          {showEffects && tier === "ultra" && (
            <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden rounded-[10px]">
              {Array.from({ length: 6 }).map((_, i) => (
                <span
                  key={i}
                  className="absolute h-1.5 w-1.5 rounded-full bg-yellow-400/70 animate-[float_2s_ease-in-out_infinite]"
                  style={{
                    left: `${15 + i * 14}%`,
                    bottom: `${10 + (i % 3) * 20}%`,
                    animationDelay: `${i * 0.3}s`,
                  }}
                />
              ))}
            </div>
          )}

          {card.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.image}
              alt={card.name}
              className="w-full flex-1 object-cover"
            />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-white/5">
              <span className="text-3xl">🃏</span>
            </div>
          )}
          <div className="px-1.5 py-1 bg-bg/80">
            <p className="truncate text-[10px] font-semibold text-text-primary leading-tight">
              {card.name}
            </p>
            <div className="mt-0.5 flex items-center justify-between gap-1">
              <span className={["rounded px-1 py-0.5 text-[8px] font-bold", badge].join(" ")}>
                {card.rarity}
              </span>
              <span className="text-[9px] text-pa-green font-medium">{card.coinValue}🪙</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the shake and float keyframes to global CSS**

In the project's global CSS file (likely `app/globals.css` or similar), add:

```css
@keyframes shake {
  0%, 100% { transform: rotateY(180deg) translateX(0); }
  25% { transform: rotateY(180deg) translateX(-3px); }
  75% { transform: rotateY(180deg) translateX(3px); }
}

@keyframes float {
  0%, 100% { transform: translateY(0) scale(1); opacity: 0.7; }
  50% { transform: translateY(-12px) scale(1.3); opacity: 1; }
}
```

- [ ] **Step 3: Commit**

```bash
git add components/battles/card-flip.tsx app/globals.css
git commit -m "feat(battle): add rarity-based visual effects to card flip

- Rare+ cards: blue glow overlay after reveal
- Ultra Rare+ cards: golden glow, screen shake, floating particles
- Tiered shadow intensity by rarity"
```

---

### Task 12: TypeScript check and fix any remaining issues

**Files:**
- All modified files

- [ ] **Step 1: Run full TypeScript check**

```bash
npx tsc --noEmit 2>&1
```

Fix any errors that come up. Common expected issues:
- `getRevealDelayMs` is no longer exported from `battle-engine.ts` — any remaining imports need to be updated to `getRarityBonusMs`
- `round_reveal` references in other files may need cleanup
- The `ready` field may need to be added where `BattlePlayer` types are used in other components

- [ ] **Step 2: Run ESLint**

```bash
npx eslint "models/battle.ts" "lib/battle-*.ts" "app/api/battles/**/*.ts" "components/battles/*.tsx" --no-error-on-unmatched-pattern 2>&1
```

Fix any lint errors.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(battle): resolve TypeScript and lint errors from ready-check implementation"
```

---

### Task 13: Update battles-list to show ready_check status

**Files:**
- Modify: `components/battles/battles-list.tsx`
- Modify: `app/api/battles/route.ts`

- [ ] **Step 1: Update the battles API route to include `ready_check` in live statuses**

In `app/api/battles/route.ts`, find where the status filter is set and add `"ready_check"` alongside `"opening"` and `"clash"`:

The default status filter should include: `["waiting", "ready_check", "countdown", "opening", "clash"]`

- [ ] **Step 2: Update battles-list to treat `ready_check` as a live battle**

In `components/battles/battles-list.tsx`, find the logic that splits battles into live/waiting sections. Ensure `"ready_check"` is treated as a live/active battle (alongside `"countdown"`, `"opening"`, `"clash"`), not as a joinable waiting battle.

- [ ] **Step 3: Commit**

```bash
git add components/battles/battles-list.tsx app/api/battles/route.ts
git commit -m "feat(battle): show ready_check battles as live in battles list"
```
