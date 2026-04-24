import { Types } from "mongoose";
import connectDB from "@/lib/db";
import PackPull from "@/models/pack-pull";
import User from "@/models/user";

export interface DashboardStats {
  coins: number;
  pullsTotal: number;
  pullsThisWeek: number;
  collectionScore: number;
  battle: {
    wins: number;
    losses: number;
    streak: number;
    bestStreak: number;
    totalBattles: number;
    elo: number;
  };
}

const ZERO_BATTLE_STATS = {
  wins: 0,
  losses: 0,
  streak: 0,
  bestStreak: 0,
  totalBattles: 0,
  elo: 1000,
};

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  await connectDB();

  const userObjectId = new Types.ObjectId(userId);
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [user, pullsTotal, pullsThisWeek, scoreAgg] = await Promise.all([
    User.findById(userObjectId).select("coins elo battleStats").lean(),
    PackPull.countDocuments({ userId: userObjectId }),
    PackPull.countDocuments({
      userId: userObjectId,
      createdAt: { $gte: oneWeekAgo },
    }),
    PackPull.aggregate([
      {
        $match: {
          userId: userObjectId,
          status: { $in: ["claimed", "converted"] },
        },
      },
      { $group: { _id: null, total: { $sum: "$coinValue" } } },
    ]),
  ]);

  const collectionScore = (scoreAgg[0]?.total as number) ?? 0;
  const battleStats =
    (user?.battleStats as Partial<typeof ZERO_BATTLE_STATS>) ?? {};

  return {
    coins: user?.coins ?? 0,
    pullsTotal,
    pullsThisWeek,
    collectionScore,
    battle: {
      wins: battleStats.wins ?? ZERO_BATTLE_STATS.wins,
      losses: battleStats.losses ?? ZERO_BATTLE_STATS.losses,
      streak: battleStats.streak ?? ZERO_BATTLE_STATS.streak,
      bestStreak: battleStats.bestStreak ?? ZERO_BATTLE_STATS.bestStreak,
      totalBattles: battleStats.totalBattles ?? ZERO_BATTLE_STATS.totalBattles,
      elo: (user?.elo as number | undefined) ?? ZERO_BATTLE_STATS.elo,
    },
  };
}
