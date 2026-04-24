import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Battle from "@/models/battle";
import { withBattleLock } from "@/lib/battle-events";
import { removeBattleJob } from "@/lib/battle-jobs";
import { startFirstRound } from "@/lib/battle-flow";

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

    return await withBattleLock(id, "start", async () => {
      const battle = await Battle.findById(id);
      if (!battle) {
        return NextResponse.json({ error: "battle_not_found" }, { status: 404 });
      }

      if (battle.status !== "countdown") {
        return NextResponse.json({ error: "cannot_start" }, { status: 400 });
      }

      if (battle.creator.toString() !== session.user!.id) {
        return NextResponse.json({ error: "only_creator_can_start" }, { status: 403 });
      }

      if (battle.players.length < battle.settings.playerCount) {
        return NextResponse.json({ error: "not_enough_players" }, { status: 400 });
      }

      // Cancel auto-start job since creator started manually
      await removeBattleJob("auto-start", id);

      // startFirstRound persists battle state before publishing events.
      await startFirstRound(battle, id);

      return NextResponse.json({ started: true, status: battle.status });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "server_error";
    if (message === "Operation in progress, please try again") {
      return NextResponse.json({ error: message }, { status: 429 });
    }
    console.error("[battles/[id]/start] POST error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
