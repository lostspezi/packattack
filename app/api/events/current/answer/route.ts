import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import QuizEvent from "@/models/quiz-event";
import QuizParticipant from "@/models/quiz-participant";
import QuizQuestion from "@/models/quiz-question";
import { shuffleAnswers } from "@/lib/quiz-helpers";

/** POST — submit an answer for the current question */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const body = await req.json();
    const { selectedIndex, timeSpentMs } = body;

    if (selectedIndex === undefined || selectedIndex === null) {
      return NextResponse.json(
        { error: "answer_required" },
        { status: 400 },
      );
    }

    const dbUser = await User.findById(session.user.id).select("role").lean();
    const isAdmin = dbUser?.role === "admin" || dbUser?.role === "super_admin";
    const statusFilter = isAdmin ? { $in: ["active", "draft"] } : "active";

    const event = await QuizEvent.findOne({ status: statusFilter }).lean();
    if (!event) {
      return NextResponse.json(
        { error: "no_active_event" },
        { status: 400 },
      );
    }

    const participant = await QuizParticipant.findOne({
      eventId: event._id,
      userId: session.user.id,
    });

    if (!participant) {
      return NextResponse.json({ error: "not_joined" }, { status: 403 });
    }

    if (participant.status === "completed") {
      return NextResponse.json(
        { error: "already_completed" },
        { status: 400 },
      );
    }

    if (!participant.startedAt || participant.assignedQuestionIds.length === 0) {
      return NextResponse.json(
        { error: "quiz_not_started" },
        { status: 400 },
      );
    }

    const currentIdx = participant.currentQuestionIndex;
    if (currentIdx >= participant.assignedQuestionIds.length) {
      return NextResponse.json(
        { error: "no_more_questions" },
        { status: 400 },
      );
    }

    // Prevent double-answering the same question
    const currentQuestionId = participant.assignedQuestionIds[currentIdx];
    const alreadyAnswered = participant.answers.some(
      (a) => String(a.questionId) === String(currentQuestionId),
    );
    if (alreadyAnswered) {
      return NextResponse.json(
        { error: "already_answered" },
        { status: 409 },
      );
    }

    // Fetch the question to check correctness
    const question = await QuizQuestion.findById(currentQuestionId).lean();
    if (!question) {
      return NextResponse.json({ error: "question_not_found" }, { status: 500 });
    }

    // Use the same deterministic shuffle to find correct index in shuffled space
    const { newCorrectIndex } = shuffleAnswers(
      question.answers,
      question.correctIndex,
      String(question._id),
      String(participant._id),
    );

    const correct = selectedIndex === newCorrectIndex;
    const now = new Date();

    // Record the answer
    participant.answers.push({
      questionId: currentQuestionId,
      selectedIndex,
      correct,
      answeredAt: now,
      timeSpentMs: Math.max(0, timeSpentMs || 0),
    });

    if (correct) {
      participant.correctCount += 1;
    }
    participant.totalTimeMs += Math.max(0, timeSpentMs || 0);
    participant.currentQuestionIndex = currentIdx + 1;

    // Check if quiz is complete
    const isComplete =
      participant.currentQuestionIndex >= participant.assignedQuestionIds.length;

    if (isComplete) {
      participant.status = "completed";
      participant.completedAt = now;

      // Calculate total time from start
      participant.totalTimeMs =
        now.getTime() - new Date(participant.startedAt!).getTime();

      // Assign placement atomically
      await participant.save();
      await assignPlacements(event._id.toString());
    } else {
      await participant.save();
    }

    // Build response — return shuffled correctIndex so UI highlights the right answer
    const response: Record<string, unknown> = {
      correct,
      correctIndex: newCorrectIndex,
      answeredCount: participant.answers.length,
      correctCount: participant.correctCount,
      totalQuestions: participant.assignedQuestionIds.length,
      isComplete,
    };

    // If not complete, include next question with shuffled answers
    if (!isComplete) {
      const nextQId =
        participant.assignedQuestionIds[participant.currentQuestionIndex];
      const nextQ = await QuizQuestion.findById(nextQId)
        .select("number category question answers correctIndex")
        .lean();

      let nextQuestion = null;
      if (nextQ) {
        const { shuffledAnswers: nextShuffled } = shuffleAnswers(
          nextQ.answers,
          nextQ.correctIndex,
          String(nextQ._id),
          String(participant._id),
        );
        nextQuestion = {
          _id: String(nextQ._id),
          number: nextQ.number,
          category: nextQ.category,
          question: nextQ.question,
          answers: nextShuffled,
        };
      }
      response.nextQuestion = nextQuestion;
    } else {
      response.totalTimeMs = participant.totalTimeMs;
      response.placement = participant.placement;
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error("[events/current/answer] POST error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

/**
 * Recalculate top 3 placements for an event.
 * Sorts completed participants by correctCount desc, then totalTimeMs asc.
 */
async function assignPlacements(eventId: string) {
  const completed = await QuizParticipant.find({
    eventId,
    status: "completed",
  })
    .sort({ correctCount: -1, totalTimeMs: 1, joinedAt: 1 })
    .select("_id correctCount totalTimeMs")
    .lean();

  // Clear all existing placements for this event
  await QuizParticipant.updateMany(
    { eventId, placement: { $ne: null } },
    { $set: { placement: null } },
  );

  // Assign top 3
  const placements = [1, 2, 3] as const;
  for (let i = 0; i < Math.min(placements.length, completed.length); i++) {
    await QuizParticipant.updateOne(
      { _id: completed[i]._id },
      { $set: { placement: placements[i] } },
    );
  }

  // Update event winners
  const winners = [];
  for (let i = 0; i < Math.min(3, completed.length); i++) {
    const p = await QuizParticipant.findById(completed[i]._id).lean();
    if (p) {
      winners.push({
        userId: p.userId,
        placement: placements[i],
        correctCount: p.correctCount,
        totalTimeMs: p.totalTimeMs,
      });
    }
  }

  await QuizEvent.updateOne({ _id: eventId }, { $set: { winners } });
}
