import mongoose from "mongoose";
import Box from "@/models/box";
import PackPull from "@/models/pack-pull";
import { drawBattleHand, type BoxCardForBattle } from "@/lib/battle-engine";
import type { IVirtualCard } from "@/models/battle";

// ---------- Box card cache ----------

// Loading a Box with populated cards is the single most expensive query in
// the battle hot path — it fires for every round, every time. Caching the
// prepared card array for a short window cuts 7 identical populate()
// queries per 7-round battle down to 1.
const BOX_CARD_CACHE_TTL_MS = 5 * 60 * 1000;
const boxCardCache = new Map<
  string,
  { cards: BoxCardForBattle[]; expiresAt: number }
>();

export function invalidateBoxCardCache(boxId: string): void {
  boxCardCache.delete(boxId);
}

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
 * Load box cards ready for battle drawing, caching the prepared array so
 * subsequent rounds in the same battle skip the Mongo populate.
 *
 * The returned array is a fresh copy — callers may mutate `stock` freely
 * (drawBattleHandCards does) without poisoning the cache.
 */
export async function loadBattleBoxCards(
  boxId: string | mongoose.Types.ObjectId,
): Promise<BoxCardForBattle[]> {
  const key = boxId.toString();
  const cached = boxCardCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.cards.map((c) => ({ ...c }));
  }

  const box = await Box.findById(boxId)
    .populate("cards.card", "name image rarity internalPrice marketPrice")
    .lean();
  if (!box) throw new Error(`Box ${key} not found`);

  const cards = prepareBoxCardsForBattle(box);
  boxCardCache.set(key, { cards, expiresAt: Date.now() + BOX_CARD_CACHE_TTL_MS });
  return cards.map((c) => ({ ...c }));
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
