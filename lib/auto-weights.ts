/**
 * Auto-calculate card weights based on market prices and suggest pack price.
 * Pure functions, no React, no side effects.
 */

export interface AutoWeightCard {
  _id: string;
  marketPrice: number | null;
  internalPrice: number | null;
}

export interface AutoWeightResult {
  weights: Map<string, number>;
  coinValues: Map<string, number>;
  suggestedPackPrice: number;
  expectedPackValue: number;
  coinRate: number;
}

/**
 * Calculate weights inversely proportional to price.
 * Expensive cards get low weights (rare), cheap cards get high weights (common).
 * Also calculates coin values and suggested pack price with margin.
 *
 * coinRate: how many coins per $1 USD (e.g. 100 means $0.12 = 12 coins, $174 = 17400 coins)
 */
export function calculateAutoWeights(
  cards: AutoWeightCard[],
  cardsPerPack: number,
  marginPercent: number,
  coinRate: number
): AutoWeightResult {
  if (cards.length === 0) {
    return { weights: new Map(), coinValues: new Map(), suggestedPackPrice: 0, expectedPackValue: 0, coinRate };
  }

  // Use marketPrice, fallback to internalPrice
  const prices = cards.map((c) => c.marketPrice ?? c.internalPrice ?? 0);

  // For cards with no price, use median of priced cards
  const pricedValues = prices.filter((p) => p > 0).sort((a, b) => a - b);
  const medianPrice = pricedValues.length > 0
    ? pricedValues[Math.floor(pricedValues.length / 2)]
    : 1;

  const effectivePrices = prices.map((p) => (p > 0 ? p : medianPrice));

  // Inverse weighting: weight = 1/price (cheaper = higher weight = more common)
  const rawWeights = effectivePrices.map((p) => 1 / p);
  const totalRaw = rawWeights.reduce((a, b) => a + b, 0);

  // Normalize to sum=100, round to 3 decimals, minimum 0.001
  const weights = new Map<string, number>();
  for (let i = 0; i < cards.length; i++) {
    const normalized = (rawWeights[i] / totalRaw) * 100;
    const rounded = Math.max(0.001, Math.round(normalized * 1000) / 1000);
    weights.set(cards[i]._id, rounded);
  }

  // Coin values: marketPrice × coinRate, rounded, minimum 1
  const coinValues = new Map<string, number>();
  for (let i = 0; i < cards.length; i++) {
    const price = effectivePrices[i];
    coinValues.set(cards[i]._id, Math.max(1, Math.round(price * coinRate)));
  }

  // Expected pack value: weighted average card value × cardsPerPack
  const totalWeight = Array.from(weights.values()).reduce((a, b) => a + b, 0);
  let expectedCardValue = 0;
  for (let i = 0; i < cards.length; i++) {
    const w = weights.get(cards[i]._id) ?? 0;
    const coinVal = coinValues.get(cards[i]._id) ?? 0;
    expectedCardValue += (w / totalWeight) * coinVal;
  }
  const expectedPackValue = Math.round(expectedCardValue * cardsPerPack * 100) / 100;

  // Pack price with margin
  const suggestedPackPrice = Math.max(1, Math.round(expectedPackValue * (1 + marginPercent / 100)));

  return { weights, coinValues, suggestedPackPrice, expectedPackValue, coinRate };
}
