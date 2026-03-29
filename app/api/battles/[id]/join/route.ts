import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Battle from "@/models/battle";
import BattlePull from "@/models/battle-pull";
import User from "@/models/user";
import CoinTransaction from "@/models/coin-transaction";
import { getRedis } from "@/lib/redis";
import { startReadyCheck } from "@/lib/battle-orchestrator";
import { ELO_DEFAULT } from "@/lib/battle-constants";

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

  // Distributed Redis lock
  const redis = getRedis();
  const lockKey = `battle-join:${id}`;
  let lockAcquired = false;

  try {
    await connectDB();

    const lockResult = await redis.set(lockKey, "1", "EX", 10, "NX");
    if (!lockResult) {
      return NextResponse.json(
        { error: "too_many_requests", message: "Another join is in progress. Try again." },
        { status: 429 }
      );
    }
    lockAcquired = true;

    // Check no active battle
    const activeBattle = await Battle.findOne({
      "players.user": userId,
      status: { $in: ["waiting", "ready_check", "countdown", "opening", "clash"] },
    }).lean();
    if (activeBattle) {
      return NextResponse.json(
        { error: "active_battle", message: "You already have an active battle." },
        { status: 409 }
      );
    }

    // Check no undecided battle pulls
    const undecidedPull = await BattlePull.findOne({
      distributedTo: userId,
      status: "distributed",
    }).lean();
    if (undecidedPull) {
      return NextResponse.json(
        { error: "undecided_pulls", message: "You have undecided battle pulls." },
        { status: 409 }
      );
    }

    // Find waiting battle
    const isObjectId = /^[a-f\d]{24}$/i.test(id);
    const battle = await Battle.findOne({
      $or: isObjectId ? [{ _id: id }, { slug: id }] : [{ slug: id }],
      status: "waiting",
    });

    if (!battle) {
      return NextResponse.json({ error: "Battle not found or not available" }, { status: 404 });
    }

    // Check not already joined
    const alreadyJoined = battle.players.some(
      (p) => p.user.toString() === userId
    );
    if (alreadyJoined) {
      return NextResponse.json({ error: "Already in this battle" }, { status: 409 });
    }

    // Check not full
    if (battle.players.length >= battle.maxPlayers) {
      return NextResponse.json({ error: "Battle is full" }, { status: 409 });
    }

    // Check eloRange for public battles
    if (battle.visibility === "public" && battle.eloRange) {
      const userDoc = await User.findById(userId).select("elo").lean();
      const userElo = userDoc?.elo ?? ELO_DEFAULT;
      if (userElo < battle.eloRange.min || userElo > battle.eloRange.max) {
        return NextResponse.json(
          { error: "elo_out_of_range", message: `Elo must be between ${battle.eloRange.min} and ${battle.eloRange.max}` },
          { status: 403 }
        );
      }
    }

    // Cost matches creator's reserved coins
    const cost = battle.players[0].coinsReserved;

    // Atomic coin deduction
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, coins: { $gte: cost } },
      { $inc: { coins: -cost } },
      { returnDocument: "after" }
    );
    if (!updatedUser) {
      return NextResponse.json({ error: "Insufficient coins" }, { status: 400 });
    }

    const userElo = updatedUser.elo ?? 1000;

    // Add player with guard against race condition
    const slotIndex = battle.maxPlayers - 1;
    const updatedBattle = await Battle.findOneAndUpdate(
      {
        _id: battle._id,
        status: "waiting",
        [`players.${slotIndex}`]: { $exists: false },
      },
      {
        $push: {
          players: {
            user: userId,
            coinsReserved: cost,
            eloAtStart: userElo,
            score: 0,
            placement: null,
            eloChange: null,
          },
        },
      },
      { returnDocument: "after" }
    );

    if (!updatedBattle) {
      // Race condition — refund coins
      await User.updateOne({ _id: userId }, { $inc: { coins: cost } });
      return NextResponse.json(
        { error: "Battle is full or no longer available" },
        { status: 409 }
      );
    }

    // Record coin transaction
    await CoinTransaction.create({
      userId,
      amount: -cost,
      type: "battle_entry",
      relatedBattleId: battle._id,
    });

    // Publish player_joined SSE event with full player data
    const joinedUser = await User.findById(userId)
      .select("name username image elo")
      .lean();

    void publishEvent(battle._id.toString(), {
      type: "player_joined",
      player: {
        user: {
          _id: userId,
          name: joinedUser?.name ?? "Unknown",
          username: joinedUser?.username ?? null,
          image: joinedUser?.image ?? null,
          elo: joinedUser?.elo ?? 1000,
        },
        score: 0,
        placement: null,
        eloChange: null,
        eloAtStart: userElo,
      },
      playerCount: updatedBattle.players.length,
    });

    // If battle is now full, start ready check
    if (updatedBattle.players.length >= updatedBattle.maxPlayers) {
      startReadyCheck(updatedBattle._id.toString()).catch(console.error);
    }

    return NextResponse.json({
      joined: true,
      playerCount: updatedBattle.players.length,
    });
  } catch (err) {
    console.error("[battles/[id]/join POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  } finally {
    if (lockAcquired) {
      await redis.del(lockKey).catch(() => {});
    }
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
