import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import mongoose from "mongoose";
import PackPull from "@/models/pack-pull";
import User from "@/models/user";
import Box from "@/models/box";
import CoinTransaction from "@/models/coin-transaction";
import Notification from "@/models/notification";

const PENDING_TIMEOUT_HOURS = 24;

export async function POST(req: NextRequest) {
  // Verify cron secret
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const cutoff = new Date(Date.now() - PENDING_TIMEOUT_HOURS * 60 * 60 * 1000);

    // Find all expired pending pulls
    const expiredPulls = await PackPull.find({
      status: "pending",
      createdAt: { $lt: cutoff },
    }).lean();

    if (expiredPulls.length === 0) {
      return NextResponse.json({ processed: 0 });
    }

    // Group by userId + packGroupId
    const groups = new Map<string, typeof expiredPulls>();
    for (const pull of expiredPulls) {
      const key = `${pull.userId}_${pull.packGroupId}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(pull);
    }

    let totalProcessed = 0;

    for (const [, pulls] of groups) {
      const userId = pulls[0].userId.toString();
      const boxId = pulls[0].boxId.toString();
      const packGroupId = pulls[0].packGroupId;

      // Calculate total coins
      const totalCoins = pulls.reduce((sum, p) => sum + p.conversionValue, 0);

      // Update all pending pulls to converted
      await PackPull.updateMany(
        { packGroupId, userId, status: "pending" },
        { $set: { status: "converted", decidedAt: new Date(), binderId: null } }
      );

      // Credit user coins
      await User.findByIdAndUpdate(userId, { $inc: { coins: totalCoins } });

      // Return stock for each card
      for (const pull of pulls) {
        const cardObjectId = new mongoose.Types.ObjectId(pull.cardId.toString());
        await Box.updateOne(
          { _id: boxId, "cards.card": cardObjectId },
          { $inc: { "cards.$.stock": 1 } }
        );
      }

      // Create transaction record
      await CoinTransaction.create({
        userId,
        amount: totalCoins,
        type: "card_conversion",
        reason: `Auto-conversion of ${pulls.length} cards after ${PENDING_TIMEOUT_HOURS}h timeout`,
        relatedBoxId: boxId,
      });

      // Load box name for notification
      const box = await Box.findById(boxId).select("name").lean();
      const boxName = box?.name?.de ?? box?.name?.en ?? "Box";

      // Send notification
      await Notification.create({
        userId,
        title: "Karten automatisch umgewandelt",
        message: `Deine ${pulls.length} Karten aus „${boxName}" wurden nach 24 Stunden ohne Entscheidung automatisch in ${totalCoins} Coins umgewandelt.`,
        type: "info",
        cta: { label: "Balance ansehen", url: "/de/balance" },
      });

      totalProcessed += pulls.length;
    }

    return NextResponse.json({
      processed: totalProcessed,
      groups: groups.size,
    });
  } catch (err) {
    console.error("[cron/auto-convert]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
