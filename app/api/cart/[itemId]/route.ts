import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import mongoose from "mongoose";
import CartItem from "@/models/cart-item";
import PackPull from "@/models/pack-pull";
import User from "@/models/user";
import Box from "@/models/box";
import CoinTransaction from "@/models/coin-transaction";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { itemId } = await params;

  try {
    await connectDB();

    const item = await CartItem.findOneAndUpdate(
      { _id: itemId, userId, status: "reserved" },
      { status: "expired" },
      { returnDocument: "before" }
    );

    if (!item) {
      return NextResponse.json({ error: "Item not found or already processed" }, { status: 404 });
    }

    await PackPull.updateOne(
      { _id: item.pullId, status: "reserved" },
      { status: "converted" }
    );

    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { coins: item.conversionValue } },
      { returnDocument: "after" }
    );

    const cardObjectId = new mongoose.Types.ObjectId(item.cardId.toString());
    await Box.updateOne(
      { _id: item.boxId, "cards.card": cardObjectId },
      { $inc: { "cards.$.stock": 1 } }
    );

    await CoinTransaction.create({
      userId,
      amount: item.conversionValue,
      type: "card_conversion",
      reason: "Manual conversion from cart",
      relatedPullId: item.pullId,
      relatedBoxId: item.boxId,
    });

    return NextResponse.json({
      success: true,
      convertedCoins: item.conversionValue,
      newBalance: user?.coins ?? 0,
    });
  } catch (err) {
    console.error("[cart/[itemId] DELETE]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
