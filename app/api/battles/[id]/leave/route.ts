import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Battle from "@/models/battle";
import User from "@/models/user";
import CoinTransaction from "@/models/coin-transaction";
import { getRedis } from "@/lib/redis";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await connectDB();

    const isObjectId = /^[a-f\d]{24}$/i.test(id);
    const battle = await Battle.findOne({
      $or: isObjectId ? [{ _id: id }, { slug: id }] : [{ slug: id }],
      status: "waiting",
    });

    if (!battle) {
      return NextResponse.json(
        { error: "Battle not found or cannot be left at this stage" },
        { status: 404 }
      );
    }

    // Find the player in the battle
    const playerEntry = battle.players.find(
      (p) => p.user.toString() === userId
    );
    if (!playerEntry) {
      return NextResponse.json({ error: "You are not in this battle" }, { status: 403 });
    }

    const coinsReserved = playerEntry.coinsReserved;
    const isCreator = battle.createdBy.toString() === userId;

    if (isCreator || battle.players.length <= 1) {
      // Creator leaves or no players remaining — cancel the battle and refund all
      await Battle.updateOne({ _id: battle._id }, { $set: { status: "cancelled" } });

      for (const player of battle.players) {
        const pUserId = player.user.toString();
        const pCoins = player.coinsReserved;

        await User.updateOne({ _id: pUserId }, { $inc: { coins: pCoins } });
        await CoinTransaction.create({
          userId: pUserId,
          amount: pCoins,
          type: "battle_refund",
          relatedBattleId: battle._id,
        });
      }

      // Publish battle_cancelled SSE event
      void publishEvent(battle._id.toString(), {
        type: "battle_cancelled",
        cancelledBy: userId,
      });
    } else {
      // Non-creator leaves — remove player and refund their coins
      await Battle.updateOne(
        { _id: battle._id },
        { $pull: { players: { user: userId } } }
      );

      await User.updateOne({ _id: userId }, { $inc: { coins: coinsReserved } });
      await CoinTransaction.create({
        userId,
        amount: coinsReserved,
        type: "battle_refund",
        relatedBattleId: battle._id,
      });

      // Publish player_left SSE event
      void publishEvent(battle._id.toString(), {
        type: "player_left",
        userId,
        playerCount: battle.players.length - 1,
      });
    }

    return NextResponse.json({ left: true });
  } catch (err) {
    console.error("[battles/[id]/leave DELETE]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

async function publishEvent(battleId: string, data: Record<string, unknown>) {
  try {
    const redis = getRedis();
    await redis.publish(`battle:${battleId}`, JSON.stringify(data));
  } catch {
    // Non-critical — SSE is best-effort
  }
}
