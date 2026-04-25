import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import UpvoteCampaign from "@/models/upvote-campaign";
import { gateAdmin } from "@/lib/admin/upvote-campaign-helpers";
import { canTransition } from "@/lib/votes/lifecycle";

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
    if (!canTransition(campaign.status, "closed")) {
      return NextResponse.json({ error: "invalid_transition" }, { status: 409 });
    }

    campaign.status = "closed";
    campaign.closedAt = new Date();
    await campaign.save();
    return NextResponse.json({ ok: true, status: campaign.status });
  } catch (err) {
    console.error("[admin/upvote-campaigns/:id/close]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
