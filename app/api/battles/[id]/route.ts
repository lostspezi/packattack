import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Battle from "@/models/battle";
import BattlePull from "@/models/battle-pull";

export async function GET(
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

    const isObjectId = /^[a-f\d]{24}$/i.test(id);
    const battle = await Battle.findOne({
      $or: isObjectId ? [{ _id: id }, { slug: id }] : [{ slug: id }],
    })
      .populate("box", "name slug image priceInCoins cardsPerPack")
      .populate("players.user", "name username image elo")
      .lean();

    if (!battle) {
      return NextResponse.json({ error: "Battle not found" }, { status: 404 });
    }

    // Determine if current user is a player
    const isPlayer = battle.players.some(
      (p) => p.user._id?.toString() === userId || p.user.toString() === userId
    );

    let myCards = null;
    if (battle.status === "finished" && isPlayer) {
      myCards = await BattlePull.find({
        battle: battle._id,
        distributedTo: userId,
      })
        .populate("card", "name image")
        .lean();
    }

    return NextResponse.json({ battle, isPlayer, myCards });
  } catch (err) {
    console.error("[battles/[id] GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
