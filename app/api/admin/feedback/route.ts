import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import FeedbackItem from "@/models/feedback-item";
import { FEEDBACK_OPEN_STATUSES } from "@/lib/feedback-constants";
import { isFeedbackStaff, serializeFeedbackItem } from "@/lib/feedback";

export async function GET(req: NextRequest) {
  const session = await auth();
  const viewerUserId = session?.user?.id;
  const viewerRole = (session?.user as { role?: string } | undefined)?.role ?? null;

  if (!viewerUserId || !isFeedbackStaff(viewerRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const status = searchParams.get("status") ?? "";
  const kind = searchParams.get("kind") ?? "";
  const assigned = searchParams.get("assigned") ?? "";
  const scope = searchParams.get("scope") ?? "";
  const search = searchParams.get("search")?.trim() ?? "";
  const skip = (page - 1) * limit;
  const overdueBefore = new Date(Date.now() - 36 * 60 * 60 * 1000);

  try {
    await connectDB();

    const query: Record<string, unknown> = {};

    if (status) query.status = status;
    if (kind) query.kind = kind;
    if (assigned === "me") query.assignedTo = viewerUserId;
    if (assigned === "unassigned") query.assignedTo = null;

    if (scope === "attention") {
      query.$or = [
        { status: "new" },
        { status: "waiting", waitingOn: "staff" },
        {
          status: { $in: FEEDBACK_OPEN_STATUSES },
          lastActivityAt: { $lte: overdueBefore },
        },
      ];
    }

    if (search) {
      query.$and = [
        ...(Array.isArray(query.$and) ? query.$and : []),
        {
          $or: [
            { ticketNo: { $regex: search, $options: "i" } },
            { title: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
          ],
        },
      ];
    }

    const [items, total, openCount, newCount, waitingOnStaffCount, assignedToMeCount, overdueCount, unassignedCount, waitingOnUserCount] = await Promise.all([
      FeedbackItem.find(query)
        .sort({ lastActivityAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("submitterUserId", "name username email role preferences.language")
        .populate("assignedTo", "name username email role preferences.language")
        .lean(),
      FeedbackItem.countDocuments(query),
      FeedbackItem.countDocuments({ status: { $in: FEEDBACK_OPEN_STATUSES } }),
      FeedbackItem.countDocuments({ status: "new" }),
      FeedbackItem.countDocuments({ status: "waiting", waitingOn: "staff" }),
      FeedbackItem.countDocuments({ assignedTo: viewerUserId, status: { $in: FEEDBACK_OPEN_STATUSES } }),
      FeedbackItem.countDocuments({
        status: { $in: FEEDBACK_OPEN_STATUSES },
        lastActivityAt: { $lte: overdueBefore },
      }),
      FeedbackItem.countDocuments({ status: { $in: FEEDBACK_OPEN_STATUSES }, assignedTo: null }),
      FeedbackItem.countDocuments({ status: "waiting", waitingOn: "user" }),
    ]);

    return NextResponse.json({
      items: items.map((item) =>
        serializeFeedbackItem(item as never, {
          viewerUserId,
          viewerRole,
        })
      ),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      stats: {
        openCount,
        newCount,
        waitingOnStaffCount,
        assignedToMeCount,
        overdueCount,
        unassignedCount,
        waitingOnUserCount,
      },
    });
  } catch (err) {
    console.error("[admin/feedback GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
