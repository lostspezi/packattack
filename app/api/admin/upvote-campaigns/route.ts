import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import UpvoteCampaign from "@/models/upvote-campaign";
import UpvoteVote from "@/models/upvote-vote";
import { createCampaignSchema } from "@/lib/admin/upvote-campaign-payload";
import { buildCardSnapshots, gateAdmin } from "@/lib/admin/upvote-campaign-helpers";
import { autoCloseExpiredBulk } from "@/lib/votes/auto-close";

export async function GET(req: NextRequest) {
  const session = await auth();
  const gate = gateAdmin(session);
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: gate.status });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const status = searchParams.get("status") ?? "";
  const search = (searchParams.get("search") ?? "").trim();

  const query: Record<string, unknown> = {};
  if (status === "draft" || status === "active" || status === "closed") query.status = status;
  if (search.length >= 2) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$or = [
      { "title.de": { $regex: escaped, $options: "i" } },
      { "title.en": { $regex: escaped, $options: "i" } },
    ];
  }

  try {
    await connectDB();
    await autoCloseExpiredBulk();

    const [campaigns, total] = await Promise.all([
      UpvoteCampaign.find(query)
        .select("_id title status topN cards endsAt closedAt createdAt")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      UpvoteCampaign.countDocuments(query),
    ]);

    const ids = campaigns.map((c) => c._id);
    const voteCounts = ids.length
      ? await UpvoteVote.aggregate<{ _id: Types.ObjectId; count: number }>([
          { $match: { campaignId: { $in: ids } } },
          { $group: { _id: "$campaignId", count: { $sum: 1 } } },
        ])
      : [];
    const countByCampaign = new Map(voteCounts.map((v) => [v._id.toString(), v.count]));

    return NextResponse.json({
      campaigns: campaigns.map((c) => ({
        _id: c._id.toString(),
        title: c.title,
        status: c.status,
        topN: c.topN,
        cardCount: Array.isArray(c.cards) ? c.cards.length : 0,
        voteCount: countByCampaign.get(c._id.toString()) ?? 0,
        endsAt: c.endsAt,
        closedAt: c.closedAt,
        createdAt: c.createdAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[admin/upvote-campaigns GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const gate = gateAdmin(session);
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: gate.status });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = createCampaignSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    const cards = await buildCardSnapshots(parsed.data.cards);

    const campaign = await UpvoteCampaign.create({
      title: parsed.data.title,
      description: parsed.data.description ?? { de: "", en: "" },
      question: parsed.data.question,
      topN: parsed.data.topN,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      cards,
      createdBy: new Types.ObjectId(gate.userId),
    });

    return NextResponse.json({ _id: campaign._id.toString() }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("unknown_internal_card:")) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[admin/upvote-campaigns POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
