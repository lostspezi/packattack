import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import QuizEvent from "@/models/quiz-event";
import QuizParticipant from "@/models/quiz-participant";
import User from "@/models/user";

/**
 * GET — all participants for the current event.
 * Returns waitlisted users (waiting room) and completed users (leaderboard),
 * plus active users (in-progress indicator).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

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
      return NextResponse.json({ waitlisted: [], active: [], leaderboard: [] });
    }

    const participants = await QuizParticipant.find({ eventId: event._id })
      .sort({ correctCount: -1, totalTimeMs: 1, joinedAt: 1 })
      .lean();

    // Hydrate user data
    const userIds = participants.map((p) => p.userId);
    const users = await User.find({ _id: { $in: userIds } })
      .select("name username image")
      .lean();
    const userMap = new Map(
      users.map((u) => [
        String(u._id),
        {
          name: u.name ?? "Unbekannt",
          username: (u as unknown as Record<string, unknown>).username ?? null,
          image: u.image ?? null,
        },
      ]),
    );

    const waitlisted: Array<Record<string, unknown>> = [];
    const active: Array<Record<string, unknown>> = [];
    const leaderboard: Array<Record<string, unknown>> = [];

    let leaderboardRank = 0;

    for (const p of participants) {
      const u = userMap.get(String(p.userId));
      const base = {
        participantId: String(p._id),
        userId: String(p.userId),
        name: u?.name ?? "Unbekannt",
        username: u?.username ?? null,
        image: u?.image ?? null,
        joinedAt: p.joinedAt,
        isMe: String(p.userId) === session.user.id,
      };

      if (p.status === "waitlisted") {
        waitlisted.push(base);
      } else if (p.status === "active") {
        active.push({
          ...base,
          answeredCount: p.answers.length,
          totalQuestions: p.assignedQuestionIds.length,
          startedAt: p.startedAt,
        });
      } else if (p.status === "completed") {
        leaderboardRank++;
        leaderboard.push({
          ...base,
          rank: leaderboardRank,
          correctCount: p.correctCount,
          totalQuestions: p.assignedQuestionIds.length,
          percentage: p.assignedQuestionIds.length > 0
            ? Math.round((p.correctCount / p.assignedQuestionIds.length) * 100)
            : 0,
          totalTimeMs: p.totalTimeMs,
          completedAt: p.completedAt,
          placement: p.placement,
        });
      }
    }

    // Sort waitlisted by joinedAt asc (first joined first)
    waitlisted.sort(
      (a, b) =>
        new Date(a.joinedAt as string).getTime() -
        new Date(b.joinedAt as string).getTime(),
    );

    return NextResponse.json({ waitlisted, active, leaderboard });
  } catch (err) {
    console.error("[events/current/participants] GET error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
