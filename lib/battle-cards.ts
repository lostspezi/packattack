/**
 * Battle card drawing — real cards with stock tracking.
 * Uses the same weighted engine as pack opening, creates PackPull entries,
 * and decrements box stock atomically.
 */

import mongoose from "mongoose";
import { randomUUID } from "crypto";
import Box from "@/models/box";
import PackPull from "@/models/pack-pull";
import { drawBattleHand, type BoxCardForBattle } from "@/lib/battle-engine";
import type { IVirtualCard } from "@/models/battle";

/**
 * Prepare box cards for battle drawing.
 */
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
 * Draw a battle hand for a player:
 * 1. Draw 5 cards using weighted engine (respects stock)
 * 2. Create PackPull entries (status "pending", linked to battle)
 * 3. Decrement box stock atomically
 *
 * Returns IVirtualCard[] with pullId references.
 */
export async function drawAndPersistBattleHand(
  boxId: string,
  boxCards: BoxCardForBattle[],
  playerId: string,
  battleId: string,
): Promise<IVirtualCard[]> {
  const { cards, stockDeltas } = drawBattleHand(boxCards);

  const packGroupId = `battle-${battleId}-${playerId}-${randomUUID().slice(0, 8)}`;

  // Create PackPull entries (expiresAt set when battle finishes)
  const pullDocs = cards.map((c, i) => ({
    userId: new mongoose.Types.ObjectId(playerId),
    boxId: new mongoose.Types.ObjectId(boxId),
    cardId: new mongoose.Types.ObjectId(c.cardId),
    rarity: c.rarity,
    coinValue: c.coinValue,
    conversionValue: c.conversionValue,
    status: "pending" as const,
    decidedAt: null,
    packGroupId,
    packIndex: 0,
    cardIndex: i,
    ipAddress: "battle",
    userAgent: "battle",
    battleId: new mongoose.Types.ObjectId(battleId),
    expiresAt: null, // Set when battle finishes
  }));

  const insertedPulls = await PackPull.insertMany(pullDocs);

  // Decrement stock atomically
  for (const [cardId, count] of Object.entries(stockDeltas)) {
    const cardObjectId = new mongoose.Types.ObjectId(cardId);
    await Box.updateOne(
      { _id: boxId, "cards.card": cardObjectId, "cards.stock": { $gte: count } },
      { $inc: { "cards.$.stock": -count } },
    );
  }

  // Update local boxCards stock so subsequent draws for other players are accurate
  for (const [cardId, count] of Object.entries(stockDeltas)) {
    const card = boxCards.find((c) => c.cardId === cardId);
    if (card) card.stock = Math.max(0, card.stock - count);
  }

  // Build IVirtualCard array with pullId references
  return cards.map((c, i) => ({
    cardId: new mongoose.Types.ObjectId(c.cardId) as unknown as mongoose.Types.ObjectId,
    name: c.name,
    image: c.image,
    rarity: c.rarity,
    coinValue: c.coinValue,
    conversionValue: c.conversionValue,
    pullId: insertedPulls[i]._id as mongoose.Types.ObjectId,
  }));
}

/**
 * Transfer card ownership by updating PackPull userId.
 * Used at the end of a battle when the mode dictates card redistribution.
 */
export async function transferCardOwnership(
  pullId: string,
  newOwnerId: string,
): Promise<void> {
  await PackPull.updateOne(
    { _id: pullId },
    { $set: { userId: new mongoose.Types.ObjectId(newOwnerId) } },
  );
}

/**
 * Set expiresAt on all pending battle pulls when a battle finishes.
 * Gives players 5 minutes to decide claim/convert.
 */
export async function activateBattlePullExpiry(battleId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await PackPull.updateMany(
    { battleId: new mongoose.Types.ObjectId(battleId), status: "pending", expiresAt: null },
    { $set: { expiresAt } },
  );
}

/**
 * Clean up unselected battle cards after a battle finishes.
 * Each round draws 5 cards but only 1 is selected — the other 4 must be
 * returned to stock and marked as converted.
 *
 * @param battleId  The battle that just finished
 * @param selectedPullIds  Set of pullId strings for the cards that were actually played
 */
export async function cleanupUnselectedBattlePulls(
  battleId: string,
  selectedPullIds: Set<string>,
): Promise<void> {
  const battleObjectId = new mongoose.Types.ObjectId(battleId);

  // Find all pending pulls for this battle that were NOT selected
  const unselected = await PackPull.find({
    battleId: battleObjectId,
    status: "pending",
    _id: { $nin: [...selectedPullIds].map((id) => new mongoose.Types.ObjectId(id)) },
  }).lean();

  if (unselected.length === 0) return;

  // Return stock for each unselected card
  for (const pull of unselected) {
    await Box.updateOne(
      { _id: pull.boxId, "cards.card": pull.cardId },
      { $inc: { "cards.$.stock": 1 } },
    );
  }

  // Mark all as converted (no coins awarded — they were never played)
  await PackPull.updateMany(
    { _id: { $in: unselected.map((p) => p._id) } },
    { $set: { status: "converted", decidedAt: new Date() } },
  );
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
