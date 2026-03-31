import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import Battle from "@/models/battle";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const seasonId = searchParams.get("season");
    const sort = searchParams.get("sort") || "elo";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    if (seasonId) {
      // Season-specific leaderboard from battle results
      return await getSeasonLeaderboard(seasonId, sort, limit, offset);
    }

    // Global leaderboard from user stats
    const sortField = getSortField(sort);

    const users = await User.find({ "battleStats.totalBattles": { $gt: 0 } })
      .select("username elo battleStats")
      .sort({ [sortField]: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    const total = await User.countDocuments({ "battleStats.totalBattles": { $gt: 0 } });

    const leaderboard = users.map((u, i) => ({
      rank: offset + i + 1,
      userId: u._id,
      username: u.username,
      elo: u.elo,
      wins: u.battleStats?.wins ?? 0,
      losses: u.battleStats?.losses ?? 0,
      winRate: u.battleStats?.totalBattles
        ? Math.round(((u.battleStats?.wins ?? 0) / u.battleStats.totalBattles) * 100)
        : 0,
      streak: u.battleStats?.streak ?? 0,
      bestStreak: u.battleStats?.bestStreak ?? 0,
      totalBattles: u.battleStats?.totalBattles ?? 0,
    }));

    return NextResponse.json({ leaderboard, total, sort });
  } catch (err) {
    console.error("[leaderboard] GET error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

async function getSeasonLeaderboard(
  seasonId: string,
  sort: string,
  limit: number,
  offset: number,
) {
  // Aggregate from battles in this season
  const pipeline = [
    { $match: { seasonId: { $toObjectId: seasonId }, status: "finished" } },
    { $unwind: "$players" as const },
    {
      $group: {
        _id: "$players.user",
        totalBattles: { $sum: 1 },
        wins: {
          $sum: {
            $cond: [{ $eq: ["$result.winner", "$players.user"] }, 1, 0],
          },
        },
        totalRoundsWon: { $sum: "$players.roundsWon" },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
        pipeline: [{ $project: { username: 1, elo: 1, battleStats: 1 } }],
      },
    },
    { $unwind: "$user" as const },
    {
      $project: {
        userId: "$_id",
        username: "$user.username",
        elo: "$user.elo",
        wins: 1,
        losses: { $subtract: ["$totalBattles", "$wins"] },
        totalBattles: 1,
        winRate: {
          $cond: [
            { $gt: ["$totalBattles", 0] },
            { $round: [{ $multiply: [{ $divide: ["$wins", "$totalBattles"] }, 100] }, 0] },
            0,
          ],
        },
        streak: "$user.battleStats.streak",
        bestStreak: "$user.battleStats.bestStreak",
      },
    },
    { $sort: { [getSortField(sort).replace("battleStats.", "")]: -1 as const } },
    { $skip: offset },
    { $limit: limit },
  ];

  const results = await Battle.aggregate(pipeline);

  const leaderboard = results.map((r, i) => ({
    rank: offset + i + 1,
    ...r,
  }));

  return NextResponse.json({ leaderboard, sort, seasonId });
}

function getSortField(sort: string): string {
  switch (sort) {
    case "wins":
      return "battleStats.wins";
    case "winrate":
      return "battleStats.wins"; // Will be sorted by wins as proxy
    case "streak":
      return "battleStats.streak";
    default:
      return "elo";
  }
}
