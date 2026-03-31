import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Battle from "@/models/battle";
import { publishBattleEvent } from "@/lib/battle-events";

const COUNTDOWN_DURATION_MS = 3 * 60 * 1000; // 3 minutes

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

    if (battle.status !== "ready_check") {
      return NextResponse.json({ error: "not_in_ready_check" }, { status: 400 });
    }

    // Find the player
    const player = battle.players.find((p) => p.user.toString() === session.user!.id);
    if (!player) {
      return NextResponse.json({ error: "not_in_battle" }, { status: 403 });
    }

    if (player.isReady) {
      return NextResponse.json({ error: "already_ready" }, { status: 400 });
    }

    // Mark as ready
    player.isReady = true;
    player.readyAt = new Date();

    // Check if all players are ready
    const allReady = battle.players.every((p) => p.isReady);

    if (allReady) {
      battle.status = "countdown";
      battle.startCountdownAt = new Date(Date.now() + COUNTDOWN_DURATION_MS);
    }

    await battle.save();

    await publishBattleEvent(id, "player_ready", {
      player: session.user.id,
    });

    if (allReady) {
      await publishBattleEvent(id, "battle_start", {
        countdownEndsAt: battle.startCountdownAt?.toISOString(),
        isCountdown: true,
      });
    }

    return NextResponse.json({ ready: true, allReady, status: battle.status });
  } catch (err) {
    console.error("[battles/[id]/ready] POST error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
