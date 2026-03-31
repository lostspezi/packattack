import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Battle from "@/models/battle";
import User from "@/models/user";
import CoinTransaction from "@/models/coin-transaction";
import { publishBattleEvent } from "@/lib/battle-events";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const { id } = await params;

    const battle = await Battle.findById(id);
    if (!battle) {
      return NextResponse.json({ error: "battle_not_found" }, { status: 404 });
    }

    // Can only leave during waiting phase
    if (battle.status !== "waiting") {
      return NextResponse.json({ error: "cannot_leave" }, { status: 400 });
    }

    const playerIndex = battle.players.findIndex(
      (p) => p.user.toString() === session.user!.id,
    );
    if (playerIndex === -1) {
      return NextResponse.json({ error: "not_in_battle" }, { status: 403 });
    }

    // If creator leaves, cancel the battle and refund everyone
    if (battle.creator.toString() === session.user.id) {
      battle.status = "cancelled";

      // Refund all players
      for (const player of battle.players) {
        await User.updateOne(
          { _id: player.user },
          { $inc: { coins: battle.entryFee } },
        );
        await CoinTransaction.create({
          userId: player.user,
          amount: battle.entryFee,
          type: "battle_refund",
          reason: "Battle cancelled by creator",
          relatedBattleId: battle._id,
        });
      }

      await battle.save();
      await publishBattleEvent(id, "battle_cancelled", { reason: "creator_left" });

      return NextResponse.json({ left: true, cancelled: true });
    }

    // Regular player leaves — refund and remove
    battle.players.splice(playerIndex, 1);

    await User.updateOne(
      { _id: session.user.id },
      { $inc: { coins: battle.entryFee } },
    );
    await CoinTransaction.create({
      userId: session.user.id,
      amount: battle.entryFee,
      type: "battle_refund",
      reason: "Left battle",
      relatedBattleId: battle._id,
    });

    await battle.save();

    await publishBattleEvent(id, "player_left", {
      player: session.user.id,
      playerCount: battle.players.length,
    });

    return NextResponse.json({ left: true, cancelled: false });
  } catch (err) {
    console.error("[battles/[id]/leave] POST error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
