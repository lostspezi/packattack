import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import { getRank } from "@/lib/battle-elo";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const user = await User.findById(session.user.id)
      .select("username elo battleStats")
      .lean();

    if (!user) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }

    // Calculate rank position
    const playersAbove = await User.countDocuments({ elo: { $gt: user.elo } });
    const rank = playersAbove + 1;

    return NextResponse.json({
      rank,
      username: user.username,
      elo: user.elo,
      eloRank: getRank(user.elo),
      wins: user.battleStats?.wins ?? 0,
      losses: user.battleStats?.losses ?? 0,
      winRate: user.battleStats?.totalBattles
        ? Math.round(((user.battleStats?.wins ?? 0) / user.battleStats.totalBattles) * 100)
        : 0,
      streak: user.battleStats?.streak ?? 0,
      bestStreak: user.battleStats?.bestStreak ?? 0,
      totalBattles: user.battleStats?.totalBattles ?? 0,
    });
  } catch (err) {
    console.error("[leaderboard/me] GET error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
