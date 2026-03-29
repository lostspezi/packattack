import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Battle from "@/models/battle";
import BattlePull from "@/models/battle-pull";
import Box from "@/models/box";
import User from "@/models/user";
import Season from "@/models/season";
import CoinTransaction from "@/models/coin-transaction";
import { createBattleSchema, battleListSchema } from "@/lib/validations/battle";
import { BATTLE_ELO_RANGE, ELO_DEFAULT } from "@/lib/battle-constants";

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createBattleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { boxId, packsPerPlayer, maxPlayers, visibility } = parsed.data;

  try {
    await connectDB();

    // Check no active battle
    const activeBattle = await Battle.findOne({
      "players.user": userId,
      status: { $in: ["waiting", "countdown", "opening", "clash"] },
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

    // Validate box
    const isObjectId = /^[a-f\d]{24}$/i.test(boxId);
    const box = isObjectId
      ? await Box.findById(boxId)
      : await Box.findOne({ slug: boxId });
    if (!box || box.status !== "published") {
      return NextResponse.json({ error: "Box not found or not published" }, { status: 404 });
    }

    const cost = box.priceInCoins * packsPerPlayer;

    // Atomic coin deduction
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, coins: { $gte: cost } },
      { $inc: { coins: -cost } },
      { returnDocument: "after" }
    );
    if (!updatedUser) {
      return NextResponse.json({ error: "Insufficient coins" }, { status: 400 });
    }

    // Get user elo for eloAtStart
    const creatorElo = updatedUser.elo ?? ELO_DEFAULT;
    const userElo = creatorElo;

    // Compute eloRange for public battles
    const eloRange = visibility === "public"
      ? { min: creatorElo - BATTLE_ELO_RANGE, max: creatorElo + BATTLE_ELO_RANGE }
      : null;

    // Find active season
    const season = await Season.findOne({ status: "active" }).lean();

    // Generate slug
    const slug = "clash-" + randomUUID().slice(0, 8);

    // Create battle
    const battle = await Battle.create({
      slug,
      createdBy: userId,
      box: box._id,
      packsPerPlayer,
      maxPlayers,
      visibility,
      eloRange,
      totalRounds: packsPerPlayer * box.cardsPerPack,
      seasonId: season?._id ?? null,
      players: [
        {
          user: userId,
          coinsReserved: cost,
          eloAtStart: userElo,
          score: 0,
          placement: null,
          eloChange: null,
        },
      ],
    });

    // Record coin transaction
    await CoinTransaction.create({
      userId,
      amount: -cost,
      type: "battle_entry",
      relatedBattleId: battle._id,
    });

    // Increment battleStats.battlesCreated
    await User.updateOne(
      { _id: userId },
      { $inc: { "battleStats.battlesCreated": 1 } }
    );

    return NextResponse.json(
      { battleId: battle._id.toString(), slug: battle.slug },
      { status: 201 }
    );
  } catch (err) {
    console.error("[battles POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = battleListSchema.safeParse({
    status: searchParams.get("status") ?? undefined,
    game: searchParams.get("game") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { status, page, limit } = parsed.data;

  try {
    await connectDB();

    const filter: Record<string, unknown> = { visibility: "public" };
    if (status) {
      filter.status = status;
    } else {
      filter.status = { $in: ["waiting", "ready_check", "countdown", "opening", "clash"] };
    }

    const skip = (page - 1) * limit;
    const [battles, total] = await Promise.all([
      Battle.find(filter)
        .populate("box", "name slug image priceInCoins cardsPerPack")
        .populate("players.user", "name username image elo")
        .populate("createdBy", "name username")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Battle.countDocuments(filter),
    ]);

    const userDoc = await User.findById(userId).select("elo").lean();
    const userElo = (userDoc as { elo?: number } | null)?.elo ?? ELO_DEFAULT;

    return NextResponse.json({ battles, total, page, limit, userElo });
  } catch (err) {
    console.error("[battles GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
