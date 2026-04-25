import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import UpvoteCampaign from "@/models/upvote-campaign";
import { gateAdmin } from "@/lib/admin/upvote-campaign-helpers";
import { canTransition } from "@/lib/votes/lifecycle";
import { notifyUpvoteCampaignActivated } from "@/lib/push/notify-upvote-campaign";

export async function POST(
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
    if (!canTransition(campaign.status, "active")) {
      return NextResponse.json({ error: "invalid_transition" }, { status: 409 });
    }
    if (campaign.cards.length < campaign.topN) {
      return NextResponse.json({ error: "not_enough_cards" }, { status: 409 });
    }
    if (campaign.endsAt && campaign.endsAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: "endsAt_in_past" }, { status: 409 });
    }

    campaign.status = "active";
    await campaign.save();

    // Fire-and-forget Notification + Push. Wenn die Push-Pipeline aus
    // irgendeinem Grund hängt, soll das Activate trotzdem erfolgreich
    // zurückkommen — der Status ist bereits persistent.
    notifyUpvoteCampaignActivated(campaign).catch((err) => {
      console.error("[activate] notify upvote campaign failed:", err);
    });

    return NextResponse.json({ ok: true, status: campaign.status });
  } catch (err) {
    console.error("[admin/upvote-campaigns/:id/activate]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
