import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import UpvoteCampaign from "@/models/upvote-campaign";
import UpvoteVote from "@/models/upvote-vote";
import User from "@/models/user";
import { gateAdmin, toCsvLong, toCsvMatrix } from "@/lib/admin/upvote-campaign-helpers";
import { aggregateVotes, rankAggregatedVotes } from "@/lib/votes/aggregate";

export async function GET(
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
  const format = new URL(req.url).searchParams.get("format") ?? "csv-long";
  if (format !== "csv-long" && format !== "csv-matrix") {
    return NextResponse.json({ error: "invalid_format" }, { status: 400 });
  }

  try {
    await connectDB();
    const campaign = await UpvoteCampaign.findById(id).lean();
    if (!campaign) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const votes = await UpvoteVote.find({ campaignId: campaign._id })
      .select("userId itemRefId")
      .lean();

    const userIds = [...new Set(votes.map((v) => v.userId.toString()))].map(
      (s) => new Types.ObjectId(s)
    );
    const users = userIds.length
      ? await User.find({ _id: { $in: userIds } }).select("_id name username").lean()
      : [];
    const userMap = new Map(
      users.map((u) => [u._id.toString(), `${u.name ?? "?"} (${u.username ?? "?"})`])
    );

    const itemLabelById = new Map(
      campaign.items.map((c) => [c._id.toString(), c.label?.de || c.label?.en || c._id.toString()])
    );
    const positions = new Map(campaign.items.map((c) => [c._id.toString(), c.position]));
    const itemIds = campaign.items.map((c) => c._id.toString());

    const title = campaign.title?.de ?? campaign.title?.en ?? campaign._id.toString();
    let body: string;

    if (format === "csv-long") {
      const flat = votes.map((v) => ({
        userId: v.userId.toString(),
        itemRefId: v.itemRefId.toString(),
      }));
      const aggregated = aggregateVotes(flat, itemIds);
      const ranked = rankAggregatedVotes(aggregated, positions);

      const votersByItem = new Map<string, string[]>();
      for (const v of votes) {
        const key = v.itemRefId.toString();
        const list = votersByItem.get(key) ?? [];
        list.push(userMap.get(v.userId.toString()) ?? v.userId.toString());
        votersByItem.set(key, list);
      }

      body = toCsvLong(
        title,
        ranked.map((r) => ({
          itemLabel: itemLabelById.get(r.itemRefId) ?? r.itemRefId,
          voteCount: r.voteCount,
          userNames: votersByItem.get(r.itemRefId) ?? [],
        }))
      );
    } else {
      const itemLabels = [...campaign.items]
        .sort((a, b) => a.position - b.position)
        .map((c) => c.label?.de || c.label?.en || c._id.toString());
      const orderedIds = [...campaign.items]
        .sort((a, b) => a.position - b.position)
        .map((c) => c._id.toString());

      const userPicks = new Map<string, Set<string>>();
      for (const v of votes) {
        const uid = v.userId.toString();
        const picks = userPicks.get(uid) ?? new Set<string>();
        picks.add(v.itemRefId.toString());
        userPicks.set(uid, picks);
      }

      const userRows = [...userPicks.entries()].map(([userId, picks]) => ({
        userName: userMap.get(userId) ?? userId,
        picks: new Set(
          orderedIds.filter((id) => picks.has(id)).map((id) => itemLabelById.get(id) ?? id)
        ),
      }));

      body = toCsvMatrix(itemLabels, userRows);
    }

    const safeTitle = title.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 60);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="upvote-${safeTitle}-${format}.csv"`,
      },
    });
  } catch (err) {
    console.error("[admin/upvote-campaigns/:id/export]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
