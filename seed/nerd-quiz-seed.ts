import { Types } from "mongoose";
import QuizQuestion from "@/models/quiz-question";
import questionsData from "./nerd-quiz-questions.json";

interface RawQuestion {
  number: number;
  id: string;
  category: string;
  question: string;
  answers: string[];
  correctIndex: number;
  correctAnswer: string;
}

/**
 * Import all nerd-quiz questions for a given event.
 * Deletes existing questions for the event first (idempotent).
 */
export async function seedNerdQuizQuestions(eventId: Types.ObjectId | string) {
  const eid =
    typeof eventId === "string" ? new Types.ObjectId(eventId) : eventId;

  // Remove any existing questions for this event
  await QuizQuestion.deleteMany({ eventId: eid });

  const docs = (questionsData as RawQuestion[]).map((q) => ({
    eventId: eid,
    number: q.number,
    externalId: q.id,
    category: q.category,
    question: q.question,
    answers: q.answers,
    correctIndex: q.correctIndex,
  }));

  const inserted = await QuizQuestion.insertMany(docs);
  return inserted.length;
}
