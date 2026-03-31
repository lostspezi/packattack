import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Battle from "@/models/battle";
import User from "@/models/user";
import CoinTransaction from "@/models/coin-transaction";
import { publishBattleEvent, withBattleLock } from "@/lib/battle-events";

const READY_CHECK_DURATION_MS = 30 * 1000; // 30 seconds

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

    return await withBattleLock(id, "join", async () => {
      const battle = await Battle.findById(id);
      if (!battle) {
        return NextResponse.json({ error: "battle_not_found" }, { status: 404 });
      }

      // Validate join conditions
      if (battle.status !== "waiting") {
        return NextResponse.json({ error: "battle_not_joinable" }, { status: 400 });
      }

      if (new Date() > battle.lobbyExpiresAt) {
        return NextResponse.json({ error: "lobby_expired" }, { status: 400 });
      }

      if (battle.players.length >= battle.settings.playerCount) {
        return NextResponse.json({ error: "battle_full" }, { status: 400 });
      }

      if (battle.players.some((p) => p.user.toString() === session.user!.id)) {
        return NextResponse.json({ error: "already_joined" }, { status: 400 });
      }

      // Check user is not in another active battle
      const activeBattle = await Battle.findOne({
        _id: { $ne: battle._id },
        "players.user": session.user!.id,
        status: { $in: ["waiting", "ready_check", "countdown", "active", "sudden_death"] },
      }).lean();

      if (activeBattle) {
        return NextResponse.json({ error: "already_in_battle" }, { status: 409 });
      }

      // Reserve coins
      const user = await User.findOneAndUpdate(
        { _id: session.user!.id, coins: { $gte: battle.entryFee } },
        { $inc: { coins: -battle.entryFee } },
        { new: true },
      );

      if (!user) {
        return NextResponse.json({ error: "insufficient_coins" }, { status: 400 });
      }

      await CoinTransaction.create({
        userId: session.user!.id,
        amount: -battle.entryFee,
        type: "battle_entry",
        reason: `Battle entry fee`,
        relatedBattleId: battle._id,
      });

      // Add player
      battle.players.push({
        user: user._id,
        joinedAt: new Date(),
        isReady: false,
        readyAt: null,
        roundsWon: 0,
      });

      // Check if battle is now full → ready check
      if (battle.players.length === battle.settings.playerCount) {
        battle.status = "ready_check";
        battle.readyCheckExpiresAt = new Date(Date.now() + READY_CHECK_DURATION_MS);
      }

      await battle.save();

      // Publish events
      await publishBattleEvent(id, "player_joined", {
        player: { id: session.user!.id, username: user.username },
        playerCount: battle.players.length,
      });

      if (battle.status === "ready_check") {
        await publishBattleEvent(id, "ready_check", {
          expiresAt: battle.readyCheckExpiresAt?.toISOString(),
        });
      }

      return NextResponse.json({
        joined: true,
        newBalance: user.coins,
        status: battle.status,
      });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "server_error";
    if (message === "Operation in progress, please try again") {
      return NextResponse.json({ error: message }, { status: 429 });
    }
    console.error("[battles/[id]/join] POST error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
