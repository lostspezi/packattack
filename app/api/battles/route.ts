import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Battle from "@/models/battle";
import Box from "@/models/box";
import User from "@/models/user";
import CoinTransaction from "@/models/coin-transaction";
import Season from "@/models/season";
import { scheduleBattleJob } from "@/lib/battle-jobs";


const VALID_PLAYER_COUNTS = [2, 3, 4] as const;
const VALID_ROUNDS = [3, 5, 7] as const;
const VALID_MODES = ["lowest_card", "highest_card", "all_cards", "snake_draft"] as const;
const LOBBY_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// ---------- GET: List battles (lobby) ----------

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "waiting";

    const query: Record<string, unknown> = {};

    if (status === "mine") {
      // User's active battles
      query["players.user"] = session.user.id;
      query.status = { $in: ["waiting", "ready_check", "countdown", "active", "sudden_death"] };
    } else {
      // Open battles in lobby
      query.status = status;
      query["settings.isPrivate"] = false;
      query.lobbyExpiresAt = { $gt: new Date() };
    }

    const battles = await Battle.find(query)
      .populate("box", "name slug game image battleFeePerRound")
      .populate("creator", "username")
      .populate("players.user", "username")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return NextResponse.json({ battles });
  } catch (err) {
    console.error("[battles] GET error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// ---------- POST: Create battle ----------

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const body = await req.json();
    const { boxId, playerCount, rounds, mode, isPrivate } = body;

    // Validate inputs
    if (!boxId) {
      return NextResponse.json({ error: "box_required" }, { status: 400 });
    }
    if (!VALID_PLAYER_COUNTS.includes(playerCount)) {
      return NextResponse.json({ error: "invalid_player_count" }, { status: 400 });
    }
    if (!VALID_ROUNDS.includes(rounds)) {
      return NextResponse.json({ error: "invalid_rounds" }, { status: 400 });
    }
    if (!VALID_MODES.includes(mode)) {
      return NextResponse.json({ error: "invalid_mode" }, { status: 400 });
    }

    // Check box exists and is published
    const box = await Box.findById(boxId).lean();
    if (!box || box.status !== "published") {
      return NextResponse.json({ error: "box_not_available" }, { status: 400 });
    }

    if (!box.battleFeePerRound || box.battleFeePerRound <= 0) {
      return NextResponse.json({ error: "box_not_battle_enabled" }, { status: 400 });
    }

    // Check user is not in an active battle
    const activeBattle = await Battle.findOne({
      "players.user": session.user.id,
      status: { $in: ["waiting", "ready_check", "countdown", "active", "sudden_death"] },
    }).lean();

    if (activeBattle) {
      return NextResponse.json({ error: "already_in_battle" }, { status: 409 });
    }

    // Calculate entry fee
    const entryFee = rounds * box.battleFeePerRound;

    // Reserve coins atomically
    const user = await User.findOneAndUpdate(
      { _id: session.user.id, coins: { $gte: entryFee } },
      { $inc: { coins: -entryFee, "battleStats.battlesCreated": 1 } },
      { new: true },
    );

    if (!user) {
      return NextResponse.json({ error: "insufficient_coins" }, { status: 400 });
    }

    // Record coin transaction
    await CoinTransaction.create({
      userId: session.user.id,
      amount: -entryFee,
      type: "battle_entry",
      reason: `Battle entry fee (${rounds} rounds × ${box.battleFeePerRound} coins)`,
      relatedBattleId: null, // Will be updated after battle creation
    });

    // Generate invite code for private battles
    const inviteCode = isPrivate
      ? Array.from({ length: 6 }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)]).join("")
      : null;

    // Find active season
    const activeSeason = await Season.findOne({ status: "active" }).lean();

    // Create battle
    const battle = await Battle.create({
      creator: session.user.id,
      box: boxId,
      players: [
        {
          user: session.user.id,
          joinedAt: new Date(),
          isReady: false,
          readyAt: null,
          roundsWon: 0,
        },
      ],
      settings: {
        playerCount,
        rounds,
        mode,
        isPrivate: !!isPrivate,
        inviteCode,
      },
      entryFee,
      status: "waiting",
      currentRound: 0,
      lobbyExpiresAt: new Date(Date.now() + LOBBY_DURATION_MS),
      seasonId: activeSeason?._id ?? null,
    });

    // Update coin transaction with battle ID
    await CoinTransaction.updateOne(
      { userId: session.user.id, type: "battle_entry", relatedBattleId: null },
      { $set: { relatedBattleId: battle._id } },
    );

    // Schedule auto-cancel when lobby expires
    await scheduleBattleJob("auto-cancel", { battleId: battle._id.toString() }, LOBBY_DURATION_MS + 5000);

    return NextResponse.json({
      battle: {
        _id: battle._id,
        slug: battle.slug,
        entryFee,
        inviteCode,
        newBalance: user.coins,
      },
    }, { status: 201 });
  } catch (err) {
    console.error("[battles] POST error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
