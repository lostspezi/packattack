import mongoose from "mongoose";
import Box from "@/models/box";
import PackPull from "@/models/pack-pull";
import { drawBattleHand, type BoxCardForBattle } from "@/lib/battle-engine";
import type { IVirtualCard } from "@/models/battle";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function prepareBoxCardsForBattle(box: any): BoxCardForBattle[] {
  const cards = (box.cards ?? []) as Array<{
    card: unknown;
    rarity: string;
    weight: number;
    stock: number;
  }>;

  return cards
    .filter((c) => c.card)
    .map((c) => {
      const card = c.card as {
        _id: { toString(): string };
        name: string;
        image: string;
        internalPrice?: number;
        marketPrice?: number;
      };
      return {
        cardId: card._id.toString(),
        name: card.name,
        image: card.image ?? "",
        rarity: c.rarity,
        coinValue: Math.max(1, Math.floor(card.internalPrice ?? card.marketPrice ?? 1)),
        weight: c.weight,
        stock: c.stock,
      };
    });
}

/**
 * Draw a virtual battle hand. Battles don't persist anything — cards exist
 * only inside the battle document. The shared `boxCards` array is mutated
 * in-memory so later hands in the same round see the adjusted stock.
 */
export function drawBattleHandCards(boxCards: BoxCardForBattle[]): IVirtualCard[] {
  const { cards, stockDeltas } = drawBattleHand(boxCards);

  for (const [cardId, count] of Object.entries(stockDeltas)) {
    const card = boxCards.find((c) => c.cardId === cardId);
    if (card) card.stock = Math.max(0, card.stock - count);
  }

  return cards.map((c) => ({
    cardId: new mongoose.Types.ObjectId(c.cardId) as unknown as mongoose.Types.ObjectId,
    name: c.name,
    image: c.image,
    rarity: c.rarity,
    coinValue: c.coinValue,
    conversionValue: c.conversionValue,
    pullId: null,
  }));
}

/**
 * Auto-convert all expired pending pulls to coins.
 * Called server-side when checking for pending pulls.
 */
export async function autoConvertExpiredPulls(userId: string): Promise<number> {
  const now = new Date();

  // Atomically claim expired pulls one-by-one to prevent double-processing
  const converted: { conversionValue: number; boxId: mongoose.Types.ObjectId; cardId: mongoose.Types.ObjectId }[] = [];

   
  while (true) {
    const pull = await PackPull.findOneAndUpdate(
      { userId, status: "pending", expiresAt: { $ne: null, $lte: now } },
      { $set: { status: "converted", decidedAt: now } },
      { returnDocument: "before" },
    ).lean();

    if (!pull) break;

    converted.push({
      conversionValue: pull.conversionValue,
      boxId: pull.boxId,
      cardId: pull.cardId,
    });

    // Return card to box stock
    await Box.updateOne(
      { _id: pull.boxId, "cards.card": pull.cardId },
      { $inc: { "cards.$.stock": 1 } },
    );
  }

  if (converted.length === 0) return 0;

  const totalCoins = converted.reduce((sum, p) => sum + p.conversionValue, 0);

  // Add coins to user
  if (totalCoins > 0) {
    const User = (await import("@/models/user")).default;
    const CoinTransaction = (await import("@/models/coin-transaction")).default;

    await User.updateOne({ _id: userId }, { $inc: { coins: totalCoins } });
    await CoinTransaction.create({
      userId,
      amount: totalCoins,
      type: "card_conversion",
      reason: `Auto-converted ${converted.length} expired cards`,
    });
  }

  return converted.length;
}
