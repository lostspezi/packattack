import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import QuizEvent from "@/models/quiz-event";
import QuizParticipant from "@/models/quiz-participant";

function isAdmin(role?: string | null) {
  return role === "admin" || role === "super_admin";
}

/** GET — paginated participant list with user data and results */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const user = await User.findById(session.user.id).select("role").lean();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const event = await QuizEvent.findById(id).lean();
    if (!event) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));
    const statusFilter = url.searchParams.get("status") || "";
    const search = url.searchParams.get("search") || "";

    // Build query
    const query: Record<string, unknown> = { eventId: event._id };
    if (statusFilter) query.status = statusFilter;

    // If searching, find matching user IDs first
    if (search) {
      const userQuery = {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { username: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      };
      const matchingUsers = await User.find(userQuery).select("_id").lean();
      query.userId = { $in: matchingUsers.map((u) => u._id) };
    }

    const [participants, total] = await Promise.all([
      QuizParticipant.find(query)
        .sort({ correctCount: -1, totalTimeMs: 1, joinedAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      QuizParticipant.countDocuments(query),
    ]);

    // Hydrate with user data
    const userIds = participants.map((p) => p.userId);
    const users = await User.find({ _id: { $in: userIds } })
      .select("name username email image")
      .lean();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    const results = participants.map((p) => {
      const u = userMap.get(String(p.userId));
      return {
        ...p,
        _id: String(p._id),
        eventId: String(p.eventId),
        userId: String(p.userId),
        user: u
          ? {
              name: u.name,
              username: (u as unknown as Record<string, unknown>).username ?? null,
              email: u.email,
              image: u.image,
            }
          : null,
      };
    });

    return NextResponse.json({
      participants: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("[admin/quiz-events/[id]/participants] GET error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
