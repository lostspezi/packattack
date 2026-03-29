# Card Clash Battle System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a multiplayer "Card Clash" battle system where users compete by opening packs simultaneously, with round-by-round card reveals, ELO ranking, spectators, preset chat, and full gamification.

**Architecture:** Server-driven battle lifecycle via MongoDB state machine (waiting → countdown → opening → clash → finished). Real-time via SSE + Redis Pub/Sub (existing pattern). Reuses `drawPacks()` from pack-engine, CartItem/PackPull for claim/convert. New models: Battle, BattlePull, Season, BattleAchievement. Battle round progression is server-timed — no client-side timers.

**Tech Stack:** Next.js 16, MongoDB/Mongoose, Redis (ioredis) Pub/Sub, SSE (ReadableStream), Zod validation, existing pack-engine + cart system.

**Spec:** `docs/superpowers/specs/2026-03-29-card-clash-battle-system-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `models/battle.ts` | Battle model (Mongoose schema, interface, indexes) |
| `models/battle-pull.ts` | BattlePull model — cards drawn in battles |
| `models/season.ts` | Season model for monthly competitive seasons |
| `models/battle-achievement.ts` | Achievement unlock tracking |
| `lib/battle-engine.ts` | Core battle logic: scoring, snake-draft distribution, round winner |
| `lib/battle-elo.ts` | ELO calculation, rank thresholds, K-factor logic |
| `lib/battle-achievements.ts` | Achievement check + badge award logic |
| `lib/battle-constants.ts` | Constants: ELO defaults, rank thresholds, preset chat messages, timing |
| `lib/battle-orchestrator.ts` | Server-side battle lifecycle: countdown → draw → rounds → finish |
| `lib/validations/battle.ts` | Zod schemas for battle API inputs |
| `app/api/battles/route.ts` | GET (list) + POST (create) battles |
| `app/api/battles/active/route.ts` | GET active battle for reconnect |
| `app/api/battles/leaderboard/route.ts` | GET leaderboard |
| `app/api/battles/[id]/route.ts` | GET battle details |
| `app/api/battles/[id]/join/route.ts` | POST join battle |
| `app/api/battles/[id]/leave/route.ts` | DELETE leave battle |
| `app/api/battles/[id]/events/route.ts` | GET SSE stream |
| `app/api/battles/[id]/chat/route.ts` | POST preset chat message |
| `app/api/battles/[id]/decide/route.ts` | POST claim/convert after distribution |
| `__tests__/lib/battle-engine.test.ts` | Unit tests for scoring, distribution, round logic |
| `__tests__/lib/battle-elo.test.ts` | Unit tests for ELO calculations |

### Modified Files
| File | Change |
|------|--------|
| `models/user.ts` | Add `elo`, `battleStats` fields |
| `models/coin-transaction.ts` | Add `battle_entry`, `battle_card_conversion` types + `relatedBattleId` field |

---

## Task 1: Constants & Validation Schemas

**Files:**
- Create: `lib/battle-constants.ts`
- Create: `lib/validations/battle.ts`

- [ ] **Step 1: Create battle constants**

```typescript
// lib/battle-constants.ts

// --- ELO ---
export const ELO_DEFAULT = 1000;
export const ELO_K_NEW = 40;       // < 30 battles
export const ELO_K_EXPERIENCED = 20; // >= 30 battles
export const ELO_NEW_THRESHOLD = 30;

export const ELO_RANKS = [
  { key: "bronze",   label: { de: "Bronze", en: "Bronze" },   minElo: 0,    emoji: "🥉" },
  { key: "silver",   label: { de: "Silber", en: "Silver" },   minElo: 1000, emoji: "🥈" },
  { key: "gold",     label: { de: "Gold", en: "Gold" },       minElo: 1200, emoji: "🥇" },
  { key: "diamond",  label: { de: "Diamant", en: "Diamond" }, minElo: 1400, emoji: "💎" },
  { key: "champion", label: { de: "Champion", en: "Champion" }, minElo: 1600, emoji: "👑" },
] as const;

// --- Battle ---
export const BATTLE_COUNTDOWN_SECONDS = 5;
export const ROUND_PAUSE_BASE_MS = 3000;
export const ROUND_PAUSE_RARE_MS = 4000;
export const ROUND_PAUSE_ULTRA_RARE_MS = 5000;
export const BATTLE_MAX_PLAYERS = 20;
export const BATTLE_MIN_PLAYERS = 2;
export const BATTLE_MAX_PACKS = 10;

// --- Preset Chat ---
export const PRESET_CHAT_COOLDOWN_MS = 2000;

export const PRESET_CHAT_MESSAGES = [
  // HYPE
  { key: "hype_1", category: "hype", de: "Let's gooo! 🔥", en: "Let's gooo! 🔥", spectatorOnly: false },
  { key: "hype_2", category: "hype", de: "Nicht schlecht!", en: "Not bad!", spectatorOnly: false },
  { key: "hype_3", category: "hype", de: "Das wird wild!", en: "This is gonna be wild!", spectatorOnly: false },
  { key: "hype_4", category: "hype", de: "Krass!", en: "Insane!", spectatorOnly: false },
  // REACTION
  { key: "react_1", category: "reaction", de: "Das war knapp!", en: "That was close!", spectatorOnly: false },
  { key: "react_2", category: "reaction", de: "Oh nein...", en: "Oh no...", spectatorOnly: false },
  { key: "react_3", category: "reaction", de: "Unglaublich!", en: "Unbelievable!", spectatorOnly: false },
  { key: "react_4", category: "reaction", de: "RIP 💀", en: "RIP 💀", spectatorOnly: false },
  // RESPECT
  { key: "respect_1", category: "respect", de: "Gut gespielt!", en: "Well played!", spectatorOnly: false },
  { key: "respect_2", category: "respect", de: "GG! 🤝", en: "GG! 🤝", spectatorOnly: false },
  { key: "respect_3", category: "respect", de: "Starker Pull!", en: "Great pull!", spectatorOnly: false },
  { key: "respect_4", category: "respect", de: "Respekt!", en: "Respect!", spectatorOnly: false },
  // BATTLE
  { key: "battle_1", category: "battle", de: "Rematch? ⚔️", en: "Rematch? ⚔️", spectatorOnly: false },
  { key: "battle_2", category: "battle", de: "Ich bin bereit!", en: "I'm ready!", spectatorOnly: false },
  { key: "battle_3", category: "battle", de: "Glück gehabt! 😏", en: "Lucky! 😏", spectatorOnly: false },
  { key: "battle_4", category: "battle", de: "Nächstes Mal!", en: "Next time!", spectatorOnly: false },
  // SPECTATOR
  { key: "spec_1", category: "spectator", de: "Spannend! 🍿", en: "Exciting! 🍿", spectatorOnly: true },
  { key: "spec_2", category: "spectator", de: "Go go go!", en: "Go go go!", spectatorOnly: true },
  { key: "spec_3", category: "spectator", de: "Was ein Battle!", en: "What a battle!", spectatorOnly: true },
  { key: "spec_4", category: "spectator", de: "😱😱😱", en: "😱😱😱", spectatorOnly: true },
] as const;

// --- Rarity ordering for tiebreaker ---
export const RARITY_ORDER: Record<string, number> = {
  "Common": 1,
  "Uncommon": 2,
  "Rare": 3,
  "Rare Holo": 4,
  "Ultra Rare": 5,
  "Secret Rare": 6,
  "Illustration Rare": 7,
  "Special Illustration Rare": 8,
  "Hyper Rare": 9,
};

// --- Achievements ---
export const BATTLE_ACHIEVEMENTS = [
  { key: "first_clash",    label: { de: "Erster Clash", en: "First Clash" },     tone: "neutral" as const, condition: "first_battle" },
  { key: "win_streak_3",   label: { de: "On Fire", en: "On Fire" },              tone: "gold" as const,    condition: "win_streak_3" },
  { key: "underdog",       label: { de: "Underdog", en: "Underdog" },            tone: "lilac" as const,   condition: "underdog" },
  { key: "sharpshooter",   label: { de: "Scharfschütze", en: "Sharpshooter" },   tone: "blue" as const,    condition: "round_streak_10" },
  { key: "champion_rank",  label: { de: "Champion", en: "Champion" },            tone: "gold" as const,    condition: "champion_rank" },
  { key: "veteran",        label: { de: "Veteran", en: "Veteran" },              tone: "green" as const,   condition: "battles_100" },
  { key: "jackpot",        label: { de: "Jackpot", en: "Jackpot" },              tone: "gold" as const,    condition: "ultra_rare_pull" },
  { key: "host_10",        label: { de: "Gastgeber", en: "Host" },               tone: "green" as const,   condition: "hosted_10" },
] as const;

export type PresetChatKey = typeof PRESET_CHAT_MESSAGES[number]["key"];
```

- [ ] **Step 2: Create Zod validation schemas**

```typescript
// lib/validations/battle.ts
import { z } from "zod";
import { BATTLE_MAX_PLAYERS, BATTLE_MIN_PLAYERS, BATTLE_MAX_PACKS, PRESET_CHAT_MESSAGES } from "../battle-constants";

export const createBattleSchema = z.object({
  boxId: z.string().min(1),
  packsPerPlayer: z.number().int().min(1).max(BATTLE_MAX_PACKS),
  maxPlayers: z.number().int().min(BATTLE_MIN_PLAYERS).max(BATTLE_MAX_PLAYERS),
  visibility: z.enum(["public", "private"]).default("public"),
  minElo: z.number().int().min(0).nullable().default(null),
});

export const joinBattleSchema = z.object({});

export const battleChatSchema = z.object({
  messageKey: z.enum(PRESET_CHAT_MESSAGES.map(m => m.key) as [string, ...string[]]),
});

export const battleDecideSchema = z.object({
  battlePullId: z.string().min(1),
  decision: z.enum(["claim", "convert"]),
});

