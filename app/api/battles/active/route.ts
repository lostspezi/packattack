import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Battle from "@/models/battle";
import BattlePull from "@/models/battle-pull";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    // Find active battle
    const battle = await Battle.findOne({
      "players.user": userId,
      status: { $in: ["waiting", "countdown", "opening", "clash"] },
    })
      .populate("box", "name slug image priceInCoins cardsPerPack")
      .populate("players.user", "name username image elo")
      .lean();

    if (!battle) {
      // Also check for undecided battle pulls even if no active battle
      const undecidedPull = await BattlePull.findOne({
        distributedTo: userId,
        status: "distributed",
      })
        .populate("battle")
        .lean();

      if (undecidedPull) {
        return NextResponse.json({
          active: true,
          battle: undecidedPull.battle,
          phase: "decide",
        });
      }

      return NextResponse.json({ active: false });
    }

    // Check for undecided pulls on the active battle
    const undecidedPull = await BattlePull.findOne({
      distributedTo: userId,
      status: "distributed",
    }).lean();

    if (undecidedPull) {
      return NextResponse.json({
        active: true,
        battle,
        phase: "decide",
      });
    }

    return NextResponse.json({ active: true, battle });
  } catch (err) {
    console.error("[battles/active GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
