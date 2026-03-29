import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Battle from "@/models/battle";
import BattlePull from "@/models/battle-pull";
import CartItem from "@/models/cart-item";
import User from "@/models/user";
import Box from "@/models/box";
import CoinTransaction from "@/models/coin-transaction";
import { battleDecideSchema } from "@/lib/validations/battle";
import mongoose from "mongoose";

const RESERVATION_HOURS = 3;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: battleId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = battleDecideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { battlePullId, decision } = parsed.data;

  try {
    await connectDB();

    // Atomically claim the BattlePull
    const pull = await BattlePull.findOneAndUpdate(
      {
        _id: battlePullId,
        battle: battleId,
        distributedTo: userId,
        status: "distributed",
      },
      {
        $set: {
          status: decision === "claim" ? "claimed" : "converted",
          decidedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    if (!pull) {
      return NextResponse.json({ error: "Battle pull not found or already decided" }, { status: 404 });
    }

    // Load the battle to get the box reference
    const isObjectId = /^[a-f\d]{24}$/i.test(battleId);
    const battle = await Battle.findOne(
      isObjectId ? { $or: [{ _id: battleId }, { slug: battleId }] } : { slug: battleId }
    ).lean();

    if (!battle) {
      return NextResponse.json({ error: "Battle not found" }, { status: 404 });
    }

    if (decision === "claim") {
      // Use existing cart expiry to align all items, or start a new 3h window
      const existingItem = await CartItem.findOne({ userId, status: "reserved" })
        .select("expiresAt")
        .lean();
      const expiresAt = existingItem?.expiresAt
        ? new Date(existingItem.expiresAt)
        : new Date(Date.now() + RESERVATION_HOURS * 60 * 60 * 1000);

      await CartItem.create({
        userId,
        cardId: pull.card,
        boxId: battle.box,
        pullId: pull._id,
        rarity: pull.rarity,
        conversionValue: pull.conversionValue,
        status: "reserved",
        expiresAt,
      });

      return NextResponse.json({ decision: "claim", expiresAt: expiresAt.toISOString() });
    } else {
      // Convert: credit coins to user
      await User.updateOne({ _id: userId }, { $inc: { coins: pull.conversionValue } });

      // Return stock to box
      const cardOid = new mongoose.Types.ObjectId(pull.card.toString());
      await Box.updateOne(
        { _id: battle.box, "cards.card": cardOid },
        { $inc: { "cards.$.stock": 1 } }
      );

      // Record coin transaction
      await CoinTransaction.create({
        userId,
        amount: pull.conversionValue,
        type: "battle_card_conversion",
        relatedBattleId: battleId,
      });

      return NextResponse.json({ decision: "convert", coinsReceived: pull.conversionValue });
    }
  } catch (err) {
    console.error("[battles/[id]/decide POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
