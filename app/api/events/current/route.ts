import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import QuizEvent from "@/models/quiz-event";
import QuizParticipant from "@/models/quiz-participant";
import QuizQuestion from "@/models/quiz-question";

/** GET — get the current active or upcoming quiz event + user's participation */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    // Admins can see draft events too (for testing)
    const user = await User.findById(session.user.id).select("role").lean();
    const isAdmin = user?.role === "admin" || user?.role === "super_admin";
    const statusFilter = isAdmin
      ? ["active", "upcoming", "draft"]
      : ["active", "upcoming"];

    // Find the most relevant event: active first, then upcoming, then draft
    const event = await QuizEvent.findOne({
      status: { $in: statusFilter },
    })
      .sort({ status: 1, startsAt: 1 })
      .lean();

    if (!event) {
      return NextResponse.json({ event: null, participant: null });
    }

    // Auto-transition: upcoming → active when startsAt has passed
    let effectiveStatus = event.status;
    if (event.status === "upcoming" && new Date(event.startsAt) <= new Date()) {
      await QuizEvent.updateOne(
        { _id: event._id, status: "upcoming" },
        { $set: { status: "active" } },
      );
      await QuizParticipant.updateMany(
        { eventId: event._id, status: "waitlisted" },
        { $set: { status: "active" } },
      );
      effectiveStatus = "active";
    }

    const [participant, participantCount, questionCount] = await Promise.all([
      QuizParticipant.findOne({
        eventId: event._id,
        userId: session.user.id,
      }).lean(),
      QuizParticipant.countDocuments({ eventId: event._id }),
      QuizQuestion.countDocuments({ eventId: event._id }),
    ]);

    return NextResponse.json({
      event: {
        _id: String(event._id),
        title: event.title,
        slug: event.slug,
        status: effectiveStatus,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        questionsPerParticipant: event.questionsPerParticipant,
        requiredBadgeKey: event.requiredBadgeKey,
        participantCount,
        questionCount,
      },
      participant: participant
        ? {
            _id: String(participant._id),
            status: participant.status,
            joinedAt: participant.joinedAt,
            startedAt: participant.startedAt,
            completedAt: participant.completedAt,
            currentQuestionIndex: participant.currentQuestionIndex,
            correctCount: participant.correctCount,
            totalTimeMs: participant.totalTimeMs,
            totalQuestions: participant.assignedQuestionIds.length,
            answeredCount: participant.answers.length,
            placement: participant.placement,
          }
        : null,
    });
  } catch (err) {
    console.error("[events/current] GET error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
