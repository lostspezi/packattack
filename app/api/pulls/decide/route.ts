import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import PackPull from "@/models/pack-pull";
import UserInventory from "@/models/user-inventory";
import User from "@/models/user";
import Box from "@/models/box";
import CoinTransaction from "@/models/coin-transaction";

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

  const { packGroupId, cardId, cardIndex, packIndex, rarity, coinValue, conversionValue, decision, boxId } = body as {
    packGroupId?: string;
    cardId?: string;
    cardIndex?: number;
    packIndex?: number;
    rarity?: string;
    coinValue?: number;
    conversionValue?: number;
    decision?: "claim" | "convert";
    boxId?: string;
  };

  if (!packGroupId || !cardId || cardIndex === undefined || !decision || !boxId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (decision !== "claim" && decision !== "convert") {
    return NextResponse.json({ error: "decision must be 'claim' or 'convert'" }, { status: 400 });
  }

  try {
    await connectDB();

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip")
      ?? "unknown";
    const ua = req.headers.get("user-agent") ?? "unknown";

    // Create the PackPull record with final status
    // Unique index on (packGroupId, cardIndex) prevents duplicates atomically
    let pull;
    try {
      pull = await PackPull.create({
        userId,
        boxId,
        cardId,
        rarity: rarity ?? "",
        coinValue: coinValue ?? 0,
        conversionValue: conversionValue ?? 0,
        status: decision === "claim" ? "claimed" : "converted",
        decidedAt: new Date(),
        packGroupId,
        packIndex: packIndex ?? 0,
        cardIndex,
        ipAddress: ip,
        userAgent: ua,
      });
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 11000) {
        return NextResponse.json({ error: "Already decided for this card" }, { status: 400 });
      }
      throw err;
    }

    if (decision === "claim") {
      // Claim: card goes to inventory, stock stays reduced
      await UserInventory.create({
        userId,
        cardId,
        boxId,
        pullId: pull._id,
        rarity: rarity ?? "",
      });

      const user = await User.findById(userId).select("coins").lean();
      return NextResponse.json({ success: true, decision: "claimed", newBalance: user?.coins ?? 0 });
    } else {
      // Convert: give coins back, restore stock
      const user = await User.findByIdAndUpdate(
        userId,
        { $inc: { coins: conversionValue ?? 0 } },
        { returnDocument: "after" }
      );

      // Atomically restore stock in box (race-condition safe)
      const { Types } = await import("mongoose");
      const cardObjectId = new Types.ObjectId(cardId);
      await Box.updateOne(
        { _id: boxId, "cards.card": cardObjectId },
        { $inc: { "cards.$.stock": 1 } }
      );

      // Record transaction
      await CoinTransaction.create({
        userId,
        amount: conversionValue ?? 0,
        type: "card_conversion",
        relatedPullId: pull._id,
        relatedBoxId: boxId,
      });

      return NextResponse.json({ success: true, decision: "converted", newBalance: user?.coins ?? 0 });
    }
  } catch (err) {
    console.error("[pulls/decide POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
