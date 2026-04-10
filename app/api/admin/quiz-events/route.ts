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

/** GET — list all quiz events with stats */
export async function GET() {
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

    const events = await QuizEvent.find()
      .sort({ startsAt: -1, createdAt: -1 })
      .lean();

    // Attach stats per event
    const eventsWithStats = await Promise.all(
      events.map(async (ev) => {
        const [totalParticipants, waitlisted, active, completed, questionCount] =
          await Promise.all([
            QuizParticipant.countDocuments({ eventId: ev._id }),
            QuizParticipant.countDocuments({ eventId: ev._id, status: "waitlisted" }),
            QuizParticipant.countDocuments({ eventId: ev._id, status: "active" }),
            QuizParticipant.countDocuments({ eventId: ev._id, status: "completed" }),
            QuizQuestion.countDocuments({ eventId: ev._id }),
          ]);

        return {
          ...ev,
          _id: String(ev._id),
          createdBy: String(ev.createdBy),
          stats: { totalParticipants, waitlisted, active, completed, questionCount },
        };
      }),
    );

    return NextResponse.json({ events: eventsWithStats });
  } catch (err) {
    console.error("[admin/quiz-events] GET error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

/** POST — create a new quiz event + import questions */
export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const {
      titleDe,
      titleEn,
      status,
      startsAt,
      endsAt,
      questionsPerParticipant,
      requiredBadgeKey,
      notes,
      importQuestions,
    } = body;

    if (!titleDe || !titleEn) {
      return NextResponse.json(
        { error: "title_required", message: "Both DE and EN titles are required" },
        { status: 400 },
      );
    }

    if (!startsAt) {
      return NextResponse.json(
        { error: "starts_at_required" },
        { status: 400 },
      );
    }

    const event = await QuizEvent.create({
      title: { de: titleDe, en: titleEn },
      status: status || "draft",
      startsAt: new Date(startsAt),
      endsAt: endsAt ? new Date(endsAt) : null,
      questionsPerParticipant: questionsPerParticipant || 15,
      requiredBadgeKey: requiredBadgeKey || null,
      notes: notes || "",
      createdBy: session.user.id,
    });

    let questionCount = 0;
    if (importQuestions) {
      questionCount = await seedNerdQuizQuestions(event._id);
    }

    return NextResponse.json(
      {
        event: {
          ...event.toObject(),
          _id: String(event._id),
          createdBy: String(event.createdBy),
        },
        questionCount,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[admin/quiz-events] POST error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
