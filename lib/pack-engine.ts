/**
 * Server-side pack opening engine.
 * Similar to pack-simulation.ts but with stock tracking —
 * each drawn card reduces available stock so a card with stock 1 can't be drawn twice.
 */

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

function binarySearch(cumulative: number[], target: number): number {
  let lo = 0;
  let hi = cumulative.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (cumulative[mid] < target) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/**
 * Draw cards from a box with stock tracking.
 * Cards with stock 0 are excluded. After each draw, the card's stock
 * is decremented in the local copy so it can't be over-drawn.
 *
 * @param cards - Available cards with stock > 0
 * @param cardsPerPack - How many cards per pack
 * @param packCount - How many packs to open (1-10)
 * @param priceInCoins - Cost per pack
 */
export function drawPacks(
  cards: PackCard[],
  cardsPerPack: number,
  packCount: number,
  priceInCoins: number,
): PackOpenResult {
  // Work with mutable copies of stock
  const stockLeft = new Map<string, number>();
  for (const c of cards) {
    if (c.stock > 0) stockLeft.set(c.cardId, c.stock);
  }

  const drawnCards: DrawnCard[] = [];
  const totalDraws = cardsPerPack * packCount;

  for (let p = 0; p < packCount; p++) {
    for (let d = 0; d < cardsPerPack; d++) {
      // Build available pool (cards with remaining stock)
      const available: PackCard[] = [];
      for (const c of cards) {
        const remaining = stockLeft.get(c.cardId) ?? 0;
        if (remaining > 0) available.push(c);
      }

      if (available.length === 0) break; // No more cards available

      // Build cumulative weights for available cards
      let totalWeight = 0;
      const cumulative: number[] = [];
      for (const c of available) {
        totalWeight += c.weight;
        cumulative.push(totalWeight);
      }

      // Weighted random draw
      const rand = Math.random() * totalWeight;
      const idx = binarySearch(cumulative, rand);
      const drawn = available[idx];

      // Reduce stock
      stockLeft.set(drawn.cardId, (stockLeft.get(drawn.cardId) ?? 1) - 1);

      // Conversion value: 1:1 with coinValue
      const conversionValue = drawn.coinValue;

      drawnCards.push({
        cardId: drawn.cardId,
        name: drawn.name,
        rarity: drawn.rarity,
        coinValue: drawn.coinValue,
        conversionValue,
        image: drawn.image,
        packIndex: p,
        cardIndex: d,
      });
    }
  }

  return {
    drawnCards,
    totalCost: priceInCoins * packCount,
  };
}
