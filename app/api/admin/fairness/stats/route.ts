import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import FairnessSeed from "@/models/fairness-seed";
import PackOpenCommitment from "@/models/pack-open-commitment";

function isAdminRole(role?: string | null) {
  return role === "admin" || role === "super_admin";
}

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? null;
  if (!session?.user || !isAdminRole(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectDB();

    const now = new Date();
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [activeSeeds, revealedSeeds, commits7, commits30, commitTotal, topUsers] =
      await Promise.all([
        FairnessSeed.countDocuments({ status: "active" }),
        FairnessSeed.countDocuments({ status: "revealed" }),
        PackOpenCommitment.countDocuments({ createdAt: { $gte: d7 } }),
        PackOpenCommitment.countDocuments({ createdAt: { $gte: d30 } }),
        PackOpenCommitment.countDocuments({}),
        PackOpenCommitment.aggregate([
          { $match: { createdAt: { $gte: d30 } } },
          {
            $group: {
              _id: "$userId",
              opens: { $sum: 1 },
              draws: { $sum: { $subtract: ["$nonceEnd", "$nonceStart"] } },
            },
          },
          { $sort: { opens: -1 } },
          { $limit: 10 },
          {
            $lookup: {
              from: "users",
              localField: "_id",
              foreignField: "_id",
              as: "user",
            },
          },
          { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 0,
              userId: { $toString: "$_id" },
              username: "$user.username",
              email: "$user.email",
              opens: 1,
              draws: 1,
            },
          },
        ]),
      ]);

    return NextResponse.json({
      seeds: { active: activeSeeds, revealed: revealedSeeds },
      commitments: { last7d: commits7, last30d: commits30, total: commitTotal },
      topUsers30d: topUsers,
    });
  } catch (err) {
    console.error("[admin/fairness/stats GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
