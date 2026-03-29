import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { getRedis } from "@/lib/redis";
import mongoose from "mongoose";
import PackPull from "@/models/pack-pull";
import User from "@/models/user";
import Box from "@/models/box";
import CoinTransaction from "@/models/coin-transaction";
import { BULK_CONVERSION_BONUS } from "@/lib/pack-constants";

interface BulkCard {
  cardId: string;
  cardIndex: number;
  packIndex: number;
  rarity: string;
  coinValue: number;
  conversionValue: number;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { packGroupId, boxId, cards } = body as {
    packGroupId?: string;
    boxId?: string;
    cards?: BulkCard[];
  };

  if (!packGroupId || !boxId || !Array.isArray(cards) || cards.length === 0) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    await connectDB();

    // Load pending pulls from DB — never trust client-supplied values
    const cardIndices = cards.map((c) => c.cardIndex);
    const pendingPulls = await PackPull.find({
      packGroupId,
      userId,
      status: "pending",
      cardIndex: { $in: cardIndices },
    }).lean();

    if (pendingPulls.length === 0) {
      return NextResponse.json({ error: "No pending cards found" }, { status: 400 });
    }

    // Calculate bonus values from DB records
    const cardResults = pendingPulls.map((p) => {
      const bonusValue = Math.floor(p.conversionValue * (1 + BULK_CONVERSION_BONUS));
      return { ...p, bonusValue };
    });
    const totalCoins = cardResults.reduce((sum, c) => sum + c.bonusValue, 0);
    const baseCoins = pendingPulls.reduce((sum, p) => sum + p.conversionValue, 0);
    const bonusCoins = totalCoins - baseCoins;

    // Update pending PackPull records to converted with bonus values
    const bulkOps = cardResults.map((c) => ({
      updateOne: {
        filter: {
          packGroupId,
          userId,
          status: "pending" as const,
          cardIndex: c.cardIndex,
        },
        update: {
          $set: {
            status: "converted" as const,
            decidedAt: new Date(),
            conversionValue: c.bonusValue,
          },
        },
      },
    }));
    const bulkResult = await PackPull.bulkWrite(bulkOps);

    if (bulkResult.modifiedCount === 0) {
      return NextResponse.json(
        { error: "Cards already decided or not found" },
        { status: 400 }
      );
    }

    // Credit coins atomically
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { coins: totalCoins } },
      { returnDocument: "after" }
    );

    // Return card stock to boxes (using DB records)
    for (const p of pendingPulls) {
      const cardObjectId = new mongoose.Types.ObjectId(p.cardId.toString());
      await Box.updateOne(
        { _id: p.boxId, "cards.card": cardObjectId },
        { $inc: { "cards.$.stock": 1 } }
      );
    }

    // Single transaction record for the whole bulk conversion
    await CoinTransaction.create({
      userId,
      amount: totalCoins,
      type: "bulk_conversion",
      reason: `Bulk conversion of ${pendingPulls.length} cards (50% bonus)`,
      relatedBoxId: pendingPulls[0].boxId,
    });

    // Publish SSE live events (best-effort)
    void publishBulkEvents(pendingPulls[0].boxId.toString(), userId, pendingPulls);

    return NextResponse.json({
      success: true,
      convertedCount: pendingPulls.length,
      totalCoins,
      bonusCoins,
      newBalance: user?.coins ?? 0,
    });
  } catch (err) {
    console.error("[pulls/bulk-convert POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

async function publishBulkEvents(
  boxId: string,
  userId: string,
  pulls: Array<{ cardId: unknown; rarity: string; coinValue: number }>
) {
  try {
    const redis = getRedis();
    const userDoc = await User.findById(userId).select("name username image").lean();
    const Card = (await import("@/models/card")).default;

    for (const p of pulls) {
      const cardDoc = await Card.findById(p.cardId).select("name image").lean();
      await redis.publish(
        `box-events:${boxId}`,
        JSON.stringify({
          userName: userDoc?.name ?? userDoc?.username ?? "User",
          userImage: userDoc?.image ?? null,
          cardName: cardDoc?.name ?? "Unknown",
          cardImage: cardDoc?.image ?? null,
          rarity: p.rarity,
          coinValue: p.coinValue,
          decision: "convert",
          timestamp: Date.now(),
        })
      );
    }
  } catch {
    // Non-critical
  }
}
