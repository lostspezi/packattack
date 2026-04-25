import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import UpvoteCampaign from "@/models/upvote-campaign";
import UpvoteVote from "@/models/upvote-vote";
import { autoCloseIfExpired } from "@/lib/votes/auto-close";
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
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  try {
    await connectDB();
    let campaign = await UpvoteCampaign.findById(id);
    if (!campaign) return NextResponse.json({ error: "not_found" }, { status: 404 });
    campaign = await autoCloseIfExpired(campaign);

    if (campaign.status === "draft") {
      return NextResponse.json({ error: "not_available" }, { status: 410 });
    }

    const myVotes = await UpvoteVote.find({
      campaignId: campaign._id,
      userId: new Types.ObjectId(userId),
    })
      .select("cardRefId")
      .lean();
    const myCardRefIds = myVotes.map((v) => v.cardRefId.toString());

    let aggregate: Array<{ cardRefId: string; voteCount: number }> | undefined;
    let totalVoters: number | undefined;
    if (campaign.status === "closed") {
      const votes = await UpvoteVote.find({ campaignId: campaign._id })
        .select("userId cardRefId")
        .lean();
      const flat = votes.map((v) => ({
        userId: v.userId.toString(),
        cardRefId: v.cardRefId.toString(),
      }));
      const cardIds = campaign.cards.map((c) => c._id.toString());
      const positions = new Map(campaign.cards.map((c) => [c._id.toString(), c.position]));
      aggregate = rankAggregatedVotes(aggregateVotes(flat, cardIds), positions);
      totalVoters = countUniqueVoters(flat);
    }

    return NextResponse.json({
      campaign: {
        _id: campaign._id.toString(),
        title: campaign.title,
        description: campaign.description,
        question: campaign.question,
        status: campaign.status,
        topN: campaign.topN,
        endsAt: campaign.endsAt,
        closedAt: campaign.closedAt,
        cards: campaign.cards.map((c) => ({
          _id: c._id.toString(),
          source: c.source,
          name: c.name,
          game: c.game,
          set: c.set,
          setName: c.setName,
          rarity: c.rarity,
          image: c.image,
          tcgplayerId: c.tcgplayerId,
          position: c.position,
        })),
      },
      myVotes: myCardRefIds,
      aggregate,
      totalVoters,
    });
  } catch (err) {
    console.error("[api/votes/:id GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
