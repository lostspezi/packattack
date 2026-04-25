import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import UpvoteCampaign from "@/models/upvote-campaign";
import UpvoteVote from "@/models/upvote-vote";
import {
  patchActiveCampaignSchema,
  patchCampaignSchema,
} from "@/lib/admin/upvote-campaign-payload";
import { buildItemSnapshots, gateAdmin } from "@/lib/admin/upvote-campaign-helpers";
import { autoCloseIfExpired } from "@/lib/votes/auto-close";

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
    let campaign = await UpvoteCampaign.findById(id);
    if (!campaign) return NextResponse.json({ error: "not_found" }, { status: 404 });

    campaign = await autoCloseIfExpired(campaign);

    return NextResponse.json({ campaign: serialize(campaign) });
  } catch (err) {
    console.error("[admin/upvote-campaigns/:id GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const gate = gateAdmin(session);
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: gate.status });

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

  try {
    await connectDB();
    const campaign = await UpvoteCampaign.findById(id);
    if (!campaign) return NextResponse.json({ error: "not_found" }, { status: 404 });

    if (campaign.status === "closed") {
      return NextResponse.json({ error: "campaign_closed" }, { status: 409 });
    }

    if (campaign.status === "active") {
      const parsed = patchActiveCampaignSchema.safeParse(json);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "invalid_payload", issues: parsed.error.issues },
          { status: 400 }
        );
      }
      if (parsed.data.description !== undefined) campaign.description = parsed.data.description;
      if (parsed.data.question !== undefined) campaign.question = parsed.data.question;
      if (parsed.data.endsAt !== undefined) {
        campaign.endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : null;
      }
      await campaign.save();
      return NextResponse.json({ campaign: serialize(campaign) });
    }

    const parsed = patchCampaignSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_payload", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    if (parsed.data.title !== undefined) campaign.title = parsed.data.title;
    if (parsed.data.description !== undefined) campaign.description = parsed.data.description;
    if (parsed.data.question !== undefined) campaign.question = parsed.data.question;
    if (parsed.data.topN !== undefined) campaign.topN = parsed.data.topN;
    if (parsed.data.endsAt !== undefined) {
      campaign.endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : null;
    }
    if (parsed.data.items !== undefined) {
      const snapshots = await buildItemSnapshots(parsed.data.items);
      campaign.items.splice(0, campaign.items.length, ...snapshots);
    }

    if (campaign.topN > campaign.items.length) {
      return NextResponse.json(
        { error: "topN_exceeds_items" },
        { status: 400 }
      );
    }

    await campaign.save();
    return NextResponse.json({ campaign: serialize(campaign) });
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.startsWith("unknown_internal_card:") || err.message.startsWith("unknown_box:"))
    ) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[admin/upvote-campaigns/:id PATCH]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(
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
    const campaign = await UpvoteCampaign.findById(id);
    if (!campaign) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (campaign.status !== "draft") {
      return NextResponse.json({ error: "delete_not_draft" }, { status: 409 });
    }
    await UpvoteVote.deleteMany({ campaignId: campaign._id });
    await campaign.deleteOne();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/upvote-campaigns/:id DELETE]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

function serialize(c: InstanceType<typeof UpvoteCampaign>) {
  return {
    _id: c._id.toString(),
    title: c.title,
    description: c.description,
    question: c.question,
    status: c.status,
    topN: c.topN,
    items: c.items.map((item) => ({
      _id: item._id.toString(),
      kind: item.kind,
      label: item.label,
      description: item.description,
      image: item.image,
      position: item.position,
      source: item.source,
      internalCardId: item.internalCardId ? item.internalCardId.toString() : null,
      justTcgId: item.justTcgId,
      game: item.game,
      set: item.set,
      setName: item.setName,
      rarity: item.rarity,
      tcgplayerId: item.tcgplayerId,
      boxId: item.boxId ? item.boxId.toString() : null,
      boxSlug: item.boxSlug,
    })),
    endsAt: c.endsAt,
    closedAt: c.closedAt,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}
