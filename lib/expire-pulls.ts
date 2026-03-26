/**
 * Lazy expiration of pending pulls past their deadline.
 * Called on API reads to auto-convert expired pulls.
 */

import PackPull from "@/models/pack-pull";
import User from "@/models/user";
import Box from "@/models/box";
import CoinTransaction from "@/models/coin-transaction";

export async function expireOverduePulls(userId?: string): Promise<number> {
  const filter: Record<string, unknown> = {
    status: "pending",
    claimDeadline: { $lt: new Date() },
  };
  if (userId) filter.userId = userId;

  const expired = await PackPull.find(filter);
  if (expired.length === 0) return 0;

  for (const pull of expired) {
    pull.status = "expired";
    pull.decidedAt = new Date();
    await pull.save();

    // Give conversion coins
    await User.findByIdAndUpdate(pull.userId, { $inc: { coins: pull.conversionValue } });

    // Restore stock
    const box = await Box.findById(pull.boxId);
    if (box) {
      const entry = box.cards.find((c) => c.card.toString() === pull.cardId.toString());
      if (entry) {
        entry.stock = (entry.stock ?? 0) + 1;
        await box.save();
      }
    }

    // Record transaction
    await CoinTransaction.create({
      userId: pull.userId,
      amount: pull.conversionValue,
      type: "card_conversion",
      reason: "Auto-expired (deadline reached)",
      relatedPullId: pull._id,
      relatedBoxId: pull.boxId,
    });
  }

  return expired.length;
}
