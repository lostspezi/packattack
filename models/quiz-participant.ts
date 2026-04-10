import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type QuizParticipantStatus = "waitlisted" | "active" | "completed";

export interface IQuizAnswer {
  questionId: Types.ObjectId;
  selectedIndex: number;
  correct: boolean;
  answeredAt: Date;
  timeSpentMs: number;
}

export interface IQuizParticipant extends Document {
  eventId: Types.ObjectId;
  userId: Types.ObjectId;
  status: QuizParticipantStatus;
  joinedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  assignedQuestionIds: Types.ObjectId[];
  currentQuestionIndex: number;
  answers: IQuizAnswer[];
  correctCount: number;
  totalTimeMs: number;
  placement: 1 | 2 | 3 | null;
  createdAt: Date;
  updatedAt: Date;
}

const QuizAnswerSchema = new Schema<IQuizAnswer>(
  {
    questionId: {
      type: Schema.Types.ObjectId,
      ref: "QuizQuestion",
      required: true,
    },
    selectedIndex: { type: Number, required: true, min: 0 },
    correct: { type: Boolean, required: true },
    answeredAt: { type: Date, required: true },
    timeSpentMs: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const QuizParticipantSchema = new Schema<IQuizParticipant>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "QuizEvent",
      required: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["waitlisted", "active", "completed"],
      default: "waitlisted",
      required: true,
    },
    joinedAt: { type: Date, default: Date.now },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    assignedQuestionIds: {
      type: [Schema.Types.ObjectId],
      ref: "QuizQuestion",
      default: [],
    },
    currentQuestionIndex: { type: Number, default: 0 },
    answers: { type: [QuizAnswerSchema], default: [] },
    correctCount: { type: Number, default: 0 },
    totalTimeMs: { type: Number, default: 0 },
    placement: { type: Number, enum: [1, 2, 3, null], default: null },
  },
  { timestamps: true },
);

QuizParticipantSchema.index({ eventId: 1, userId: 1 }, { unique: true });
QuizParticipantSchema.index({ eventId: 1, status: 1 });
QuizParticipantSchema.index({ eventId: 1, correctCount: -1, totalTimeMs: 1 });

const QuizParticipant: Model<IQuizParticipant> =
  mongoose.models.QuizParticipant ??
  mongoose.model<IQuizParticipant>("QuizParticipant", QuizParticipantSchema);

export default QuizParticipant;