export const battleListSchema = z.object({
  status: z.enum(["waiting", "countdown", "opening", "clash", "finished"]).optional(),
  game: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const leaderboardSchema = z.object({
  category: z.enum(["elo", "wins", "streak", "pull_value"]).default("elo"),
  seasonId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
```

- [ ] **Step 3: Commit**

```bash
git add lib/battle-constants.ts lib/validations/battle.ts
git commit -m "feat(battle): add constants and validation schemas"
```

---

## Task 2: Data Models

**Files:**
- Create: `models/battle.ts`
- Create: `models/battle-pull.ts`
- Create: `models/season.ts`
- Create: `models/battle-achievement.ts`
- Modify: `models/user.ts`
- Modify: `models/coin-transaction.ts`

- [ ] **Step 1: Create Battle model**

```typescript
// models/battle.ts
import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IBattlePlayer {
  user: Types.ObjectId;
  joinedAt: Date;
  coinsReserved: number;
  eloAtStart: number;
  score: number;
  placement: number | null;
  eloChange: number | null;
}

export interface IBattleRoundCard {
  player: Types.ObjectId;
  card: Types.ObjectId;
  rarity: string;
  coinValue: number;
}

export interface IBattleRound {
  roundIndex: number;
  cards: IBattleRoundCard[];
  winnerId: Types.ObjectId | null;
  revealedAt: Date | null;
}

export interface IBattle extends Document {
  slug: string;
  createdBy: Types.ObjectId;
  box: Types.ObjectId;
  packsPerPlayer: number;
  maxPlayers: number;
  status: "waiting" | "countdown" | "opening" | "clash" | "finished" | "cancelled";
  visibility: "public" | "private";
  minElo: number | null;
  players: IBattlePlayer[];
  rounds: IBattleRound[];
  currentRound: number;
  totalRounds: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  seasonId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const BattleRoundCardSchema = new Schema(
  {
    player: { type: Schema.Types.ObjectId, ref: "User", required: true },
    card: { type: Schema.Types.ObjectId, ref: "Card", required: true },
    rarity: { type: String, required: true },
    coinValue: { type: Number, required: true },
  },
  { _id: false }
);

const BattleRoundSchema = new Schema(
  {
    roundIndex: { type: Number, required: true },
    cards: { type: [BattleRoundCardSchema], required: true },
    winnerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    revealedAt: { type: Date, default: null },
  },
  { _id: false }
);

const BattlePlayerSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    joinedAt: { type: Date, default: Date.now },
    coinsReserved: { type: Number, required: true },
    eloAtStart: { type: Number, required: true },
    score: { type: Number, default: 0 },
    placement: { type: Number, default: null },
    eloChange: { type: Number, default: null },
  },
  { _id: false }
);

const BattleSchema = new Schema<IBattle>(
  {
    slug: { type: String, required: true, unique: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    box: { type: Schema.Types.ObjectId, ref: "Box", required: true },
    packsPerPlayer: { type: Number, required: true, min: 1, max: 10 },
    maxPlayers: { type: Number, required: true, min: 2 },
    status: {
      type: String,
      enum: ["waiting", "countdown", "opening", "clash", "finished", "cancelled"],
      default: "waiting",
      required: true,
    },
    visibility: { type: String, enum: ["public", "private"], default: "public" },
    minElo: { type: Number, default: null },
    players: { type: [BattlePlayerSchema], default: [] },
    rounds: { type: [BattleRoundSchema], default: [] },
    currentRound: { type: Number, default: 0 },
    totalRounds: { type: Number, required: true },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    seasonId: { type: Schema.Types.ObjectId, ref: "Season", default: null },
  },
  { timestamps: true }
);

BattleSchema.index({ status: 1, visibility: 1 });
BattleSchema.index({ "players.user": 1, status: 1 });
BattleSchema.index({ createdBy: 1 });
BattleSchema.index({ seasonId: 1, finishedAt: -1 });

const Battle: Model<IBattle> =
  mongoose.models.Battle ?? mongoose.model<IBattle>("Battle", BattleSchema);

export default Battle;
```

- [ ] **Step 2: Create BattlePull model**

```typescript
// models/battle-pull.ts
import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IBattlePull extends Document {
  battle: Types.ObjectId;
  user: Types.ObjectId;
  card: Types.ObjectId;
  rarity: string;
  coinValue: number;
  conversionValue: number;
  roundIndex: number;
  status: "pending" | "distributed" | "claimed" | "converted";
  distributedTo: Types.ObjectId | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const BattlePullSchema = new Schema<IBattlePull>(
  {
    battle: { type: Schema.Types.ObjectId, ref: "Battle", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    card: { type: Schema.Types.ObjectId, ref: "Card", required: true },
    rarity: { type: String, required: true },
    coinValue: { type: Number, required: true },
    conversionValue: { type: Number, required: true },
    roundIndex: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "distributed", "claimed", "converted"],
      default: "pending",
      required: true,
    },
    distributedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

BattlePullSchema.index({ battle: 1, roundIndex: 1 });
BattlePullSchema.index({ battle: 1, user: 1 });
BattlePullSchema.index({ distributedTo: 1, status: 1 });

const BattlePull: Model<IBattlePull> =
  mongoose.models.BattlePull ?? mongoose.model<IBattlePull>("BattlePull", BattlePullSchema);

export default BattlePull;
```

- [ ] **Step 3: Create Season model**

```typescript
// models/season.ts
import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface ISeasonReward {
  minPlacement: number;
  maxPlacement: number;
  type: "badge" | "coins";
  badgeKey: string | null;
  coinAmount: number | null;
}

export interface ISeason extends Document {
  name: { de: string; en: string };
  number: number;
  startsAt: Date;
  endsAt: Date;
  status: "upcoming" | "active" | "ended";
  rewards: ISeasonReward[];
  createdAt: Date;
  updatedAt: Date;
}

const SeasonRewardSchema = new Schema(
  {
    minPlacement: { type: Number, required: true },
    maxPlacement: { type: Number, required: true },
    type: { type: String, enum: ["badge", "coins"], required: true },
    badgeKey: { type: String, default: null },
    coinAmount: { type: Number, default: null },
  },
  { _id: false }
);

const SeasonSchema = new Schema<ISeason>(
  {
    name: {
      de: { type: String, required: true },
      en: { type: String, required: true },
    },
    number: { type: Number, required: true, unique: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["upcoming", "active", "ended"],
      default: "upcoming",
      required: true,
    },
    rewards: { type: [SeasonRewardSchema], default: [] },
  },
  { timestamps: true }
);

SeasonSchema.index({ status: 1 });

const Season: Model<ISeason> =
  mongoose.models.Season ?? mongoose.model<ISeason>("Season", SeasonSchema);

export default Season;
```

- [ ] **Step 4: Create BattleAchievement model**

```typescript
// models/battle-achievement.ts
import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IBattleAchievement extends Document {
  user: Types.ObjectId;
  key: string;
  unlockedAt: Date;
  battle: Types.ObjectId | null;
}

const BattleAchievementSchema = new Schema<IBattleAchievement>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    key: { type: String, required: true },
    unlockedAt: { type: Date, default: Date.now },
    battle: { type: Schema.Types.ObjectId, ref: "Battle", default: null },
  },
  { timestamps: false }
);

BattleAchievementSchema.index({ user: 1, key: 1 }, { unique: true });

const BattleAchievement: Model<IBattleAchievement> =
  mongoose.models.BattleAchievement ?? mongoose.model<IBattleAchievement>("BattleAchievement", BattleAchievementSchema);

export default BattleAchievement;
```

- [ ] **Step 5: Extend User model — add `elo` and `battleStats`**

In `models/user.ts`:

Add to `IUser` interface (after `coins: number;` on line 17):
```typescript
  elo: number;
  battleStats: {
    wins: number;
    losses: number;
    streak: number;
    bestStreak: number;
    totalBattles: number;
    battlesCreated: number;
  };
```

Add to `UserSchema` (after `coins` field on line 150):
```typescript
    elo: { type: Number, default: 1000 },
    battleStats: {
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      streak: { type: Number, default: 0 },
      bestStreak: { type: Number, default: 0 },
      totalBattles: { type: Number, default: 0 },
      battlesCreated: { type: Number, default: 0 },
    },
```

- [ ] **Step 6: Extend CoinTransaction model — add battle types**

In `models/coin-transaction.ts`:

Update the type union (line 6) to:
```typescript
  type: "admin_grant" | "admin_deduct" | "pack_purchase" | "card_conversion" | "bulk_conversion" | "coin_purchase" | "shipping_payment" | "reservation_expired" | "battle_entry" | "battle_card_conversion" | "battle_refund";
```

Update the enum array (line 22) to:
```typescript
      enum: ["admin_grant", "admin_deduct", "pack_purchase", "card_conversion", "bulk_conversion", "coin_purchase", "shipping_payment", "reservation_expired", "battle_entry", "battle_card_conversion", "battle_refund"],
```

Add after `relatedOrderId` field (line 29):
```typescript
    relatedBattleId: { type: Schema.Types.ObjectId, ref: "Battle", default: null },
```

Add to `ICoinTransaction` interface (after `relatedOrderId` on line 12):
```typescript
  relatedBattleId: Types.ObjectId | null;
```

- [ ] **Step 7: Commit**

```bash
git add models/battle.ts models/battle-pull.ts models/season.ts models/battle-achievement.ts models/user.ts models/coin-transaction.ts
git commit -m "feat(battle): add data models and extend User/CoinTransaction"
```

---

## Task 3: ELO Engine (TDD)

**Files:**
- Create: `lib/battle-elo.ts`
- Create: `__tests__/lib/battle-elo.test.ts`

- [ ] **Step 1: Write failing tests for ELO calculation**

```typescript
// __tests__/lib/battle-elo.test.ts
import { describe, it, expect } from "vitest";
import { calculateEloChanges, getEloRank, getKFactor } from "@/lib/battle-elo";

describe("getKFactor", () => {
  it("returns 40 for new players with < 30 battles", () => {
    expect(getKFactor(0)).toBe(40);
    expect(getKFactor(29)).toBe(40);
  });
  it("returns 20 for experienced players with >= 30 battles", () => {
    expect(getKFactor(30)).toBe(20);
    expect(getKFactor(100)).toBe(20);
  });
});

describe("getEloRank", () => {
  it("returns bronze for ELO < 1000", () => {
    expect(getEloRank(500).key).toBe("bronze");
  });
  it("returns silver for ELO 1000-1199", () => {
    expect(getEloRank(1000).key).toBe("silver");
    expect(getEloRank(1199).key).toBe("silver");
  });
  it("returns gold for ELO 1200-1399", () => {
    expect(getEloRank(1200).key).toBe("gold");
  });
  it("returns diamond for ELO 1400-1599", () => {
    expect(getEloRank(1400).key).toBe("diamond");
  });
  it("returns champion for ELO >= 1600", () => {
    expect(getEloRank(1600).key).toBe("champion");
    expect(getEloRank(2000).key).toBe("champion");
  });
});

describe("calculateEloChanges", () => {
  it("gives positive change to winner, negative to loser in 1v1", () => {
    const result = calculateEloChanges([
      { userId: "a", elo: 1000, totalBattles: 0, placement: 1 },
      { userId: "b", elo: 1000, totalBattles: 0, placement: 2 },
    ]);
    expect(result.get("a")!).toBeGreaterThan(0);
    expect(result.get("b")!).toBeLessThan(0);
  });

  it("sums to zero across all players", () => {
    const result = calculateEloChanges([
      { userId: "a", elo: 1200, totalBattles: 50, placement: 1 },
      { userId: "b", elo: 1000, totalBattles: 50, placement: 2 },
      { userId: "c", elo: 1100, totalBattles: 50, placement: 3 },
    ]);
    const sum = Array.from(result.values()).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum)).toBeLessThan(1); // floating point tolerance
  });

  it("gives more points for beating higher-rated opponents", () => {
    const upset = calculateEloChanges([
      { userId: "a", elo: 800, totalBattles: 50, placement: 1 },
      { userId: "b", elo: 1400, totalBattles: 50, placement: 2 },
    ]);
    const expected = calculateEloChanges([
      { userId: "a", elo: 1400, totalBattles: 50, placement: 1 },
      { userId: "b", elo: 800, totalBattles: 50, placement: 2 },
    ]);
    expect(upset.get("a")!).toBeGreaterThan(expected.get("a")!);
  });

  it("uses higher K-factor for new players", () => {
    const newPlayer = calculateEloChanges([
      { userId: "a", elo: 1000, totalBattles: 5, placement: 1 },
      { userId: "b", elo: 1000, totalBattles: 5, placement: 2 },
    ]);
    const expPlayer = calculateEloChanges([
      { userId: "a", elo: 1000, totalBattles: 50, placement: 1 },
      { userId: "b", elo: 1000, totalBattles: 50, placement: 2 },
    ]);
    expect(Math.abs(newPlayer.get("a")!)).toBeGreaterThan(Math.abs(expPlayer.get("a")!));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/lib/battle-elo.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement ELO engine**

```typescript
// lib/battle-elo.ts
import {
  ELO_DEFAULT,
  ELO_K_NEW,
  ELO_K_EXPERIENCED,
  ELO_NEW_THRESHOLD,
  ELO_RANKS,
} from "./battle-constants";

export function getKFactor(totalBattles: number): number {
  return totalBattles < ELO_NEW_THRESHOLD ? ELO_K_NEW : ELO_K_EXPERIENCED;
}

export function getEloRank(elo: number) {
  for (let i = ELO_RANKS.length - 1; i >= 0; i--) {
    if (elo >= ELO_RANKS[i].minElo) return ELO_RANKS[i];
  }
  return ELO_RANKS[0];
}

interface EloPlayer {
  userId: string;
  elo: number;
  totalBattles: number;
  placement: number; // 1 = winner
}

/**
 * Calculate ELO changes for a multi-player battle.
 * Each player is compared against the average ELO of opponents.
 * Score: 1 for each opponent placed below you, 0 for each above, 0.5 for equal.
 */
export function calculateEloChanges(players: EloPlayer[]): Map<string, number> {
  const n = players.length;
  const changes = new Map<string, number>();

  for (const player of players) {
    const k = getKFactor(player.totalBattles);
    let totalExpected = 0;
    let totalScore = 0;

    for (const opponent of players) {
      if (opponent.userId === player.userId) continue;

      // Expected score against this opponent
      const expected = 1 / (1 + Math.pow(10, (opponent.elo - player.elo) / 400));
      totalExpected += expected;

      // Actual score: 1 if placed higher, 0 if lower, 0.5 if equal
      if (player.placement < opponent.placement) {
        totalScore += 1;
      } else if (player.placement === opponent.placement) {
        totalScore += 0.5;
      }
    }

    const change = Math.round(k * (totalScore - totalExpected));
    changes.set(player.userId, change);
  }

  return changes;
}

export function softResetElo(elo: number): number {
  return Math.round((elo - ELO_DEFAULT) * 0.5 + ELO_DEFAULT);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/lib/battle-elo.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add lib/battle-elo.ts __tests__/lib/battle-elo.test.ts
git commit -m "feat(battle): add ELO engine with tests"
```

---

## Task 4: Battle Engine — Scoring & Distribution (TDD)

**Files:**
- Create: `lib/battle-engine.ts`
- Create: `__tests__/lib/battle-engine.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/lib/battle-engine.test.ts
import { describe, it, expect } from "vitest";
import { determineRoundWinner, snakeDraftDistribute, calculatePlacements } from "@/lib/battle-engine";

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
    // 4 players, 8 cards sorted by value desc
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
    const placements = ["p1", "p2", "p3", "p4"]; // p1 = 1st place

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/lib/battle-engine.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement battle engine**

```typescript
// lib/battle-engine.ts
import { RARITY_ORDER } from "./battle-constants";

interface RoundCard {
  playerId: string;
  coinValue: number;
  rarity: string;
}

/**
 * Determine the winner of a single round.
 * Primary: highest coinValue. Tiebreaker: highest rarity. Final: random.
 */
export function determineRoundWinner(cards: RoundCard[]): string {
  const sorted = [...cards].sort((a, b) => {
    if (b.coinValue !== a.coinValue) return b.coinValue - a.coinValue;
    const rarityA = RARITY_ORDER[a.rarity] ?? 0;
    const rarityB = RARITY_ORDER[b.rarity] ?? 0;
    if (rarityB !== rarityA) return rarityB - rarityA;
    return Math.random() - 0.5;
  });
  return sorted[0].playerId;
}

interface PlacementPlayer {
  userId: string;
  score: number;
  totalValue: number;
}

/**
 * Calculate final placements. Primary: score desc. Tiebreaker: totalValue desc.
 */
export function calculatePlacements(
  players: PlacementPlayer[]
): Array<{ userId: string; placement: number }> {
  const sorted = [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.totalValue - a.totalValue;
  });
  return sorted.map((p, i) => ({ userId: p.userId, placement: i + 1 }));
}

interface DistributableCard {
  id: string;
  coinValue: number;
}

/**
 * Snake-draft distribution of cards to players ordered by placement.
 * Cards must be pre-sorted by coinValue descending.
 * Round 1: P1, P2, P3, P4. Round 2: P4, P3, P2, P1. Repeat.
 */
export function snakeDraftDistribute<T extends DistributableCard>(
  cards: T[],
  playersByPlacement: string[]
): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const p of playersByPlacement) result.set(p, []);

  const n = playersByPlacement.length;
  for (let i = 0; i < cards.length; i++) {
    const round = Math.floor(i / n);
    const posInRound = i % n;
    const isReverse = round % 2 === 1;
    const playerIndex = isReverse ? n - 1 - posInRound : posInRound;
    result.get(playersByPlacement[playerIndex])!.push(cards[i]);
  }

  return result;
}

/**
 * Get the rarity-based reveal delay in ms for animation timing.
 */
export function getRevealDelayMs(maxRarity: string): number {
  const order = RARITY_ORDER[maxRarity] ?? 1;
  if (order >= 5) return 5000; // Ultra Rare+
  if (order >= 3) return 4000; // Rare+
  return 3000; // Common/Uncommon
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/lib/battle-engine.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add lib/battle-engine.ts __tests__/lib/battle-engine.test.ts
git commit -m "feat(battle): add battle engine (scoring, snake-draft, round logic)"
```

---

## Task 5: Battle Orchestrator — Server-Side Lifecycle

**Files:**
- Create: `lib/battle-orchestrator.ts`

This is the core server-side coordinator. It handles the transition from `countdown → opening → clash → finished`, drawing cards, advancing rounds, and distributing cards. It runs asynchronously after the last player joins.

- [ ] **Step 1: Implement battle orchestrator**

```typescript
// lib/battle-orchestrator.ts
import { randomUUID } from "crypto";
import mongoose from "mongoose";
import Battle, { IBattle } from "@/models/battle";
import BattlePull from "@/models/battle-pull";
import Box from "@/models/box";
import Card from "@/models/card";
import User from "@/models/user";
import CoinTransaction from "@/models/coin-transaction";
import { drawPacks, PackCard } from "./pack-engine";
import { determineRoundWinner, calculatePlacements, snakeDraftDistribute, getRevealDelayMs } from "./battle-engine";
import { calculateEloChanges } from "./battle-elo";
import { getRedis } from "./redis";
import {
  BATTLE_COUNTDOWN_SECONDS,
} from "./battle-constants";

function publishBattleEvent(battleId: string, event: Record<string, unknown>) {
  const redis = getRedis();
  redis.publish(`battle:${battleId}`, JSON.stringify(event)).catch(() => {});
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Orchestrate a battle from countdown to finish.
 * Called once when the last player joins and all slots are full.
 * Runs asynchronously — does NOT block the HTTP response.
 */
export async function runBattle(battleId: string): Promise<void> {
  try {
    // --- COUNTDOWN ---
    await Battle.updateOne({ _id: battleId }, { $set: { status: "countdown" } });
    publishBattleEvent(battleId, { type: "battle_start", countdown: BATTLE_COUNTDOWN_SECONDS });
    await sleep(BATTLE_COUNTDOWN_SECONDS * 1000);

    // --- OPENING: Draw cards for all players ---
    await Battle.updateOne({ _id: battleId }, { $set: { status: "opening" } });
    publishBattleEvent(battleId, { type: "status_change", status: "opening" });

    const battle = await Battle.findById(battleId).lean();
    if (!battle || battle.status === "cancelled") return;

    const box = await Box.findById(battle.box).lean();
    if (!box) return;

    // Build card pool (same as pack opening)
    const packCards: PackCard[] = [];
    const cardIds = box.cards.map((c: any) => c.card);
    const cardDocs = await Card.find({ _id: { $in: cardIds } }).lean();
    const cardMap = new Map(cardDocs.map((c: any) => [c._id.toString(), c]));

    for (const entry of box.cards) {
      const card = cardMap.get(entry.card.toString());
      if (!card || entry.stock <= 0) continue;
      packCards.push({
        cardId: card._id.toString(),
        name: card.name,
        rarity: entry.rarity,
        weight: entry.weight,
        stock: entry.stock,
        coinValue: card.internalPrice ?? 0,
        image: card.image ?? null,
      });
    }

    // Draw packs for each player sequentially (shared stock pool)
    const allPulls: Array<{
      playerId: string;
      cardId: string;
      rarity: string;
      coinValue: number;
      conversionValue: number;
      roundIndex: number;
    }> = [];

    for (const player of battle.players) {
      const result = drawPacks(packCards, box.cardsPerPack, battle.packsPerPlayer, box.priceInCoins);

      for (const drawn of result.drawnCards) {
        // Update local stock tracking for next player
        const pc = packCards.find((c) => c.cardId === drawn.cardId);
        if (pc) pc.stock = Math.max(0, pc.stock - 1);

        allPulls.push({
          playerId: player.user.toString(),
          cardId: drawn.cardId,
          rarity: drawn.rarity,
          coinValue: drawn.coinValue,
          conversionValue: drawn.conversionValue,
          roundIndex: drawn.cardIndex + drawn.packIndex * box.cardsPerPack,
        });
      }

      // Decrement box stock atomically
      const stockUpdates: Record<string, number> = {};
      for (const d of result.drawnCards) {
        stockUpdates[d.cardId] = (stockUpdates[d.cardId] ?? 0) + 1;
      }
      for (const [cardId, count] of Object.entries(stockUpdates)) {
        const oid = new mongoose.Types.ObjectId(cardId);
        for (let i = 0; i < count; i++) {
          await Box.updateOne(
            { _id: battle.box, "cards.card": oid, "cards.stock": { $gte: 1 } },
            { $inc: { "cards.$.stock": -1 } }
          );
        }
      }
    }

    // Create CoinTransaction for each player
    for (const player of battle.players) {
      await CoinTransaction.create({
        userId: player.user,
        amount: -player.coinsReserved,
        type: "battle_entry",
        relatedBattleId: battleId,
        relatedBoxId: battle.box,
      });
    }

    // Save BattlePull records
    const pullDocs = allPulls.map((p) => ({
      battle: battleId,
      user: p.playerId,
      card: p.cardId,
      rarity: p.rarity,
      coinValue: p.coinValue,
      conversionValue: p.conversionValue,
      roundIndex: p.roundIndex,
      status: "pending" as const,
      distributedTo: null,
      decidedAt: null,
    }));
    await BattlePull.insertMany(pullDocs);

    // Build rounds data from pulls
    const totalRounds = battle.totalRounds;
    const rounds: IBattle["rounds"] = [];

    for (let r = 0; r < totalRounds; r++) {
      const roundPulls = allPulls.filter((p) => p.roundIndex === r);
      rounds.push({
        roundIndex: r,
        cards: roundPulls.map((p) => ({
          player: new mongoose.Types.ObjectId(p.playerId),
          card: new mongoose.Types.ObjectId(p.cardId),
          rarity: p.rarity,
          coinValue: p.coinValue,
        })),
        winnerId: null,
        revealedAt: null,
      });
    }

    await Battle.updateOne(
      { _id: battleId },
      { $set: { status: "clash", rounds, currentRound: 0 } }
    );

    // --- CLASH ROUNDS ---
    for (let r = 0; r < totalRounds; r++) {
      const round = rounds[r];

      // Load card details for the reveal
      const roundCardIds = round.cards.map((c) => c.card);
      const roundCardDocs = await Card.find({ _id: { $in: roundCardIds } }).lean();
      const roundCardMap = new Map(roundCardDocs.map((c: any) => [c._id.toString(), c]));

      // Determine round winner
      const roundCards = round.cards.map((c) => ({
        playerId: c.player.toString(),
        coinValue: c.coinValue,
        rarity: c.rarity,
      }));
      const winnerId = determineRoundWinner(roundCards);

      // Publish reveal event (clients animate the flip)
      const revealData = round.cards.map((c) => {
        const cardDoc = roundCardMap.get(c.card.toString());
        return {
          playerId: c.player.toString(),
          cardName: cardDoc?.name ?? "Unknown",
          cardImage: cardDoc?.image ?? null,
          rarity: c.rarity,
          coinValue: c.coinValue,
        };
      });

      // Determine max rarity for timing
      const maxRarity = round.cards.reduce((max, c) => {
        const order = (await import("./battle-constants")).RARITY_ORDER;
        return (order[c.rarity] ?? 0) > (order[max] ?? 0) ? c.rarity : max;
      }, "Common");
      // Note: the above async import won't work inline — fix below
      const { RARITY_ORDER } = await import("./battle-constants");
      const maxRarityValue = Math.max(...round.cards.map(c => RARITY_ORDER[c.rarity] ?? 0));
      const maxRarityName = round.cards.find(c => (RARITY_ORDER[c.rarity] ?? 0) === maxRarityValue)?.rarity ?? "Common";

      publishBattleEvent(battleId, {
        type: "round_reveal",
        roundIndex: r,
        totalRounds,
        cards: revealData,
      });

      // Wait for animation
      await sleep(getRevealDelayMs(maxRarityName));

      // Update scores
      await Battle.updateOne(
        { _id: battleId, "players.user": new mongoose.Types.ObjectId(winnerId) },
        {
          $inc: { "players.$.score": 1 },
          $set: {
            [`rounds.${r}.winnerId`]: new mongoose.Types.ObjectId(winnerId),
            [`rounds.${r}.revealedAt`]: new Date(),
            currentRound: r + 1,
          },
        }
      );

      // Publish round result
      publishBattleEvent(battleId, {
        type: "round_result",
        roundIndex: r,
        winnerId,
      });

      // Brief pause between rounds
      if (r < totalRounds - 1) await sleep(1500);
    }

    // --- FINISH: Calculate placements, ELO, distribute ---
    const finalBattle = await Battle.findById(battleId).lean();
    if (!finalBattle) return;

    // Calculate placements
    const playerTotalValues = new Map<string, number>();
    for (const pull of allPulls) {
      playerTotalValues.set(pull.playerId, (playerTotalValues.get(pull.playerId) ?? 0) + pull.coinValue);
    }

    const placementInput = finalBattle.players.map((p) => ({
      userId: p.user.toString(),
      score: p.score,
      totalValue: playerTotalValues.get(p.user.toString()) ?? 0,
    }));
    const placements = calculatePlacements(placementInput);

    // Calculate ELO changes
    const eloInput = finalBattle.players.map((p) => {
      const pl = placements.find((x) => x.userId === p.user.toString())!;
      return {
        userId: p.user.toString(),
        elo: p.eloAtStart,
        totalBattles: 0, // Will be loaded below
        placement: pl.placement,
      };
    });

    // Load actual totalBattles for K-factor
    const userIds = finalBattle.players.map((p) => p.user);
    const users = await User.find({ _id: { $in: userIds } }).select("battleStats").lean();
    const userBattleMap = new Map(users.map((u: any) => [u._id.toString(), u.battleStats?.totalBattles ?? 0]));
    for (const ei of eloInput) {
      ei.totalBattles = userBattleMap.get(ei.userId) ?? 0;
    }

    const eloChanges = calculateEloChanges(eloInput);

    // Update battle with placements and ELO changes
    const bulkPlayerUpdates: any[] = [];
    for (const p of placements) {
      const eloChange = eloChanges.get(p.userId) ?? 0;
      bulkPlayerUpdates.push(
        Battle.updateOne(
          { _id: battleId, "players.user": new mongoose.Types.ObjectId(p.userId) },
          {
            $set: {
              "players.$.placement": p.placement,
              "players.$.eloChange": eloChange,
            },
          }
        )
      );
    }
    await Promise.all(bulkPlayerUpdates);

    // Update user ELO and battle stats
    const winner = placements.find((p) => p.placement === 1)!;
    for (const p of placements) {
      const eloChange = eloChanges.get(p.userId) ?? 0;
      const isWin = p.placement === 1;
      await User.updateOne(
        { _id: p.userId },
        {
          $inc: {
            elo: eloChange,
            "battleStats.totalBattles": 1,
            "battleStats.wins": isWin ? 1 : 0,
            "battleStats.losses": isWin ? 0 : 1,
          },
          $set: isWin
            ? {
                "battleStats.streak": (userBattleMap.get(p.userId) ?? 0) + 1, // This needs streak from user
              }
            : { "battleStats.streak": 0 },
        }
      );
    }

    // Fix streak calculation — load current streaks
    for (const p of placements) {
      const user = await User.findById(p.userId).select("battleStats").lean();
      const currentStreak = (user as any)?.battleStats?.streak ?? 0;
      const isWin = p.placement === 1;
      const newStreak = isWin ? currentStreak + 1 : 0;
      const bestStreak = Math.max((user as any)?.battleStats?.bestStreak ?? 0, newStreak);
      await User.updateOne(
        { _id: p.userId },
        { $set: { "battleStats.streak": newStreak, "battleStats.bestStreak": bestStreak } }
      );
    }

    // --- SNAKE DRAFT DISTRIBUTION ---
    const allBattlePulls = await BattlePull.find({ battle: battleId }).sort({ coinValue: -1 }).lean();
    const sortedCards = allBattlePulls.map((p) => ({
      id: p._id.toString(),
      coinValue: p.coinValue,
    }));
    const playerOrder = placements.map((p) => p.userId);
    const distribution = snakeDraftDistribute(sortedCards, playerOrder);

    // Update BattlePull distributedTo
    const pullUpdates: any[] = [];
    for (const [userId, cards] of distribution) {
      for (const card of cards) {
        pullUpdates.push(
          BattlePull.updateOne(
            { _id: card.id },
            { $set: { distributedTo: new mongoose.Types.ObjectId(userId), status: "distributed" } }
          )
        );
      }
    }
    await Promise.all(pullUpdates);

    // Mark battle as finished
    await Battle.updateOne(
      { _id: battleId },
      { $set: { status: "finished", finishedAt: new Date() } }
    );

    // Publish battle end event
    const endData = placements.map((p) => ({
      userId: p.userId,
      placement: p.placement,
      eloChange: eloChanges.get(p.userId) ?? 0,
      score: finalBattle.players.find((fp) => fp.user.toString() === p.userId)?.score ?? 0,
      cardsReceived: distribution.get(p.userId)?.length ?? 0,
    }));

    publishBattleEvent(battleId, {
      type: "battle_end",
      placements: endData,
    });

    // Publish distribution event (per player, filtered by SSE endpoint)
    for (const [userId, cards] of distribution) {
      const pullIds = cards.map((c) => c.id);
      const pullDocs = await BattlePull.find({ _id: { $in: pullIds } }).populate("card").lean();
      publishBattleEvent(battleId, {
        type: "distribution",
        targetUserId: userId,
        cards: pullDocs.map((p: any) => ({
          battlePullId: p._id.toString(),
          cardId: p.card._id?.toString() ?? p.card.toString(),
          cardName: p.card.name ?? "Unknown",
          cardImage: p.card.image ?? null,
          rarity: p.rarity,
          coinValue: p.coinValue,
          conversionValue: p.conversionValue,
        })),
      });
    }
  } catch (error) {
    console.error(`[battle-orchestrator] Battle ${battleId} failed:`, error);
    await Battle.updateOne({ _id: battleId }, { $set: { status: "cancelled" } });
    publishBattleEvent(battleId, { type: "battle_error", message: "Battle encountered an error" });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/battle-orchestrator.ts
git commit -m "feat(battle): add server-side battle orchestrator"
```

---

## Task 6: API Endpoints — Create, Join, Leave, List, Details, Active

**Files:**
- Create: `app/api/battles/route.ts`
- Create: `app/api/battles/active/route.ts`
- Create: `app/api/battles/[id]/route.ts`
- Create: `app/api/battles/[id]/join/route.ts`
- Create: `app/api/battles/[id]/leave/route.ts`

- [ ] **Step 1: Create POST/GET /api/battles**

```typescript
// app/api/battles/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db-connect";
import Battle from "@/models/battle";
import Box from "@/models/box";
import User from "@/models/user";
import BattlePull from "@/models/battle-pull";
import Season from "@/models/season";
import { createBattleSchema, battleListSchema } from "@/lib/validations/battle";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await dbConnect();

  const body = await req.json();
  const parsed = createBattleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { boxId, packsPerPlayer, maxPlayers, visibility, minElo } = parsed.data;
  const userId = session.user.id;

  // Check no active battle
  const activeBattle = await Battle.findOne({
    "players.user": userId,
    status: { $in: ["waiting", "countdown", "opening", "clash"] },
  }).lean();
  if (activeBattle) {
    return NextResponse.json({ error: "Already in an active battle" }, { status: 409 });
  }

  // Check no pending battle pulls
  const pendingPulls = await BattlePull.findOne({
    distributedTo: userId,
    status: "distributed",
  }).lean();
  if (pendingPulls) {
    return NextResponse.json({ error: "Undecided battle cards remaining" }, { status: 409 });
  }

  // Validate box
  const box = await Box.findOne({ _id: boxId, status: "published" }).lean();
  if (!box) {
    return NextResponse.json({ error: "Box not found or not published" }, { status: 404 });
  }

  const costPerPlayer = box.priceInCoins * packsPerPlayer;
  const totalRounds = box.cardsPerPack * packsPerPlayer;

  // Deduct coins for creator (first player)
  const user = await User.findOneAndUpdate(
    { _id: userId, coins: { $gte: costPerPlayer } },
    { $inc: { coins: -costPerPlayer } },
    { returnDocument: "after" }
  );
  if (!user) {
    return NextResponse.json({ error: "Insufficient coins" }, { status: 400 });
  }

  // Find active season
  const activeSeason = await Season.findOne({ status: "active" }).lean();

  const slug = `clash-${nanoid(8)}`;
  const battle = await Battle.create({
    slug,
    createdBy: userId,
    box: boxId,
    packsPerPlayer,
    maxPlayers,
    status: "waiting",
    visibility,
    minElo,
    totalRounds,
    seasonId: activeSeason?._id ?? null,
    players: [
      {
        user: userId,
        joinedAt: new Date(),
        coinsReserved: costPerPlayer,
        eloAtStart: user.elo ?? 1000,
        score: 0,
        placement: null,
        eloChange: null,
      },
    ],
  });

  // Increment battlesCreated
  await User.updateOne({ _id: userId }, { $inc: { "battleStats.battlesCreated": 1 } });

  return NextResponse.json({ battleId: battle._id, slug: battle.slug }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await dbConnect();

  const url = new URL(req.url);
  const parsed = battleListSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { status, game, page, limit } = parsed.data;
  const filter: Record<string, any> = { visibility: "public" };
  if (status) filter.status = status;
  else filter.status = { $in: ["waiting", "countdown", "clash"] };

  const battles = await Battle.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("box", "name slug game image priceInCoins cardsPerPack")
    .populate("players.user", "name username image elo badges battleStats")
    .lean();

  const total = await Battle.countDocuments(filter);

  return NextResponse.json({ battles, total, page, limit });
}
```

- [ ] **Step 2: Create GET /api/battles/active**

```typescript
// app/api/battles/active/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db-connect";
import Battle from "@/models/battle";
import BattlePull from "@/models/battle-pull";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await dbConnect();
  const userId = session.user.id;

  // Check for active battle
  const activeBattle = await Battle.findOne({
    "players.user": userId,
    status: { $in: ["waiting", "countdown", "opening", "clash"] },
  })
    .select("slug status currentRound totalRounds")
    .lean();

  if (activeBattle) {
    return NextResponse.json({ active: true, battle: activeBattle });
  }

  // Check for undecided distributed pulls
  const undecidedPull = await BattlePull.findOne({
    distributedTo: userId,
    status: "distributed",
  })
    .select("battle")
    .lean();

  if (undecidedPull) {
    const battle = await Battle.findById(undecidedPull.battle)
      .select("slug status")
      .lean();
    if (battle) {
      return NextResponse.json({ active: true, battle, phase: "decide" });
    }
  }

  return NextResponse.json({ active: false });
}
```

- [ ] **Step 3: Create GET /api/battles/[id]**

```typescript
// app/api/battles/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db-connect";
import Battle from "@/models/battle";
import BattlePull from "@/models/battle-pull";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await dbConnect();
  const { id } = await params;

  const battle = await Battle.findOne({ $or: [{ _id: id }, { slug: id }] })
    .populate("box", "name slug game image priceInCoins cardsPerPack")
    .populate("players.user", "name username image elo badges battleStats")
    .lean();

  if (!battle) {
    return NextResponse.json({ error: "Battle not found" }, { status: 404 });
  }

  const userId = session.user.id;
  const isPlayer = battle.players.some((p: any) => p.user._id?.toString() === userId || p.user.toString() === userId);

  // If battle is finished and user is a player, include their distributed cards
  let myCards: any[] = [];
  if (battle.status === "finished" && isPlayer) {
    myCards = await BattlePull.find({ battle: battle._id, distributedTo: userId })
      .populate("card", "name image")
      .lean();
  }

  return NextResponse.json({ battle, isPlayer, myCards });
}
```

- [ ] **Step 4: Create POST /api/battles/[id]/join**

```typescript
// app/api/battles/[id]/join/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db-connect";
import Battle from "@/models/battle";
import BattlePull from "@/models/battle-pull";
import User from "@/models/user";
import { getRedis } from "@/lib/redis";
import { runBattle } from "@/lib/battle-orchestrator";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await dbConnect();
  const { id } = await params;
  const userId = session.user.id;

  // Distributed lock
  const redis = getRedis();
  const lockKey = `battle-join:${id}`;
  const locked = await redis.set(lockKey, "1", "EX", 10, "NX");
  if (!locked) {
    return NextResponse.json({ error: "Please try again" }, { status: 429 });
  }

  try {
    // Check no active battle
    const activeBattle = await Battle.findOne({
      "players.user": userId,
      status: { $in: ["waiting", "countdown", "opening", "clash"] },
    }).lean();
    if (activeBattle) {
      return NextResponse.json({ error: "Already in an active battle" }, { status: 409 });
    }

    // Check no pending pulls
    const pendingPulls = await BattlePull.findOne({
      distributedTo: userId,
      status: "distributed",
    }).lean();
    if (pendingPulls) {
      return NextResponse.json({ error: "Undecided battle cards remaining" }, { status: 409 });
    }

    const battle = await Battle.findOne({ _id: id, status: "waiting" }).lean();
    if (!battle) {
      return NextResponse.json({ error: "Battle not found or already started" }, { status: 404 });
    }

    // Check already joined
    if (battle.players.some((p) => p.user.toString() === userId)) {
      return NextResponse.json({ error: "Already joined" }, { status: 409 });
    }

    // Check full
    if (battle.players.length >= battle.maxPlayers) {
      return NextResponse.json({ error: "Battle is full" }, { status: 409 });
    }

    // Check min ELO
    const userDoc = await User.findById(userId).select("elo coins").lean();
    if (!userDoc) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (battle.minElo && (userDoc.elo ?? 1000) < battle.minElo) {
      return NextResponse.json({ error: "ELO too low" }, { status: 403 });
    }

    // Deduct coins
    const costPerPlayer = battle.players[0].coinsReserved; // Same cost for all
    const user = await User.findOneAndUpdate(
      { _id: userId, coins: { $gte: costPerPlayer } },
      { $inc: { coins: -costPerPlayer } },
      { returnDocument: "after" }
    );
    if (!user) {
      return NextResponse.json({ error: "Insufficient coins" }, { status: 400 });
    }

    // Add player
    const updatedBattle = await Battle.findOneAndUpdate(
      { _id: id, status: "waiting", [`players.${battle.maxPlayers - 1}`]: { $exists: false } },
      {
        $push: {
          players: {
            user: userId,
            joinedAt: new Date(),
            coinsReserved: costPerPlayer,
            eloAtStart: user.elo ?? 1000,
            score: 0,
            placement: null,
            eloChange: null,
          },
        },
      },
      { returnDocument: "after" }
    );

    if (!updatedBattle) {
      // Refund coins — battle was full or started
      await User.updateOne({ _id: userId }, { $inc: { coins: costPerPlayer } });
      return NextResponse.json({ error: "Battle no longer available" }, { status: 409 });
    }

    // Publish player joined
    redis.publish(`battle:${id}`, JSON.stringify({
      type: "player_joined",
      userId,
      playerCount: updatedBattle.players.length,
      maxPlayers: updatedBattle.maxPlayers,
    })).catch(() => {});

    // If battle is now full, start it
    if (updatedBattle.players.length >= updatedBattle.maxPlayers) {
      // Fire and forget — don't await
      runBattle(updatedBattle._id.toString()).catch((err) => {
        console.error("[battle-join] Failed to start battle:", err);
      });
    }

    return NextResponse.json({ joined: true, playerCount: updatedBattle.players.length });
  } finally {
    await redis.del(lockKey);
  }
}
```

- [ ] **Step 5: Create DELETE /api/battles/[id]/leave**

```typescript
// app/api/battles/[id]/leave/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db-connect";
import Battle from "@/models/battle";
import User from "@/models/user";
import CoinTransaction from "@/models/coin-transaction";
import { getRedis } from "@/lib/redis";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await dbConnect();
  const { id } = await params;
  const userId = session.user.id;

  const battle = await Battle.findOne({ _id: id, status: "waiting" }).lean();
  if (!battle) {
    return NextResponse.json({ error: "Battle not found or already started" }, { status: 404 });
  }

  const player = battle.players.find((p) => p.user.toString() === userId);
  if (!player) {
    return NextResponse.json({ error: "Not in this battle" }, { status: 404 });
  }

  // If creator leaves and battle is empty after, cancel it
  const isCreator = battle.createdBy.toString() === userId;

  // Remove player
  await Battle.updateOne(
    { _id: id },
    { $pull: { players: { user: userId } } }
  );

  // Refund coins
  await User.updateOne({ _id: userId }, { $inc: { coins: player.coinsReserved } });
  await CoinTransaction.create({
    userId,
    amount: player.coinsReserved,
    type: "battle_refund",
    relatedBattleId: id,
    relatedBoxId: battle.box,
  });

  // If creator left or no players remaining, cancel
  const remainingBattle = await Battle.findById(id).lean();
  if (!remainingBattle || remainingBattle.players.length === 0 || isCreator) {
    // Refund all remaining players
    for (const p of remainingBattle?.players ?? []) {
      if (p.user.toString() === userId) continue;
      await User.updateOne({ _id: p.user }, { $inc: { coins: p.coinsReserved } });
      await CoinTransaction.create({
        userId: p.user,
        amount: p.coinsReserved,
        type: "battle_refund",
        relatedBattleId: id,
        relatedBoxId: battle.box,
      });
    }
    await Battle.updateOne({ _id: id }, { $set: { status: "cancelled" } });
  }

  // Publish
  const redis = getRedis();
  redis.publish(`battle:${id}`, JSON.stringify({
    type: "player_left",
    userId,
    cancelled: !remainingBattle || remainingBattle.players.length === 0 || isCreator,
  })).catch(() => {});

  return NextResponse.json({ left: true });
}
```

- [ ] **Step 6: Commit**

```bash
git add app/api/battles/route.ts app/api/battles/active/route.ts app/api/battles/[id]/route.ts app/api/battles/[id]/join/route.ts app/api/battles/[id]/leave/route.ts
git commit -m "feat(battle): add core API endpoints (create, join, leave, list, details, active)"
```

---

## Task 7: SSE Events Endpoint

**Files:**
- Create: `app/api/battles/[id]/events/route.ts`

- [ ] **Step 1: Implement SSE endpoint**

Follow the exact pattern from `app/api/packs/[id]/events/route.ts` — ReadableStream + Redis subscriber + 30s keepalive + abort cleanup.

```typescript
// app/api/battles/[id]/events/route.ts
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db-connect";
import Battle from "@/models/battle";
import BattlePull from "@/models/battle-pull";
import { getRedis } from "@/lib/redis";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  await dbConnect();
  const { id } = await params;
  const userId = session.user.id;
  const channel = `battle:${id}`;

  // Load battle for initial sync
  const battle = await Battle.findOne({ $or: [{ _id: id }, { slug: id }] })
    .populate("players.user", "name username image elo badges battleStats")
    .populate("box", "name slug game image priceInCoins cardsPerPack")
    .lean();

  if (!battle) {
    return new Response("Battle not found", { status: 404 });
  }

  const isPlayer = battle.players.some((p: any) =>
    (p.user._id?.toString() ?? p.user.toString()) === userId
  );

  const encoder = new TextEncoder();
  let subscriberRedis: ReturnType<typeof getRedis> | null = null;

  // Track spectator presence
  const redis = getRedis();
  const presenceKey = `battle-presence:${battle._id}`;
  const connectionId = `${userId}:${Date.now()}`;

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));

      // Track presence (spectators + players)
      await redis.sadd(presenceKey, connectionId);
      await redis.expire(presenceKey, 300);
      const spectatorCount = await redis.scard(presenceKey);
      redis.publish(channel, JSON.stringify({
        type: "spectator_count",
        count: spectatorCount,
      })).catch(() => {});

      // Send initial sync event
      const syncData: Record<string, any> = {
        type: "sync",
        battle: {
          _id: battle._id,
          slug: battle.slug,
          status: battle.status,
          currentRound: battle.currentRound,
          totalRounds: battle.totalRounds,
          players: battle.players,
          box: battle.box,
          visibility: battle.visibility,
          maxPlayers: battle.maxPlayers,
          completedRounds: battle.rounds.filter((r: any) => r.revealedAt),
          spectatorCount,
        },
        isPlayer,
      };

      // Include distributed cards if finished and is player
      if (battle.status === "finished" && isPlayer) {
        const myCards = await BattlePull.find({
          battle: battle._id,
          distributedTo: userId,
        })
          .populate("card", "name image")
          .lean();
        syncData.myCards = myCards;
      }

      controller.enqueue(encoder.encode(`data: ${JSON.stringify(syncData)}\n\n`));

      // Subscribe to battle channel
      subscriberRedis = getRedis().duplicate();
      subscriberRedis.on("message", (_ch: string, message: string) => {
        try {
          // Filter distribution events — only send to target user
          const parsed = JSON.parse(message);
          if (parsed.type === "distribution" && parsed.targetUserId !== userId) {
            return; // Don't send other players' card distributions
          }
          controller.enqueue(encoder.encode(`data: ${message}\n\n`));
        } catch {
          // Stream closed
        }
      });
      await subscriberRedis.subscribe(channel);

      // Keepalive
      const keepalive = setInterval(async () => {
        try {
          await redis.sadd(presenceKey, connectionId);
          await redis.expire(presenceKey, 300);
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepalive);
        }
      }, 30000);

      _req.signal.addEventListener("abort", async () => {
        clearInterval(keepalive);
        if (subscriberRedis) {
          subscriberRedis.unsubscribe(channel).catch(() => {});
          subscriberRedis.disconnect();
        }
        await redis.srem(presenceKey, connectionId);
        const newCount = await redis.scard(presenceKey);
        redis.publish(channel, JSON.stringify({
          type: "spectator_count",
          count: newCount,
        })).catch(() => {});
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() {
      if (subscriberRedis) {
        subscriberRedis.unsubscribe(channel).catch(() => {});
        subscriberRedis.disconnect();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/battles/[id]/events/route.ts
git commit -m "feat(battle): add SSE events endpoint with sync and spectator presence"
```

---

## Task 8: Preset Chat & Decide Endpoints

**Files:**
- Create: `app/api/battles/[id]/chat/route.ts`
- Create: `app/api/battles/[id]/decide/route.ts`

- [ ] **Step 1: Implement preset chat endpoint**

```typescript
// app/api/battles/[id]/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db-connect";
import Battle from "@/models/battle";
import { getRedis } from "@/lib/redis";
import { battleChatSchema } from "@/lib/validations/battle";
import { PRESET_CHAT_MESSAGES, PRESET_CHAT_COOLDOWN_MS } from "@/lib/battle-constants";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await dbConnect();
  const { id } = await params;
  const userId = session.user.id;

  const body = await req.json();
  const parsed = battleChatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { messageKey } = parsed.data;
  const message = PRESET_CHAT_MESSAGES.find((m) => m.key === messageKey);
  if (!message) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  // Rate limit
  const redis = getRedis();
  const rateLimitKey = `battle-chat:${id}:${userId}`;
  const lastSent = await redis.get(rateLimitKey);
  if (lastSent) {
    return NextResponse.json({ error: "Too fast" }, { status: 429 });
  }
  await redis.set(rateLimitKey, "1", "PX", PRESET_CHAT_COOLDOWN_MS);

  // Check battle exists and is active
  const battle = await Battle.findById(id).select("status players").lean();
  if (!battle || battle.status === "cancelled") {
    return NextResponse.json({ error: "Battle not found" }, { status: 404 });
  }

  const isPlayer = battle.players.some((p) => p.user.toString() === userId);

  // Spectator-only messages require being a spectator
  if (message.spectatorOnly && isPlayer) {
    return NextResponse.json({ error: "Spectator-only message" }, { status: 403 });
  }
  // Non-spectator messages in non-spectator categories — spectators can only use spectator messages
  if (!message.spectatorOnly && !isPlayer) {
    return NextResponse.json({ error: "Players-only message" }, { status: 403 });
  }

  // Publish
  redis.publish(`battle:${id}`, JSON.stringify({
    type: "chat_message",
    userId,
    userName: session.user.name,
    userImage: session.user.image ?? null,
    messageKey,
    de: message.de,
    en: message.en,
    category: message.category,
    isSpectator: !isPlayer,
    timestamp: Date.now(),
  })).catch(() => {});

  return NextResponse.json({ sent: true });
}
```

- [ ] **Step 2: Implement battle decide endpoint (claim/convert)**

```typescript
// app/api/battles/[id]/decide/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db-connect";
import Battle from "@/models/battle";
import BattlePull from "@/models/battle-pull";
import CartItem from "@/models/cart-item";
import User from "@/models/user";
import Box from "@/models/box";
import CoinTransaction from "@/models/coin-transaction";
import mongoose from "mongoose";
import { battleDecideSchema } from "@/lib/validations/battle";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await dbConnect();
  const { id: battleId } = await params;
  const userId = session.user.id;

  const body = await req.json();
  const parsed = battleDecideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { battlePullId, decision } = parsed.data;

  // Find the pull — must be distributed to this user
  const pull = await BattlePull.findOneAndUpdate(
    {
      _id: battlePullId,
      battle: battleId,
      distributedTo: userId,
      status: "distributed",
    },
    {
      $set: {
        status: decision === "claim" ? "claimed" : "converted",
        decidedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  if (!pull) {
    return NextResponse.json({ error: "Pull not found or already decided" }, { status: 404 });
  }

  if (decision === "claim") {
    // Create cart item with 3h reservation
    const now = new Date();
    // Check if user has existing reserved cart items for expiry alignment
    const existingCart = await CartItem.findOne({
      userId,
      status: "reserved",
    })
      .sort({ expiresAt: 1 })
      .lean();

    const expiresAt = existingCart?.expiresAt ?? new Date(now.getTime() + 3 * 60 * 60 * 1000);

    await CartItem.create({
      userId,
      cardId: pull.card,
      boxId: (await Battle.findById(battleId).select("box").lean())?.box,
      pullId: pull._id,
      rarity: pull.rarity,
      conversionValue: pull.conversionValue,
      status: "reserved",
      expiresAt,
    });

    return NextResponse.json({ decision: "claim", expiresAt });
  } else {
    // Convert to coins
    await User.updateOne({ _id: userId }, { $inc: { coins: pull.conversionValue } });

    // Return stock to box
    const battle = await Battle.findById(battleId).select("box").lean();
    if (battle) {
      const cardOid = new mongoose.Types.ObjectId(pull.card.toString());
      await Box.updateOne(
        { _id: battle.box, "cards.card": cardOid },
        { $inc: { "cards.$.stock": 1 } }
      );
    }

    await CoinTransaction.create({
      userId,
      amount: pull.conversionValue,
      type: "battle_card_conversion",
      relatedBattleId: battleId,
    });

    return NextResponse.json({ decision: "convert", coinsReceived: pull.conversionValue });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/battles/[id]/chat/route.ts app/api/battles/[id]/decide/route.ts
git commit -m "feat(battle): add preset chat and claim/convert endpoints"
```

---

## Task 9: Leaderboard Endpoint

**Files:**
- Create: `app/api/battles/leaderboard/route.ts`

- [ ] **Step 1: Implement leaderboard endpoint**

```typescript
// app/api/battles/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db-connect";
import User from "@/models/user";
import Battle from "@/models/battle";
import { leaderboardSchema } from "@/lib/validations/battle";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await dbConnect();

  const url = new URL(req.url);
  const parsed = leaderboardSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { category, seasonId, page, limit } = parsed.data;

  let sortField: string;
  switch (category) {
    case "elo":
      sortField = "elo";
      break;
    case "wins":
      sortField = "battleStats.wins";
      break;
    case "streak":
      sortField = "battleStats.bestStreak";
      break;
    case "pull_value":
      // For pull_value, we need aggregation — fallback to ELO for now
      // This will be enhanced when we add per-season tracking
      sortField = "elo";
      break;
    default:
      sortField = "elo";
  }

  const filter: Record<string, any> = {
    "battleStats.totalBattles": { $gte: 1 },
  };

  const users = await User.find(filter)
    .sort({ [sortField]: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .select("name username image elo battleStats badges")
    .lean();

  const total = await User.countDocuments(filter);

  // Find current user's rank
  const myRank = await User.countDocuments({
    ...filter,
    [sortField]: { $gt: (await User.findById(session.user.id).select(sortField).lean() as any)?.[sortField === "elo" ? "elo" : "battleStats"] ?? 0 },
  });

  return NextResponse.json({
    leaderboard: users.map((u, i) => ({
      rank: (page - 1) * limit + i + 1,
      user: u,
    })),
    total,
    page,
    limit,
    myRank: myRank + 1,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/battles/leaderboard/route.ts
git commit -m "feat(battle): add leaderboard endpoint"
```

---

## Task 10: Achievement Engine

**Files:**
- Create: `lib/battle-achievements.ts`

- [ ] **Step 1: Implement achievement checker**

```typescript
// lib/battle-achievements.ts
import User from "@/models/user";
import Battle from "@/models/battle";
import BattleAchievement from "@/models/battle-achievement";
import BattlePull from "@/models/battle-pull";
import { BATTLE_ACHIEVEMENTS } from "./battle-constants";
import { getEloRank } from "./battle-elo";

interface AchievementContext {
  userId: string;
  battleId: string;
  placement: number;
  eloAfter: number;
  opponentMaxElo: number;
  longestRoundStreak: number;
  hadUltraRare: boolean;
}

/**
 * Check and award achievements after a battle finishes.
 * Idempotent — won't duplicate achievements.
 */
export async function checkAndAwardAchievements(ctx: AchievementContext): Promise<string[]> {
  const awarded: string[] = [];
  const user = await User.findById(ctx.userId).select("battleStats badges").lean();
  if (!user) return awarded;

  const stats = (user as any).battleStats ?? { wins: 0, losses: 0, streak: 0, bestStreak: 0, totalBattles: 0, battlesCreated: 0 };
  const existing = await BattleAchievement.find({ user: ctx.userId }).select("key").lean();
  const existingKeys = new Set(existing.map((a) => a.key));

  const checks: Array<{ key: string; condition: () => boolean }> = [
    { key: "first_clash", condition: () => stats.totalBattles >= 1 },
    { key: "win_streak_3", condition: () => stats.streak >= 3 },
    { key: "underdog", condition: () => ctx.placement === 1 && ctx.opponentMaxElo - (ctx.eloAfter - (/* eloChange approximation */ 0)) >= 200 },
    { key: "sharpshooter", condition: () => ctx.longestRoundStreak >= 10 },
    { key: "champion_rank", condition: () => getEloRank(ctx.eloAfter).key === "champion" },
    { key: "veteran", condition: () => stats.totalBattles >= 100 },
    { key: "jackpot", condition: () => ctx.hadUltraRare },
    { key: "host_10", condition: () => stats.battlesCreated >= 10 },
  ];

  for (const check of checks) {
    if (existingKeys.has(check.key)) continue;
    if (!check.condition()) continue;

    const achDef = BATTLE_ACHIEVEMENTS.find((a) => a.key === check.key);
    if (!achDef) continue;

    try {
      await BattleAchievement.create({
        user: ctx.userId,
        key: check.key,
        battle: ctx.battleId,
      });

      // Award badge on user profile
      await User.updateOne(
        { _id: ctx.userId, "badges.key": { $ne: check.key } },
        {
          $push: {
            badges: {
              key: check.key,
              label: achDef.label.en,
              active: true,
              tone: achDef.tone,
              awardedAt: new Date(),
              expiresAt: null,
              sortOrder: 100,
            },
          },
        }
      );

      awarded.push(check.key);
    } catch {
      // Duplicate key — already exists, ignore
    }
  }

  return awarded;
}
```

- [ ] **Step 2: Integrate achievement check into battle orchestrator**

In `lib/battle-orchestrator.ts`, add at the end of the `runBattle` function, after the distribution event publishing, before the catch block:

```typescript
    // --- ACHIEVEMENTS ---
    const { checkAndAwardAchievements } = await import("./battle-achievements");
    for (const p of placements) {
      const userAfter = await User.findById(p.userId).select("elo").lean();
      const opponentMaxElo = Math.max(
        ...finalBattle.players
          .filter((fp) => fp.user.toString() !== p.userId)
          .map((fp) => fp.eloAtStart)
      );

      // Calculate longest round streak for this player
      let longestStreak = 0;
      let currentStreak = 0;
      for (const round of finalBattle.rounds) {
        if (round.winnerId?.toString() === p.userId) {
          currentStreak++;
          longestStreak = Math.max(longestStreak, currentStreak);
        } else {
          currentStreak = 0;
        }
      }

      // Check if player pulled an ultra rare
      const playerPulls = allPulls.filter((pull) => pull.playerId === p.userId);
      const hadUltraRare = playerPulls.some(
        (pull) => (RARITY_ORDER[pull.rarity] ?? 0) >= 5
      );

      await checkAndAwardAchievements({
        userId: p.userId,
        battleId: battleId,
        placement: p.placement,
        eloAfter: (userAfter as any)?.elo ?? 1000,
        opponentMaxElo,
        longestRoundStreak: longestStreak,
        hadUltraRare,
      });
    }
```

- [ ] **Step 3: Commit**

```bash
git add lib/battle-achievements.ts lib/battle-orchestrator.ts
git commit -m "feat(battle): add achievement engine with badge integration"
```

---

## Task 11: i18n Dictionary Entries

**Files:**
- Modify: The dictionaries file(s) for de/en

- [ ] **Step 1: Find the dictionary system**

Check `lib/dictionaries/` or wherever `getDictionary()` loads translations from. Add a `battles` section with all UI strings for both `de` and `en`.

Key strings needed:
- Page titles: "Battles", "Create Battle", "Leaderboard"
- Lobby: "Waiting for players...", "Battle starts in {seconds}..."
- Clash: "Round {n} of {total}", "Winner: {name}", "ON FIRE!"
- Podium: "1st Place", "2nd Place", "3rd Place"
- Claim/Convert: "Add to cart", "Convert to coins"
- Chat categories: "Hype", "Reaction", "Respect", "Battle", "Spectator"
- Reconnect banner: "You're in an active battle!", "Return to battle"
- ELO ranks: "Bronze", "Silver", "Gold", "Diamond", "Champion"

- [ ] **Step 2: Commit**

```bash
git add [dictionary files]
git commit -m "feat(battle): add i18n dictionary entries for battle system"
```

---

## Task 12: Frontend — Battle List Page

**Files:**
- Create: `app/[lang]/battles/page.tsx`

- [ ] **Step 1: Check Next.js 16 docs for page conventions**

Read `node_modules/next/dist/docs/` for any breaking changes in App Router page conventions before writing components.

- [ ] **Step 2: Implement battles list page**

The page should:
- Fetch open battles via `GET /api/battles`
- Show battle cards with: Box name/image, players count, cost per player, creator info
- "Create Battle" button → links to `/battles/create`
- "Quick Match" button → joins the first available battle (or creates one)
- Filter by game, status
- Show active battle banner if user has one (via `GET /api/battles/active`)

- [ ] **Step 3: Commit**

```bash
git add app/[lang]/battles/page.tsx
git commit -m "feat(battle): add battles list page"
```

---

## Task 13: Frontend — Create Battle Page

**Files:**
- Create: `app/[lang]/battles/create/page.tsx`

- [ ] **Step 1: Implement create battle form**

The page should:
- Box selector (fetch published boxes, show image + name + price)
- Packs per player slider (1-10)
- Max players input (2-20)
- Visibility toggle (public/private)
- Min ELO input (optional)
- Cost preview: `box.priceInCoins × packsPerPlayer` coins per player
- Submit → `POST /api/battles` → redirect to `/battles/{slug}`

- [ ] **Step 2: Commit**

```bash
git add app/[lang]/battles/create/page.tsx
git commit -m "feat(battle): add create battle page"
```

---

## Task 14: Frontend — Battle View Page (Core)

**Files:**
- Create: `app/[lang]/battles/[slug]/page.tsx`
- Create: `components/battles/battle-lobby.tsx`
- Create: `components/battles/battle-clash.tsx`
- Create: `components/battles/battle-podium.tsx`
- Create: `components/battles/battle-decide.tsx`
- Create: `components/battles/battle-scoreboard.tsx`
- Create: `components/battles/battle-preset-chat.tsx`
- Create: `components/battles/card-flip.tsx`

This is the largest frontend task. The page connects to SSE and renders different phases:

- [ ] **Step 1: Create the main battle page with SSE hook**

The page component:
- Connects to `GET /api/battles/{id}/events` via EventSource
- Maintains battle state from `sync` + incremental events
- Renders the correct phase component based on `battle.status`
- Shows active battle banner for reconnect
- Handles SSE reconnection automatically

- [ ] **Step 2: Create battle-lobby component**

Shows:
- Player slots (filled + empty)
- Player cards: avatar, name, ELO rank badge, win streak
- Preset chat (active in lobby)
- Spectator count
- Join/Leave buttons
- Countdown overlay when all slots filled

- [ ] **Step 3: Create card-flip component**

Animated card reveal:
- Card starts face-down
- Flips with CSS 3D transform
- Rarity-dependent timing (0.5s / 1.5s / 3s)
- Glow/particle effect for rare+ cards
- Shows card image, name, rarity badge

- [ ] **Step 4: Create battle-clash component**

The round-by-round view:
- Shows all players' card slots
- Receives `round_reveal` event → triggers card-flip animations
- Receives `round_result` → highlights winner, updates scoreboard
- Shows "ON FIRE" effect for 3+ round streaks
- Round counter: "Round {n} of {total}"

- [ ] **Step 5: Create battle-scoreboard component**

Live scoreboard sidebar:
- Player name, avatar, score, ELO rank
- Highlights current leader
- Animates score changes
- Shows round streak indicators

- [ ] **Step 6: Create battle-podium component**

End-of-battle results:
- Top 3 podium with avatar animations
- Confetti for 1st place (use CSS/canvas confetti)
- Full ranking table with: placement, name, score, ELO change (+/-)
- Stats: total value, best card, rounds won

- [ ] **Step 7: Create battle-decide component**

Card claim/convert interface:
- Shows cards distributed to this player
- Each card: image, name, rarity, coin value
- Two buttons per card: "Add to Cart" / "Convert to {value} Coins"
- Calls `POST /api/battles/{id}/decide` per card
- Bulk convert option (if eligible)

- [ ] **Step 8: Create battle-preset-chat component**

Chat panel:
- Shows categories as tabs/sections
- Click a message → `POST /api/battles/{id}/chat`
- Incoming messages appear as bubbles near player avatar
- Rate limit feedback (grayed out for 2s after sending)
- Spectator-only messages shown only for spectators

- [ ] **Step 9: Commit**

```bash
git add app/[lang]/battles/[slug]/page.tsx components/battles/
git commit -m "feat(battle): add battle view page with all phase components"
```

---

## Task 15: Frontend — Leaderboard Page

**Files:**
- Create: `app/[lang]/battles/leaderboard/page.tsx`

- [ ] **Step 1: Implement leaderboard page**

- Category tabs: ELO, Wins, Streak, Pull Value
- Season filter dropdown
- User list with rank, avatar, name, stat value, ELO rank badge
- Highlight current user's position
- Pagination

- [ ] **Step 2: Commit**

```bash
git add app/[lang]/battles/leaderboard/page.tsx
git commit -m "feat(battle): add leaderboard page"
```

---

## Task 16: Profile Extension — Battle Stats Tab

**Files:**
- Modify: The existing profile page (find under `app/[lang]/profile/`)

- [ ] **Step 1: Add battle stats tab to profile**

Add a new tab/section showing:
- ELO rating + rank badge
- Win/Loss record + win rate percentage
- Current streak + best streak
- Total battles played
- Recent battle history (last 10)
- Achievements/badges earned

- [ ] **Step 2: Commit**

```bash
git add [profile page files]
git commit -m "feat(battle): add battle stats to user profile"
```

---

## Task 17: Active Battle Banner Component

**Files:**
- Create: `components/battles/active-battle-banner.tsx`
- Modify: Root layout or main layout component

- [ ] **Step 1: Create the active battle banner**

- On mount, calls `GET /api/battles/active`
- If active battle found, shows a sticky banner: "Du bist in einem aktiven Battle!" with "Zurück zum Battle" button
- Dismissable but reappears on page navigation
- Add to the root/main layout so it shows on every page

- [ ] **Step 2: Commit**

```bash
git add components/battles/active-battle-banner.tsx [layout file]
git commit -m "feat(battle): add active battle reconnect banner"
```

---

## Task 18: Verification & Manual Testing

- [ ] **Step 1: Run all unit tests**

```bash
npx vitest run __tests__/lib/battle-elo.test.ts __tests__/lib/battle-engine.test.ts
```
Expected: ALL PASS

- [ ] **Step 2: Run TypeScript type check**

```bash
npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 3: Run dev server and test manually**

```bash
npm run dev
```

Manual test checklist:
1. Create a battle (select box, packs, players)
2. Open in second browser/incognito → join the battle
3. Verify lobby shows both players with ELO and badges
4. Verify battle starts when all slots filled (5s countdown)
5. Watch card-flip animations round by round
6. Verify scoreboard updates after each round
7. Verify podium shows at the end with correct placements
8. Verify ELO changes displayed
9. Test claim/convert for each player's distributed cards
10. Test page refresh during battle → verify reconnect works
11. Test spectator view in third browser window
12. Test preset chat from player and spectator perspectives
13. Verify leaderboard shows battle stats
14. Verify active battle banner on other pages

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(battle): Card Clash battle system complete"
```
