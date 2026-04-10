import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import QuizEvent from "@/models/quiz-event";
import QuizQuestion from "@/models/quiz-question";
import QuizParticipant from "@/models/quiz-participant";
import { seedNerdQuizQuestions } from "@/seed/nerd-quiz-seed";

function isAdmin(role?: string | null) {
  return role === "admin" || role === "super_admin";
}

type RouteCtx = { params: Promise<{ id: string }> };

/** GET — single event detail with stats */
export async function GET(_req: NextRequest, { params }: RouteCtx) {
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

    const [totalParticipants, waitlisted, active, completed, questionCount] =
      await Promise.all([
        QuizParticipant.countDocuments({ eventId: event._id }),
        QuizParticipant.countDocuments({ eventId: event._id, status: "waitlisted" }),
        QuizParticipant.countDocuments({ eventId: event._id, status: "active" }),
        QuizParticipant.countDocuments({ eventId: event._id, status: "completed" }),
        QuizQuestion.countDocuments({ eventId: event._id }),
      ]);

    return NextResponse.json({
      event: {
        ...event,
        _id: String(event._id),
        createdBy: String(event.createdBy),
      },
      stats: { totalParticipants, waitlisted, active, completed, questionCount },
    });
  } catch (err) {
    console.error("[admin/quiz-events/[id]] GET error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

/** PUT — update event */
export async function PUT(req: NextRequest, { params }: RouteCtx) {
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
    const event = await QuizEvent.findById(id);
    if (!event) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const body = await req.json();

    if (body.titleDe !== undefined) event.title.de = body.titleDe;
    if (body.titleEn !== undefined) event.title.en = body.titleEn;
    if (body.status !== undefined) event.status = body.status;
    if (body.startsAt !== undefined) event.startsAt = new Date(body.startsAt);
    if (body.endsAt !== undefined) event.endsAt = body.endsAt ? new Date(body.endsAt) : null;
    if (body.questionsPerParticipant !== undefined) {
      event.questionsPerParticipant = body.questionsPerParticipant;
    }
    if (body.requiredBadgeKey !== undefined) event.requiredBadgeKey = body.requiredBadgeKey;
    if (body.notes !== undefined) event.notes = body.notes;

    // If setting status to active, auto-activate waitlisted participants
    if (body.status === "active") {
      await QuizParticipant.updateMany(
        { eventId: event._id, status: "waitlisted" },
        { $set: { status: "active" } },
      );
    }

    // Force-activate waitlisted participants (for admin testing on drafts)
    if (body.activateParticipants) {
      await QuizParticipant.updateMany(
        { eventId: event._id, status: "waitlisted" },
        { $set: { status: "active" } },
      );
    }

    // Re-import questions if requested
    if (body.reimportQuestions) {
      await seedNerdQuizQuestions(event._id);
    }

    await event.save();

    return NextResponse.json({
      event: {
        ...event.toObject(),
        _id: String(event._id),
        createdBy: String(event.createdBy),
      },
    });
  } catch (err) {
    console.error("[admin/quiz-events/[id]] PUT error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

/** DELETE — delete event + questions + participants */
export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
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
    const event = await QuizEvent.findById(id);
    if (!event) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    await Promise.all([
      QuizQuestion.deleteMany({ eventId: event._id }),
      QuizParticipant.deleteMany({ eventId: event._id }),
      event.deleteOne(),
    ]);

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("[admin/quiz-events/[id]] DELETE error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
