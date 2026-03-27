/**
 * Card substitution logic.
 * When a box card hits stock=0, find a replacement from global InventoryItem
 * within ±5 coins and update the box card in-place.
 *
 * Called from /api/packs/[id]/open after atomic stock decrements.
 */

import connectDB from "@/lib/db";
import Box from "@/models/box";
import Card from "@/models/card";
import InventoryItem from "@/models/inventory-item";
import Notification from "@/models/notification";
import User from "@/models/user";
import { Types } from "mongoose";

export interface SubstitutionInput {
  boxId: string;
  /** Map of cardId → number of units drawn in this opening (only cards that just hit 0) */
  depletedCards: Record<string, number>;
}

export interface SubstitutionResult {
  substituted: Array<{ originalCardId: string; newCardId: string }>;
  boxPaused: boolean;
}

/**
 * Run substitutions for all cards that just hit stock=0.
 * Updates the box document in MongoDB and sends admin notifications.
 */
export async function runSubstitutions(
  input: SubstitutionInput
): Promise<SubstitutionResult> {
  await connectDB();

  const { boxId, depletedCards } = input;
  const boxObjectId = new Types.ObjectId(boxId);

  const box = await Box.findById(boxObjectId);
  if (!box) return { substituted: [], boxPaused: false };

  const admins = await User.find({ role: { $in: ["admin", "super_admin"] } })
    .select("_id")
    .lean();
  const adminIds = admins.map((a) => a._id.toString());
  const boxName = box.name.de ?? box.name.en ?? "Box";

  const substituted: Array<{ originalCardId: string; newCardId: string }> = [];
  let boxPaused = false;
  let pauseTriggered = false;

  for (const [cardId, drawnCount] of Object.entries(depletedCards)) {
    const cardObjectId = new Types.ObjectId(cardId);

    // Get original card's internalPrice
    const originalCard = await Card.findById(cardObjectId).select("internalPrice name").lean();
    if (!originalCard) continue;

    const originalPrice = originalCard.internalPrice ?? 0;
    const originalName = originalCard.name ?? "Unknown";

    // Find best matching InventoryItem within ±5 coins, excluding the same card
    const candidates = await InventoryItem.aggregate([
      {
        $match: {
          stock: { $gt: 0 },
          card: { $ne: cardObjectId },
        },
      },
      {
        $lookup: {
          from: "cards",
          localField: "card",
          foreignField: "_id",
          as: "cardDoc",
        },
      },
      { $unwind: "$cardDoc" },
      {
        $match: {
          "cardDoc.internalPrice": {
            $gte: originalPrice - 5,
            $lte: originalPrice + 5,
          },
        },
      },
      {
        $addFields: {
          priceDiff: { $abs: { $subtract: ["$cardDoc.internalPrice", originalPrice] } },
        },
      },
      { $sort: { priceDiff: 1 } },
      { $limit: 1 },
    ]);

    if (candidates.length === 0) {
      // No substitute found — pause box once and notify
      if (!pauseTriggered) {
        await Box.updateOne({ _id: boxObjectId }, { $set: { status: "paused" } });
        pauseTriggered = true;
        boxPaused = true;
      }

      for (const adminId of adminIds) {
        await Notification.create({
          userId: adminId,
          title: `Kein Ersatz: ${originalName}`,
          message: `Keine Ersatzkarte für "${originalName}" in "${boxName}" gefunden. Box wurde pausiert.`,
          type: "error",
          cta: { label: "Box öffnen", url: `/de/admin/boxes/${boxId}` },
        });
      }
      continue;
    }

    const candidate = candidates[0] as {
      _id: Types.ObjectId;
      card: Types.ObjectId;
      stock: number;
      cardDoc: { _id: Types.ObjectId; name: string; internalPrice: number };
    };

    const substituteAmount = Math.min(candidate.stock, drawnCount);

    // Atomically decrement InventoryItem stock
    const updateResult = await InventoryItem.findOneAndUpdate(
      { _id: candidate._id, stock: { $gte: substituteAmount } },
      { $inc: { stock: -substituteAmount } }
    );
    if (!updateResult) continue; // Race condition — skip

    // Update the box card entry in-place
    await Box.updateOne(
      { _id: boxObjectId, "cards.card": cardObjectId },
      {
        $set: {
          "cards.$.card": candidate.card,
          "cards.$.stock": substituteAmount,
          "cards.$.isSubstitute": true,
          "cards.$.originalCard": cardObjectId,
        },
      }
    );

    substituted.push({
      originalCardId: cardId,
      newCardId: candidate.card.toString(),
    });

    // Notify admins about substitution
    for (const adminId of adminIds) {
      await Notification.create({
        userId: adminId,
        title: `Karte substituiert: ${originalName}`,
        message: `"${originalName}" in "${boxName}" wurde durch "${candidate.cardDoc.name}" ersetzt (${substituteAmount} Stück).`,
        type: "info",
        cta: { label: "Box öffnen", url: `/de/admin/boxes/${boxId}` },
      });
    }
  }

  return { substituted, boxPaused };
}
