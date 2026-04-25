import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import UpvoteCampaign from "@/models/upvote-campaign";
import { gateAdmin } from "@/lib/admin/upvote-campaign-helpers";

/**
 * Admin-Autocomplete für Upvote-Kampagnen. Wird z.B. vom Notification-
 * Sender verwendet, um eine Kampagne als Link-Ziel zu referenzieren, oder
 * von Cross-Linking-UIs (News-Posts, etc.).
 *
 * Liefert standardmäßig nur Kampagnen mit Status `active` zurück. Mit
 * `?status=any` können auch draft/closed mitkommen.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  const gate = gateAdmin(session);
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: gate.status });

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();
    const statusParam = searchParams.get("status") ?? "active";

    const filter: Record<string, unknown> = {};
    if (statusParam !== "any") filter.status = statusParam;

    if (q.length >= 2) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { "title.de": { $regex: escaped, $options: "i" } },
        { "title.en": { $regex: escaped, $options: "i" } },
        { "question.de": { $regex: escaped, $options: "i" } },
        { "question.en": { $regex: escaped, $options: "i" } },
      ];
    }

    const campaigns = await UpvoteCampaign.find(filter)
      .select("_id title question status topN endsAt closedAt")
      .sort({ status: 1, createdAt: -1 })
      .limit(20)
      .lean();

    return NextResponse.json({
      campaigns: campaigns.map((c) => ({
        _id: c._id.toString(),
        title: c.title,
        question: c.question,
        status: c.status,
        topN: c.topN,
        endsAt: c.endsAt,
        closedAt: c.closedAt,
      })),
    });
  } catch (err) {
    console.error("[admin/upvote-campaigns/search GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
