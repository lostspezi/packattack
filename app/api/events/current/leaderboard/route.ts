import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import QuizEvent from "@/models/quiz-event";
import QuizParticipant from "@/models/quiz-participant";
import User from "@/models/user";

/** GET — quiz event leaderboard */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const url = new URL(req.url);
    const limit = Math.min(
      200,
      Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)),
    );

    const dbUser = await User.findById(session.user.id).select("role").lean();
    const isAdmin = dbUser?.role === "admin" || dbUser?.role === "super_admin";
    const statusFilter = isAdmin
      ? ["active", "upcoming", "ended", "draft"]
      : ["active", "upcoming", "ended"];

    const event = await QuizEvent.findOne({
      status: { $in: statusFilter },
    })
      .sort({ status: 1, startsAt: -1 })
      .lean();

    if (!event) {
      return NextResponse.json({ leaderboard: [], myEntry: null });
    }

    // All completed participants, ranked
    const participants = await QuizParticipant.find({
      eventId: event._id,
      status: "completed",
    })
      .sort({ correctCount: -1, totalTimeMs: 1, joinedAt: 1 })
      .limit(limit)
      .lean();

    // Hydrate user data
    const userIds = participants.map((p) => p.userId);
    const users = await User.find({ _id: { $in: userIds } })
      .select("name username image")
      .lean();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    const leaderboard = participants.map((p, index) => {
      const u = userMap.get(String(p.userId));
      return {
        rank: index + 1,
        userId: String(p.userId),
        name: u?.name ?? "Unbekannt",
        username: (u as unknown as Record<string, unknown>)?.username ?? null,
        image: u?.image ?? null,
        correctCount: p.correctCount,
        totalQuestions: p.assignedQuestionIds.length,
        totalTimeMs: p.totalTimeMs,
        completedAt: p.completedAt,
        placement: p.placement,
      };
    });

    // Find user's own entry
    const myParticipant = await QuizParticipant.findOne({
      eventId: event._id,
      userId: session.user.id,
    }).lean();

    let myEntry = null;
    if (myParticipant && myParticipant.status === "completed") {
      // Find rank
      const rank =
        (await QuizParticipant.countDocuments({
          eventId: event._id,
          status: "completed",
          $or: [
            { correctCount: { $gt: myParticipant.correctCount } },
            {
              correctCount: myParticipant.correctCount,
              totalTimeMs: { $lt: myParticipant.totalTimeMs },
            },
            {
              correctCount: myParticipant.correctCount,
              totalTimeMs: myParticipant.totalTimeMs,
              joinedAt: { $lt: myParticipant.joinedAt },
            },
          ],
        })) + 1;

      myEntry = {
        rank,
        correctCount: myParticipant.correctCount,
        totalQuestions: myParticipant.assignedQuestionIds.length,
        totalTimeMs: myParticipant.totalTimeMs,
        completedAt: myParticipant.completedAt,
        placement: myParticipant.placement,
      };
    }

    return NextResponse.json({ leaderboard, myEntry });
  } catch (err) {
    console.error("[events/current/leaderboard] GET error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
