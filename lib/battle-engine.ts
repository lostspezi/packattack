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
  if (order >= 5) return 5000;
  if (order >= 3) return 4000;
  return 3000;
}
