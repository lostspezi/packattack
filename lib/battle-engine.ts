import {
  RARITY_ORDER,
  CLOSE_MATCH_THRESHOLD,
  CARD_REVEAL_RARE_BONUS_MS,
  CARD_REVEAL_ULTRA_BONUS_MS,
} from "./battle-constants";

interface RoundCard {
  playerId: string;
  coinValue: number;
  rarity: string;
}

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
 * Get extra display time in ms for a card based on its rarity.
 * Rare+ (order >= 3): +2000ms. Ultra Rare+ (order >= 5): +4000ms.
 */
export function getRarityBonusMs(rarity: string): number {
  const order = RARITY_ORDER[rarity] ?? 1;
  if (order >= 5) return CARD_REVEAL_ULTRA_BONUS_MS;
  if (order >= 3) return CARD_REVEAL_RARE_BONUS_MS;
  return 0;
}
