import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import UpvoteCampaign from "@/models/upvote-campaign";
import UpvoteVote from "@/models/upvote-vote";
import { autoCloseIfExpired } from "@/lib/votes/auto-close";
import { validateVotePayload } from "@/lib/votes/eligibility";

const bodySchema = z.object({
  cardRefIds: z.array(z.string().regex(/^[a-f0-9]{24}$/i)).max(10),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    let campaign = await UpvoteCampaign.findById(id);
    if (!campaign) return NextResponse.json({ error: "not_found" }, { status: 404 });
    campaign = await autoCloseIfExpired(campaign);

    const validation = validateVotePayload({
      cardRefIds: parsed.data.cardRefIds,
      campaign: {
        status: campaign.status,
        topN: campaign.topN,
        endsAt: campaign.endsAt,
        cards: campaign.cards.map((c) => ({ _id: c._id })),
      },
    });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 409 });
    }

    const userOid = new Types.ObjectId(userId);
    const campaignOid = campaign._id;
    const desiredOids = parsed.data.cardRefIds.map((s) => new Types.ObjectId(s));

    await UpvoteVote.bulkWrite(
      [
        { deleteMany: { filter: { campaignId: campaignOid, userId: userOid } } },
        ...desiredOids.map((cardRefId) => ({
          insertOne: {
            document: { campaignId: campaignOid, userId: userOid, cardRefId },
          },
        })),
      ],
      { ordered: true }
    );

    return NextResponse.json({ ok: true, count: desiredOids.length });
  } catch (err) {
    console.error("[api/votes/:id/votes PUT]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
