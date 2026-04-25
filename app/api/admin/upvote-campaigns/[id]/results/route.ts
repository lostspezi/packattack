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

    const cardIds = (campaign.cards ?? []).map((c) => c._id.toString());
    const positions = new Map(
      (campaign.cards ?? []).map((c) => [c._id.toString(), c.position])
    );

    const votes = await UpvoteVote.find({ campaignId: campaign._id })
      .select("userId cardRefId createdAt")
      .lean();

    const flat = votes.map((v) => ({
      userId: v.userId.toString(),
      cardRefId: v.cardRefId.toString(),
    }));

    const aggregated = aggregateVotes(flat, cardIds);
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

    const votersByCard = new Map<string, { userId: string; name: string; username: string; votedAt: Date }[]>();
    for (const v of votes) {
      const key = v.cardRefId.toString();
      const list = votersByCard.get(key) ?? [];
      const u = userMap.get(v.userId.toString());
      list.push({
        userId: v.userId.toString(),
        name: u?.name ?? "?",
        username: u?.username ?? "?",
        votedAt: v.createdAt,
      });
      votersByCard.set(key, list);
    }

    return NextResponse.json({
      totalVoters,
      perCard: ranked.map((r) => {
        const card = campaign.cards.find((c) => c._id.toString() === r.cardRefId);
        return {
          cardRefId: r.cardRefId,
          voteCount: r.voteCount,
          card: card
            ? {
                name: card.name,
                image: card.image,
                rarity: card.rarity,
                game: card.game,
                set: card.set,
                setName: card.setName,
                source: card.source,
              }
            : null,
          voters: votersByCard.get(r.cardRefId) ?? [],
        };
      }),
    });
  } catch (err) {
    console.error("[admin/upvote-campaigns/:id/results]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
