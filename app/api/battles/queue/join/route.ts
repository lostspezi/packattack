import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import BattleQueue from "@/models/battle-queue";
import Battle from "@/models/battle";
import User from "@/models/user";
import Box from "@/models/box";
import { ELO_DEFAULT } from "@/lib/battle-constants";
import { processMatchmakingQueue } from "@/lib/battle-matchmaker";

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { boxId, playerCount } = await req.json();

    if (!boxId || ![2, 3, 4].includes(playerCount)) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    await connectDB();

    const box = await Box.findById(boxId).select("_id").lean();
    if (!box) {
      return NextResponse.json({ error: "box_not_found" }, { status: 404 });
    }

    const existingQueue = await BattleQueue.findOne({
      user: userId,
      status: "waiting",
    }).lean();
    if (existingQueue) {
      return NextResponse.json({ error: "already_in_queue" }, { status: 409 });
    }

    const activeBattle = await Battle.findOne({
      "players.user": userId,
      status: { $in: ["waiting", "ready_check", "countdown", "opening", "clash"] },
    }).lean();
    if (activeBattle) {
      return NextResponse.json({ error: "already_in_battle" }, { status: 409 });
    }

    const user = await User.findById(userId).select("elo").lean();
    const elo = user?.elo ?? ELO_DEFAULT;

    const entry = await BattleQueue.create({
      user: userId,
      box: boxId,
      playerCount,
      elo,
    });

    await processMatchmakingQueue();

    const updated = await BattleQueue.findById(entry._id).lean();

    return NextResponse.json({
      queued: true,
      queueId: entry._id.toString(),
      matched: updated?.status === "matched",
    });
  } catch (err) {
    console.error("[queue/join POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
