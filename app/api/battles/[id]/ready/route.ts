import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Battle from "@/models/battle";
import { getRedis } from "@/lib/redis";
import { runBattle } from "@/lib/battle-orchestrator";

export async function POST(
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

    const battle = await Battle.findById(id);
    if (!battle) {
      return NextResponse.json({ error: "Battle not found" }, { status: 404 });
    }

    if (battle.status !== "ready_check") {
      return NextResponse.json(
        { error: "Battle is not in ready check phase" },
        { status: 400 }
      );
    }

    const playerIndex = battle.players.findIndex(
      (p) => p.user.toString() === userId
    );
    if (playerIndex === -1) {
      return NextResponse.json(
        { error: "You are not in this battle" },
        { status: 403 }
      );
    }

    if (battle.players[playerIndex].ready) {
      return NextResponse.json({ ready: true, alreadyReady: true });
    }

    // Set player as ready
    await Battle.updateOne(
      { _id: id },
      { $set: { [`players.${playerIndex}.ready`]: true } }
    );

    // Publish player_ready event
    const redis = getRedis();
    await redis.publish(
      `battle:${id}`,
      JSON.stringify({ type: "player_ready", userId })
    );

    // Check if all players are now ready
    const updatedBattle = await Battle.findById(id).lean();
    if (!updatedBattle) {
      return NextResponse.json({ error: "Battle not found" }, { status: 404 });
    }

    const allReady = updatedBattle.players.every((p) => p.ready);

    if (allReady) {
      // All players ready — start the battle
      runBattle(id).catch(console.error);
    }

    return NextResponse.json({ ready: true, allReady });
  } catch (err) {
    console.error("[battles/[id]/ready POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
