/**
 * Server-side pack opening engine.
 * Similar to pack-simulation.ts but with stock tracking —
 * each drawn card reduces available stock so a card with stock 1 can't be drawn twice.
 *
 * Two entry points:
 *   - `drawPacks`              — synchronous, Math.random driven, used by battle hands.
 *   - `drawPacksWithFairness`  — asynchronous, injected RNG, used by provably-fair pack opening.
 *
 * Both share the `walkPool` contract from `lib/fairness` so server-side rolls
 * and client-side verifier replays produce byte-identical outcomes.
 */

import {
  scaleWeight,
  walkPool,
  type PoolEntry,
  type RngStep,
} from "@/lib/fairness";

export interface PackCard {
  cardId: string;
  name: string;
  rarity: string;
  weight: number;
  stock: number;
  coinValue: number; // internalPrice (GANZZAHL)
  image: string | null;
}

export interface DrawnCard {
  cardId: string;
  name: string;
  rarity: string;
  coinValue: number;
  conversionValue: number;
  image: string | null;
  packIndex: number;
  cardIndex: number;
}

export interface PackOpenResult {
  drawnCards: DrawnCard[];
  totalCost: number;
}

interface PoolState {
  cards: PackCard[];
  scaledWeights: number[];
  stockLeft: Map<string, number>;
}

function initPoolState(cards: PackCard[]): PoolState {
  const stockLeft = new Map<string, number>();
  for (const c of cards) {
    if (c.stock > 0) stockLeft.set(c.cardId, c.stock);
  }
  const scaledWeights = cards.map((c) => scaleWeight(c.weight));
  return { cards, scaledWeights, stockLeft };
}

function buildAvailable(state: PoolState): {
  available: PackCard[];
  entries: PoolEntry[];
} {
  const available: PackCard[] = [];
  const entries: PoolEntry[] = [];
  for (let i = 0; i < state.cards.length; i++) {
    const c = state.cards[i];
    const rem = state.stockLeft.get(c.cardId) ?? 0;
    if (rem > 0) {
      available.push(c);
      entries.push({ cardId: c.cardId, weight: state.scaledWeights[i], stock: rem });
    }
  }
  return { available, entries };
}

function totalScaled(entries: PoolEntry[]): bigint {
  let total = BigInt(0);
  for (const e of entries) total += BigInt(e.weight);
  return total;
}

const MAX_SAFE_TOTAL_WEIGHT = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Math.random-derived BigInt bucket in [0, totalWeight). Asserts that
 * totalWeight fits in a safe integer so `Math.random() * tw` isn't
 * distorted by float-precision loss — if a box's scaled total ever exceeds
 * 2^53 we'd bias toward low-indexed cards silently without this guard.
 */
function mathRandomBucket(totalWeight: bigint): bigint {
  if (totalWeight > MAX_SAFE_TOTAL_WEIGHT) {
    throw new Error(
      `pack-engine: totalWeight ${totalWeight} exceeds Number.MAX_SAFE_INTEGER; Math.random path is no longer uniform`,
    );
  }
  return BigInt(Math.floor(Math.random() * Number(totalWeight)));
}

function recordDraw(
  state: PoolState,
  available: PackCard[],
  index: number,
  packIndex: number,
  cardIndex: number,
): DrawnCard {
  const drawn = available[index];
  state.stockLeft.set(drawn.cardId, (state.stockLeft.get(drawn.cardId) ?? 1) - 1);
  return {
    cardId: drawn.cardId,
    name: drawn.name,
    rarity: drawn.rarity,
    coinValue: drawn.coinValue,
    conversionValue: drawn.coinValue,
    image: drawn.image,
    packIndex,
    cardIndex,
  };
}

/**
 * Math.random-driven draw. Used by battle hands where provable fairness is
 * out of scope — intentional so a battle's chain of RNG calls doesn't burn
 * the user's pack-opening nonce.
 */
export function drawPacks(
  cards: PackCard[],
  cardsPerPack: number,
  packCount: number,
  priceInCoins: number,
): PackOpenResult {
  const state = initPoolState(cards);
  const drawnCards: DrawnCard[] = [];
  let cardCounter = 0;

  for (let p = 0; p < packCount; p++) {
    for (let d = 0; d < cardsPerPack; d++) {
      const { available, entries } = buildAvailable(state);
      if (available.length === 0) {
        return { drawnCards, totalCost: priceInCoins * packCount };
      }
      const totalWeight = totalScaled(entries);
      const bucket = mathRandomBucket(totalWeight);
      const idx = walkPool(entries, bucket);
      drawnCards.push(recordDraw(state, available, idx, p, cardCounter));
      cardCounter++;
    }
  }

  return { drawnCards, totalCost: priceInCoins * packCount };
}

/**
 * Provably-fair draw. The caller supplies an async RNG step; on each call
 * it returns a BigInt bucket in [0, totalWeight). Used by pack-opening so
 * outcomes can be replayed deterministically from a committed seed.
 */
export async function drawPacksWithFairness(
  cards: PackCard[],
  cardsPerPack: number,
  packCount: number,
  priceInCoins: number,
  rng: RngStep,
): Promise<PackOpenResult> {
  const state = initPoolState(cards);
  const drawnCards: DrawnCard[] = [];
  let cardCounter = 0;

  for (let p = 0; p < packCount; p++) {
    for (let d = 0; d < cardsPerPack; d++) {
      const { available, entries } = buildAvailable(state);
      if (available.length === 0) {
        return { drawnCards, totalCost: priceInCoins * packCount };
      }
      const totalWeight = totalScaled(entries);
      const bucket = await rng(totalWeight);
      const idx = walkPool(entries, bucket);
      drawnCards.push(recordDraw(state, available, idx, p, cardCounter));
      cardCounter++;
    }
  }

  return { drawnCards, totalCost: priceInCoins * packCount };
}
