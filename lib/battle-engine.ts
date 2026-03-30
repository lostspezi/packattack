import {
  RARITY_ORDER,
  CLOSE_MATCH_THRESHOLD,
  CARD_REVEAL_RARE_BONUS_MS,
  CARD_REVEAL_ULTRA_BONUS_MS,
  HAND_SIZE,
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
 * Players with equal score AND equal totalValue share the same placement.
 */
export function calculatePlacements(
  players: PlacementPlayer[]
): Array<{ userId: string; placement: number }> {
  const sorted = [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.totalValue - a.totalValue;
  });

  const result: Array<{ userId: string; placement: number }> = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) {
      result.push({ userId: sorted[i].userId, placement: 1 });
    } else {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (curr.score === prev.score && curr.totalValue === prev.totalValue) {
        result.push({ userId: curr.userId, placement: result[i - 1].placement });
      } else {
        result.push({ userId: curr.userId, placement: i + 1 });
      }
    }
  }
  return result;
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

export interface DealableCard {
  card: string;
  coinValue: number;
  rarity: string;
  name: string;
  image: string;
}

export interface DealtHand {
  player: string;
  dealtCards: DealableCard[];
  selectedIndex: null;
}

export function dealHands(pool: DealableCard[], playerIds: string[]): DealtHand[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const perPlayer = Math.min(HAND_SIZE, Math.floor(shuffled.length / playerIds.length));
  return playerIds.map((playerId, i) => ({
    player: playerId,
    dealtCards: shuffled.slice(i * perPlayer, (i + 1) * perPlayer),
    selectedIndex: null,
  }));
}
