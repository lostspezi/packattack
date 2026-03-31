import type { Types } from "mongoose";
import type { IVirtualCard } from "@/models/battle";
import type { BattleMode } from "@/models/battle";

// ---------- Snake Draft ----------

/**
 * Distribute cards via Snake Draft.
 * Cards sorted by coinValue desc, then assigned in snake order by ranking.
 *
 * 2 players: P1, P2, P2, P1, P1, P2, ...
 * 3 players: P1, P2, P3, P3, P2, P1, ...
 * 4 players: P1, P2, P3, P4, P4, P3, P2, P1, ...
 */
export function distributeSnakeDraft(
  cards: IVirtualCard[],
  ranking: string[],
): Map<string, IVirtualCard[]> {
  const result = new Map<string, IVirtualCard[]>();
  for (const id of ranking) result.set(id, []);

  const sorted = [...cards].sort((a, b) => b.coinValue - a.coinValue);
  const playerCount = ranking.length;

  for (let i = 0; i < sorted.length; i++) {
    // Snake pattern: forward on even rounds, backward on odd rounds
    const round = Math.floor(i / playerCount);
    const posInRound = i % playerCount;
    const playerIndex = round % 2 === 0 ? posInRound : playerCount - 1 - posInRound;
    const playerId = ranking[playerIndex];
    result.get(playerId)!.push(sorted[i]);
  }

  return result;
}

// ---------- Mode-based distribution ----------

interface TransferResult {
  from: Types.ObjectId | { toString(): string };
  to: Types.ObjectId | { toString(): string };
  cards: IVirtualCard[];
  mode: string;
}

/**
 * Distribute cards based on battle mode.
 * For modes 1-3: winner gets card(s) from each loser.
 * For snake_draft: all cards pooled and distributed by snake order.
 */
export function distributeByMode(
  mode: BattleMode,
  winnerId: string,
  playerCards: Map<string, IVirtualCard[]>,
): TransferResult[] {
  if (mode === "snake_draft") {
    return distributeSnakeDraftMode(winnerId, playerCards);
  }

  const transfers: TransferResult[] = [];

  for (const [playerId, cards] of playerCards.entries()) {
    if (playerId === winnerId) continue;

    let transferCards: IVirtualCard[];

    switch (mode) {
      case "lowest_card": {
        const minValue = Math.min(...cards.map((c) => c.coinValue));
        const lowest = cards.find((c) => c.coinValue === minValue)!;
        transferCards = [lowest];
        break;
      }
      case "highest_card": {
        const maxValue = Math.max(...cards.map((c) => c.coinValue));
        const highest = cards.find((c) => c.coinValue === maxValue)!;
        transferCards = [highest];
        break;
      }
      case "all_cards": {
        transferCards = [...cards];
        break;
      }
      default:
        transferCards = [];
    }

    if (transferCards.length > 0) {
      transfers.push({
        from: { toString: () => playerId } as Types.ObjectId,
        to: { toString: () => winnerId } as Types.ObjectId,
        cards: transferCards,
        mode,
      });
    }
  }

  return transfers;
}

function distributeSnakeDraftMode(
  winnerId: string,
  playerCards: Map<string, IVirtualCard[]>,
): TransferResult[] {
  // Pool all cards
  const allCards: IVirtualCard[] = [];
  for (const cards of playerCards.values()) {
    allCards.push(...cards);
  }

  // Ranking: winner first, then others
  const ranking = [winnerId, ...Array.from(playerCards.keys()).filter((id) => id !== winnerId)];

  const distribution = distributeSnakeDraft(allCards, ranking);

  // Convert to transfers: each player "receives" their allocation
  const transfers: TransferResult[] = [];
  for (const [playerId, cards] of distribution.entries()) {
    if (cards.length > 0) {
      transfers.push({
        from: { toString: () => "pool" } as Types.ObjectId,
        to: { toString: () => playerId } as Types.ObjectId,
        cards,
        mode: "snake_draft",
      });
    }
  }

  return transfers;
}
