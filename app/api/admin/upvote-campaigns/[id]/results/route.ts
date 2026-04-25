import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import UpvoteCampaign from "@/models/upvote-campaign";
import UpvoteVote from "@/models/upvote-vote";
import User from "@/models/user";
import { gateAdmin } from "@/lib/admin/upvote-campaign-helpers";
import {
  aggregateVotes,
  countUniqueVoters,
  rankAggregatedVotes,
} from "@/lib/votes/aggregate";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const gate = gateAdmin(session);
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: gate.status });

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  try {
    await connectDB();
    const campaign = await UpvoteCampaign.findById(id).lean();
    if (!campaign) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const itemIds = (campaign.items ?? []).map((c) => c._id.toString());
    const positions = new Map(
      (campaign.items ?? []).map((c) => [c._id.toString(), c.position])
    );

    const votes = await UpvoteVote.find({ campaignId: campaign._id })
      .select("userId itemRefId createdAt")
      .lean();

    const flat = votes.map((v) => ({
      userId: v.userId.toString(),
      itemRefId: v.itemRefId.toString(),
    }));

    const aggregated = aggregateVotes(flat, itemIds);
    const ranked = rankAggregatedVotes(aggregated, positions);
    const totalVoters = countUniqueVoters(flat);

    const userIds = [...new Set(votes.map((v) => v.userId.toString()))].map(
      (s) => new Types.ObjectId(s)
    );
    const users = userIds.length
      ? await User.find({ _id: { $in: userIds } })
          .select("_id name username")
          .lean()
      : [];
    const userMap = new Map(
      users.map((u) => [u._id.toString(), { name: u.name, username: u.username }])
    );

    const votersByItem = new Map<
      string,
      { userId: string; name: string; username: string; votedAt: Date }[]
    >();
    for (const v of votes) {
      const key = v.itemRefId.toString();
      const list = votersByItem.get(key) ?? [];
      const u = userMap.get(v.userId.toString());
      list.push({
        userId: v.userId.toString(),
        name: u?.name ?? "?",
        username: u?.username ?? "?",
        votedAt: v.createdAt,
      });
      votersByItem.set(key, list);
    }

    return NextResponse.json({
      totalVoters,
      perItem: ranked.map((r) => {
        const item = campaign.items.find((c) => c._id.toString() === r.itemRefId);
        return {
          itemRefId: r.itemRefId,
          voteCount: r.voteCount,
          item: item
            ? {
                kind: item.kind,
                label: item.label,
                image: item.image,
                rarity: item.rarity,
                game: item.game,
                set: item.set,
                setName: item.setName,
                source: item.source,
                boxSlug: item.boxSlug,
              }
            : null,
          voters: votersByItem.get(r.itemRefId) ?? [],
        };
      }),
    });
  } catch (err) {
    console.error("[admin/upvote-campaigns/:id/results]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
