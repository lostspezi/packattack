import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import { leaderboardSchema } from "@/lib/validations/battle";

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = leaderboardSchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { category, page, limit } = parsed.data;

  let sortField: string;
  switch (category) {
    case "wins":
      sortField = "battleStats.wins";
      break;
    case "streak":
      sortField = "battleStats.bestStreak";
      break;
    case "elo":
    case "pull_value":
    default:
      sortField = "elo";
  }

  const filter: Record<string, unknown> = {
    "battleStats.totalBattles": { $gte: 1 },
  };

  try {
    await connectDB();

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ [sortField]: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("name username image elo battleStats badges")
        .lean(),
      User.countDocuments(filter),
    ]);

    // Find current user's rank by counting users who score strictly higher
    const currentUser = await User.findById(userId)
      .select("elo battleStats")
      .lean();

    let myRank = total + 1; // default to last if not found / no battles
    if (currentUser) {
      // Resolve nested field value (e.g. "battleStats.wins")
      const myValue: number = sortField.split(".").reduce<unknown>(
        (obj, key) => (obj != null && typeof obj === "object" ? (obj as Record<string, unknown>)[key] : undefined),
        currentUser as unknown
      ) as number ?? 0;

      const aboveMe = await User.countDocuments({
        ...filter,
        [sortField]: { $gt: myValue },
      });

      myRank = aboveMe + 1;
    }

    return NextResponse.json({
      leaderboard: users.map((u, i) => ({
        rank: (page - 1) * limit + i + 1,
        user: u,
      })),
      total,
      page,
      limit,
      myRank,
    });
  } catch (err) {
    console.error("[battles/leaderboard GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
