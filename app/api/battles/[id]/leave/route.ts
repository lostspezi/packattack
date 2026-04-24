import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Battle from "@/models/battle";
import { BattleLockError, publishBattleEvent, withBattleLock } from "@/lib/battle-events";
import { removeBattleJob, scheduleBattleJob } from "@/lib/battle-jobs";

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

    return await withBattleLock(id, "leave", async () => {
      const battle = await Battle.findById(id);
      if (!battle) {
        return NextResponse.json({ error: "battle_not_found" }, { status: 404 });
      }

      // Can leave during pre-game phases
      if (!["waiting", "ready_check", "countdown"].includes(battle.status)) {
        return NextResponse.json({ error: "cannot_leave" }, { status: 400 });
      }

      const playerIndex = battle.players.findIndex(
        (p) => p.user.toString() === session.user!.id,
      );
      if (playerIndex === -1) {
        return NextResponse.json({ error: "not_in_battle" }, { status: 403 });
      }

      // If creator leaves, cancel the battle
      if (battle.creator.toString() === session.user!.id) {
        battle.status = "cancelled";

        await battle.save();

        // Clean up any pending timer jobs
        await removeBattleJob("auto-cancel", id);
        await removeBattleJob("auto-start", id);

        await publishBattleEvent(id, "battle_cancelled", { reason: "creator_left" });

        return NextResponse.json({ left: true, cancelled: true });
      }

      // Regular player leaves — remove
      const wasReadyCheckOrCountdown = ["ready_check", "countdown"].includes(battle.status);

      battle.players.splice(playerIndex, 1);

      // If a player leaves during ready_check or countdown, revert to waiting
      if (wasReadyCheckOrCountdown) {
        battle.status = "waiting";
        battle.readyCheckExpiresAt = null;
        battle.startCountdownAt = null;
        for (const p of battle.players) {
          p.isReady = false;
          p.readyAt = null;
        }

        // Cancel ready-check / countdown timers, restart lobby timer
        await removeBattleJob("auto-cancel", id);
        await removeBattleJob("auto-start", id);
        const remainingLobby = Math.max(0, battle.lobbyExpiresAt.getTime() - Date.now());
        if (remainingLobby > 0) {
          await scheduleBattleJob("auto-cancel", { battleId: id }, remainingLobby + 5000);
        } else {
          // Lobby already expired — give a fresh window (capped at 1 extension)
          const LOBBY_EXTENSION_MS = 3 * 60 * 1000;
          battle.lobbyExpiresAt = new Date(Date.now() + LOBBY_EXTENSION_MS);
          await scheduleBattleJob("auto-cancel", { battleId: id }, LOBBY_EXTENSION_MS + 5000);
        }
      }

      await battle.save();

      await publishBattleEvent(id, "player_left", {
        player: session.user!.id,
        playerCount: battle.players.length,
        status: battle.status,
      });

      return NextResponse.json({ left: true, cancelled: false });
    });
  } catch (err) {
    if (err instanceof BattleLockError) {
      return NextResponse.json(
        { error: "Operation in progress, please try again" },
        { status: 429 },
      );
    }
    console.error("[battles/[id]/leave] POST error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
