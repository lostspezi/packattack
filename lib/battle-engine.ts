import type { Types } from "mongoose";
import type { IVirtualCard } from "@/models/battle";
import { drawPacks, type PackCard } from "@/lib/pack-engine";

// ---------- Types ----------

export interface BoxCardForBattle {
  cardId: string;
  name: string;
  image: string;
  rarity: string;
  coinValue: number;
  weight: number;
  stock: number;
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

export interface DrawnBattleCard {
  cardId: string;
  name: string;
  image: string;
  rarity: string;
  coinValue: number;
  conversionValue: number;
}

const HAND_SIZE = 5;

// ---------- Hand generation (real cards, stock-aware) ----------

/**
 * Draw a battle hand of 5 real cards using the same weighted engine
 * as pack opening. Cards are drawn respecting stock — callers must
 * persist PackPull entries and decrement stock in the database.
 *
 * Returns the drawn cards + a stock delta map (cardId → count drawn).
 */
export function drawBattleHand(boxCards: BoxCardForBattle[]): {
  cards: DrawnBattleCard[];
  stockDeltas: Record<string, number>;
} {
  const packCards: PackCard[] = boxCards
    .filter((c) => c.stock > 0)
    .map((c) => ({
      cardId: c.cardId,
      name: c.name,
      rarity: c.rarity,
      weight: c.weight,
      stock: c.stock,
      coinValue: c.coinValue,
      image: c.image,
    }));

  if (packCards.length === 0) {
    throw new Error("No cards with stock available for battle hand");
  }

  // Draw 1 "pack" of 5 cards using the pack engine
  const result = drawPacks(packCards, HAND_SIZE, 1, 0);

  const cards: DrawnBattleCard[] = result.drawnCards.map((d) => ({
    cardId: d.cardId,
    name: d.name,
    image: d.image ?? "",
    rarity: d.rarity,
    coinValue: d.coinValue,
    conversionValue: d.conversionValue,
  }));

  // Build stock delta map
  const stockDeltas: Record<string, number> = {};
  for (const d of result.drawnCards) {
    stockDeltas[d.cardId] = (stockDeltas[d.cardId] ?? 0) + 1;
  }

  return { cards, stockDeltas };
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
