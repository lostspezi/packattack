import type { Types } from "mongoose";
import type { IVirtualCard } from "@/models/battle";

// ---------- Types ----------

export interface BoxCardForBattle {
  cardId: Types.ObjectId;
  name: string;
  image: string;
  rarity: string;
  coinValue: number;
  weight: number;
}

interface RoundSelection {
  player: Types.ObjectId;
  card: IVirtualCard;
}

interface RoundResult {
  winner: Types.ObjectId | null;
}

interface BattleResult {
  winner: Types.ObjectId | null;
  needsSuddenDeath: boolean;
  tiedPlayers: string[];
}

// ---------- Tier configuration ----------

interface TierConfig {
  min: number;
  max: number;
  count: number;
}

const HAND_TIERS: TierConfig[] = [
  { min: 1, max: 10, count: 2 },
  { min: 11, max: 50, count: 1 },
  { min: 51, max: 200, count: 1 },
  { min: 201, max: Infinity, count: 1 },
];

const HAND_SIZE = 5;

// ---------- Hand generation ----------

/**
 * Generate a battle hand of 5 cards using tier-based stratified drawing.
 * Guarantees value diversity: 2 low, 1 medium, 1 high, 1 premium.
 * Falls back to adjacent tiers when a tier has insufficient cards.
 */
export function generateBattleHand(boxCards: BoxCardForBattle[]): IVirtualCard[] {
  if (boxCards.length < HAND_SIZE) {
    throw new Error(`Box must have at least ${HAND_SIZE} cards for battle`);
  }

  // Group cards by tier
  const tierBuckets: BoxCardForBattle[][] = HAND_TIERS.map((tier) =>
    boxCards.filter((c) => c.coinValue >= tier.min && c.coinValue <= tier.max),
  );

  const hand: IVirtualCard[] = [];

  for (let i = 0; i < HAND_TIERS.length; i++) {
    const needed = HAND_TIERS[i].count;
    let bucket = tierBuckets[i];

    // Fallback: if tier is empty, try adjacent tiers (prefer higher, then lower)
    if (bucket.length === 0) {
      for (let offset = 1; offset < HAND_TIERS.length; offset++) {
        if (i + offset < HAND_TIERS.length && tierBuckets[i + offset].length > 0) {
          bucket = tierBuckets[i + offset];
          break;
        }
        if (i - offset >= 0 && tierBuckets[i - offset].length > 0) {
          bucket = tierBuckets[i - offset];
          break;
        }
      }
    }

    for (let j = 0; j < needed; j++) {
      const card = weightedRandomPick(bucket);
      hand.push({
        cardId: card.cardId,
        name: card.name,
        image: card.image,
        rarity: card.rarity,
        coinValue: card.coinValue,
      });
    }
  }

  return hand;
}

/**
 * Pick a random card from bucket using weights.
 */
function weightedRandomPick(bucket: BoxCardForBattle[]): BoxCardForBattle {
  const totalWeight = bucket.reduce((sum, c) => sum + c.weight, 0);
  let rand = Math.random() * totalWeight;

  for (const card of bucket) {
    rand -= card.weight;
    if (rand <= 0) return card;
  }

  // Fallback (shouldn't happen)
  return bucket[bucket.length - 1];
}

// ---------- Round evaluation ----------

/**
 * Evaluate a round: highest coinValue wins. Tie = null winner.
 */
export function evaluateRound(selections: RoundSelection[]): RoundResult {
  const maxValue = Math.max(...selections.map((s) => s.card.coinValue));
  const topPlayers = selections.filter((s) => s.card.coinValue === maxValue);

  if (topPlayers.length === 1) {
    return { winner: topPlayers[0].player };
  }

  // Multiple players with same max value = tie
  return { winner: null };
}

// ---------- Battle evaluation ----------

/**
 * Evaluate the overall battle based on round wins.
 * Returns the winner or flags that sudden death is needed.
 */
export function evaluateBattle(roundWins: Map<string, number>): BattleResult {
  const entries = Array.from(roundWins.entries());
  const maxWins = Math.max(...entries.map(([, wins]) => wins));
  const topPlayers = entries.filter(([, wins]) => wins === maxWins);

  if (topPlayers.length === 1) {
    return {
      winner: { toString: () => topPlayers[0][0] } as Types.ObjectId,
      needsSuddenDeath: false,
      tiedPlayers: [],
    };
  }

  return {
    winner: null,
    needsSuddenDeath: true,
    tiedPlayers: topPlayers.map(([id]) => id),
  };
}
