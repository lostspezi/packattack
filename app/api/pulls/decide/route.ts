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

  const { packGroupId, cardIndex, decision } = body as {
    packGroupId?: string;
    cardIndex?: number;
    decision?: "claim" | "convert";
  };

  if (!packGroupId || cardIndex === undefined || !decision) {
    return NextResponse.json({ error: "packGroupId, cardIndex, and decision are required" }, { status: 400 });
  }

  if (decision !== "claim" && decision !== "convert") {
    return NextResponse.json({ error: "decision must be 'claim' or 'convert'" }, { status: 400 });
  }

  try {
    await connectDB();

    // Find the pull
    const pulls = await PackPull.find({ userId, packGroupId }).sort({ packIndex: 1, cardIndex: 1 });
    const pull = pulls[cardIndex];

    if (!pull) {
      return NextResponse.json({ error: "Pull not found" }, { status: 404 });
    }

    if (pull.status !== "pending") {
      return NextResponse.json({ error: "Pull already decided" }, { status: 400 });
    }

    // Check deadline
    if (new Date() > pull.claimDeadline) {
      return NextResponse.json({ error: "Claim deadline expired" }, { status: 400 });
    }

    if (decision === "claim") {
      // Claim: move to inventory, stock stays reduced
      pull.status = "claimed";
      pull.decidedAt = new Date();
      await pull.save();

      await UserInventory.create({
        userId,
        cardId: pull.cardId,
        boxId: pull.boxId,
        pullId: pull._id,
        rarity: pull.rarity,
      });

      const user = await User.findById(userId).select("coins").lean();
      return NextResponse.json({ success: true, decision: "claimed", newBalance: user?.coins ?? 0 });
    } else {
      // Convert: give coins back, restore stock
      pull.status = "converted";
      pull.decidedAt = new Date();
      await pull.save();

      // Give conversion value coins
      const user = await User.findByIdAndUpdate(
        userId,
        { $inc: { coins: pull.conversionValue } },
        { returnDocument: "after" }
      );

      // Restore stock in box
      const box = await Box.findById(pull.boxId);
      if (box) {
        const cardEntry = box.cards.find((c) => c.card.toString() === pull.cardId.toString());
        if (cardEntry) {
          cardEntry.stock = (cardEntry.stock ?? 0) + 1;
          await box.save();
        }
      }

      // Record transaction
      await CoinTransaction.create({
        userId,
        amount: pull.conversionValue,
        type: "card_conversion",
        relatedPullId: pull._id,
        relatedBoxId: pull.boxId,
      });

      return NextResponse.json({ success: true, decision: "converted", newBalance: user?.coins ?? 0 });
    }
  } catch (err) {
    console.error("[pulls/decide POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
