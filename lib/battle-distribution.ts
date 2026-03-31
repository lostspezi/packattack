import type { IVirtualCard } from "@/models/battle";
import type { BattleMode } from "@/models/battle";

// ---------- Mode-based distribution ----------

export interface TransferResult {
  from: string;
  to: string;
  cards: IVirtualCard[];
  mode: string;
}

/**
 * Distribute cards based on battle mode.
 * Winner gets card(s) from each loser.
 */
export function distributeByMode(
  mode: BattleMode,
  winnerId: string,
  playerCards: Map<string, IVirtualCard[]>,
): TransferResult[] {
  const transfers: TransferResult[] = [];

  for (const [playerId, cards] of playerCards.entries()) {
    if (playerId === winnerId || cards.length === 0) continue;

    let transferCards: IVirtualCard[];

    switch (mode) {
      case "lowest_card": {
        const minValue = Math.min(...cards.map((c) => c.coinValue));
        const lowest = cards.find((c) => c.coinValue === minValue);
        transferCards = lowest ? [lowest] : [];
        break;
      }
      case "highest_card": {
        const maxValue = Math.max(...cards.map((c) => c.coinValue));
        const highest = cards.find((c) => c.coinValue === maxValue);
        transferCards = highest ? [highest] : [];
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
        from: playerId,
        to: winnerId,
        cards: transferCards,
        mode,
      });
    }
  }

  return transfers;
}
