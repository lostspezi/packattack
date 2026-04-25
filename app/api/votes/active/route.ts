import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import UpvoteCampaign from "@/models/upvote-campaign";
import UpvoteVote from "@/models/upvote-vote";
import { autoCloseExpiredBulk } from "@/lib/votes/auto-close";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    await connectDB();
    await autoCloseExpiredBulk();

    const campaigns = await UpvoteCampaign.find({ status: "active" })
      .select("_id title question topN endsAt")
      .sort({ endsAt: 1, createdAt: -1 })
      .lean();

    if (campaigns.length === 0) {
      return NextResponse.json({ campaigns: [] });
    }

    const userOid = new Types.ObjectId(userId);
    const counts = await UpvoteVote.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { campaignId: { $in: campaigns.map((c) => c._id) }, userId: userOid } },
      { $group: { _id: "$campaignId", count: { $sum: 1 } } },
    ]);
    const countByCampaign = new Map(counts.map((c) => [c._id.toString(), c.count]));

    return NextResponse.json({
      campaigns: campaigns.map((c) => {
        const myCount = countByCampaign.get(c._id.toString()) ?? 0;
        return {
          _id: c._id.toString(),
          title: c.title,
          question: c.question,
          topN: c.topN,
          endsAt: c.endsAt,
          myVoteCount: myCount,
          alreadyVoted: myCount > 0,
        };
      }),
    });
  } catch (err) {
    console.error("[api/votes/active GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
