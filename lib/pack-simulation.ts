/**
 * Pack Opening Simulation — pure functions, no React, no side effects.
 */

// --- Input Types ---

export interface SimulationCardInput {
  _id: string;
  name: string;
  rarity: string;
  weight: number;
  marketPrice: number | null;
  internalPrice: number | null;
  image: string | null;
}

export interface SimulationInput {
  cards: SimulationCardInput[];
  cardsPerPack: number;
  numPacks: number;
  priceInCoins: number;
}

// --- Result Types ---

export interface CardResult {
  cardId: string;
  name: string;
  rarity: string;
  image: string | null;
  effectivePrice: number;
  pullCount: number;
  pullPercentage: number;
  expectedPercentage: number;
  deviation: number;
  valueContributed: number;
}

export interface RarityResult {
  rarity: string;
  pullCount: number;
  pullPercentage: number;
  expectedPercentage: number;
  deviation: number;
}

export interface SimulationResult {
  // Params
  numPacks: number;
  cardsPerPack: number;
  totalDraws: number;
  priceInCoins: number;

  // Value KPIs (all in Coins, 1 Coin = 1€)
  totalCostCoins: number;
  totalPullValueCoins: number;
  profitLossCoins: number;
  roi: number;
  marginCoins: number;
  marginPercent: number;
  avgPackValueCoins: number;
  bestPackValue: number;
  worstPackValue: number;
  medianPackValue: number;

  // Card KPIs
  mostPulledCard: { name: string; count: number } | null;
  rarestPull: { name: string; count: number } | null;
  uniqueCardsHit: number;
  totalCardsInBox: number;
  neverPulled: number;
  cardsWithoutPrice: number;

  // Detailed results
  cardResults: CardResult[];
  rarityResults: RarityResult[];
  packValueDistribution: number[];
}

// --- Algorithm ---

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

export function runSimulation(input: SimulationInput): SimulationResult {
  const { cards, cardsPerPack, numPacks, priceInCoins } = input;
  const totalDraws = numPacks * cardsPerPack;

  // 1. Preprocessing: build cumulative weight array
  const totalWeight = cards.reduce((acc, c) => acc + c.weight, 0);
  const cumulative: number[] = [];
  let running = 0;
  for (const card of cards) {
    running += card.weight;
    cumulative.push(running);
  }

  // Effective prices in Coins (internalPrice = Coin value of the card)
  const effectivePrices = cards.map((c) => c.internalPrice ?? 0);

  // 2. Simulation
  const pullCounts = new Int32Array(cards.length);
  const packValues: number[] = new Array(numPacks);

  for (let p = 0; p < numPacks; p++) {
    let packValue = 0;
    for (let d = 0; d < cardsPerPack; d++) {
      const rand = Math.random() * totalWeight;
      const idx = binarySearch(cumulative, rand);
      pullCounts[idx]++;
      packValue += effectivePrices[idx];
    }
    packValues[p] = Math.round(packValue * 100) / 100;
  }

  // 3. Post-processing: per-card results
  const cardResults: CardResult[] = cards.map((card, i) => {
    const pullCount = pullCounts[i];
    const pullPercentage = totalDraws > 0 ? (pullCount / totalDraws) * 100 : 0;
    const expectedPercentage = totalWeight > 0 ? (card.weight / totalWeight) * 100 : 0;
    return {
      cardId: card._id,
      name: card.name,
      rarity: card.rarity,
      image: card.image,
      effectivePrice: effectivePrices[i],
      pullCount,
      pullPercentage,
      expectedPercentage,
      deviation: pullPercentage - expectedPercentage,
      valueContributed: Math.round(pullCount * effectivePrices[i] * 100) / 100,
    };
  });

  // 4. Per-rarity results
  const rarityMap = new Map<string, { pulls: number; expectedWeight: number }>();
  for (let i = 0; i < cards.length; i++) {
    const r = cards[i].rarity || "Unknown";
    const entry = rarityMap.get(r) ?? { pulls: 0, expectedWeight: 0 };
    entry.pulls += pullCounts[i];
    entry.expectedWeight += cards[i].weight;
    rarityMap.set(r, entry);
  }

  const rarityResults: RarityResult[] = Array.from(rarityMap.entries()).map(
    ([rarity, data]) => {
      const pullPercentage = totalDraws > 0 ? (data.pulls / totalDraws) * 100 : 0;
      const expectedPercentage = totalWeight > 0 ? (data.expectedWeight / totalWeight) * 100 : 0;
      return {
        rarity,
        pullCount: data.pulls,
        pullPercentage,
        expectedPercentage,
        deviation: pullPercentage - expectedPercentage,
      };
    }
  );

  // 5. KPIs (all Coins, 1 Coin = 1€)
  const totalCostCoins = numPacks * priceInCoins;
  const totalPullValueCoins = cardResults.reduce((a, c) => a + c.valueContributed, 0);
  const profitLossCoins = Math.round((totalPullValueCoins - totalCostCoins) * 100) / 100;
  const roi = totalCostCoins > 0 ? Math.round((profitLossCoins / totalCostCoins) * 10000) / 100 : 0;
  const marginCoins = Math.round((totalCostCoins - totalPullValueCoins) * 100) / 100;
  const marginPercent = totalCostCoins > 0 ? Math.round((marginCoins / totalCostCoins) * 10000) / 100 : 0;
  const avgPackValueCoins = numPacks > 0 ? Math.round((totalPullValueCoins / numPacks) * 100) / 100 : 0;

  const sortedPackValues = [...packValues].sort((a, b) => a - b);
  const bestPackValue = sortedPackValues[sortedPackValues.length - 1] ?? 0;
  const worstPackValue = sortedPackValues[0] ?? 0;
  const medianPackValue =
    sortedPackValues.length % 2 === 0
      ? Math.round(((sortedPackValues[sortedPackValues.length / 2 - 1] + sortedPackValues[sortedPackValues.length / 2]) / 2) * 100) / 100
      : sortedPackValues[Math.floor(sortedPackValues.length / 2)] ?? 0;

  const pulledCards = cardResults.filter((c) => c.pullCount > 0);
  const mostPulledCard = pulledCards.length > 0
    ? pulledCards.reduce((a, b) => (a.pullCount >= b.pullCount ? a : b))
    : null;
  const rarestPull = pulledCards.length > 0
    ? pulledCards.reduce((a, b) => (a.pullCount <= b.pullCount ? a : b))
    : null;

  const cardsWithoutPrice = cards.filter((c) => c.internalPrice === null || c.internalPrice === undefined || c.internalPrice === 0).length;

  return {
    numPacks,
    cardsPerPack,
    totalDraws,
    priceInCoins,
    totalCostCoins,
    totalPullValueCoins: Math.round(totalPullValueCoins * 100) / 100,
    profitLossCoins,
    roi,
    marginCoins,
    marginPercent,
    avgPackValueCoins,
    bestPackValue,
    worstPackValue,
    medianPackValue,
    mostPulledCard: mostPulledCard ? { name: mostPulledCard.name, count: mostPulledCard.pullCount } : null,
    rarestPull: rarestPull ? { name: rarestPull.name, count: rarestPull.pullCount } : null,
    uniqueCardsHit: pulledCards.length,
    totalCardsInBox: cards.length,
    neverPulled: cards.length - pulledCards.length,
    cardsWithoutPrice,
    cardResults,
    rarityResults,
    packValueDistribution: packValues,
  };
}
