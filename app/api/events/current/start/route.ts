import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import QuizEvent from "@/models/quiz-event";
import QuizParticipant from "@/models/quiz-participant";
import QuizQuestion from "@/models/quiz-question";
import { Types } from "mongoose";

/**
 * Fisher-Yates shuffle — returns a new array.
 */
function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** POST — start the quiz: assign random questions, begin timer */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const dbUser = await User.findById(session.user.id).select("role").lean();
    const isAdmin = dbUser?.role === "admin" || dbUser?.role === "super_admin";
    const statusFilter = isAdmin ? { $in: ["active", "draft"] } : "active";

    const event = await QuizEvent.findOne({ status: statusFilter }).lean();
    if (!event) {
      return NextResponse.json(
        { error: "no_active_event", message: "Das Event ist noch nicht aktiv." },
        { status: 400 },
      );
    }

    const participant = await QuizParticipant.findOne({
      eventId: event._id,
      userId: session.user.id,
    });

    if (!participant) {
      return NextResponse.json(
        { error: "not_joined", message: "Du bist nicht angemeldet." },
        { status: 403 },
      );
    }

    if (participant.status === "waitlisted") {
      // Admins can force-start from waitlist for testing
      if (isAdmin) {
        participant.status = "active";
        await participant.save();
      } else {
        return NextResponse.json(
          { error: "still_waitlisted", message: "Das Event hat noch nicht begonnen." },
          { status: 400 },
        );
      }
    }

    if (participant.status === "completed") {
      return NextResponse.json(
        { error: "already_completed", message: "Du hast das Quiz bereits abgeschlossen." },
        { status: 400 },
      );
    }

    // If already started (has assigned questions), return current state
    if (participant.assignedQuestionIds.length > 0) {
      const nextQuestion = await getNextQuestion(participant);
      return NextResponse.json({
        alreadyStarted: true,
        currentQuestionIndex: participant.currentQuestionIndex,
        totalQuestions: participant.assignedQuestionIds.length,
        answeredCount: participant.answers.length,
        question: nextQuestion,
      });
    }

    // Assign random questions
    const allQuestions = await QuizQuestion.find({ eventId: event._id })
      .select("_id")
      .lean();

    if (allQuestions.length === 0) {
      return NextResponse.json(
        { error: "no_questions", message: "Keine Fragen verfügbar." },
        { status: 500 },
      );
    }

    const count = Math.min(event.questionsPerParticipant, allQuestions.length);
    const shuffled = shuffle(allQuestions);
    const assigned = shuffled.slice(0, count).map((q) => q._id as Types.ObjectId);

    participant.assignedQuestionIds = assigned;
    participant.startedAt = new Date();
    participant.currentQuestionIndex = 0;
    await participant.save();

    // Return first question
    const firstQuestion = await QuizQuestion.findById(assigned[0])
      .select("number category question answers")
      .lean();

    return NextResponse.json({
      started: true,
      startedAt: participant.startedAt,
      currentQuestionIndex: 0,
      totalQuestions: assigned.length,
      question: firstQuestion
        ? {
            _id: String(firstQuestion._id),
            number: firstQuestion.number,
            category: firstQuestion.category,
            question: firstQuestion.question,
            answers: firstQuestion.answers,
          }
        : null,
    });
  } catch (err) {
    console.error("[events/current/start] POST error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

async function getNextQuestion(participant: InstanceType<typeof QuizParticipant>) {
  const idx = participant.currentQuestionIndex;
  if (idx >= participant.assignedQuestionIds.length) return null;

  const qId = participant.assignedQuestionIds[idx];
  const q = await QuizQuestion.findById(qId)
    .select("number category question answers")
    .lean();

  if (!q) return null;
  return {
    _id: String(q._id),
    number: q.number,
    category: q.category,
    question: q.question,
    answers: q.answers,
  };
}
