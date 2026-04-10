import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IQuizQuestion extends Document {
  eventId: Types.ObjectId;
  number: number;
  externalId: string;
  category: string;
  question: string;
  answers: string[];
  correctIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

const QuizQuestionSchema = new Schema<IQuizQuestion>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "QuizEvent", required: true },
    number: { type: Number, required: true },
    externalId: { type: String, required: true },
    category: { type: String, required: true },
    question: { type: String, required: true },
    answers: {
      type: [String],
      required: true,
      validate: {
        validator: (v: string[]) => v.length >= 2 && v.length <= 6,
        message: "Must have 2-6 answers",
      },
    },
    correctIndex: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

QuizQuestionSchema.index({ eventId: 1, number: 1 });
QuizQuestionSchema.index({ eventId: 1 });

const QuizQuestion: Model<IQuizQuestion> =
  mongoose.models.QuizQuestion ??
  mongoose.model<IQuizQuestion>("QuizQuestion", QuizQuestionSchema);

export default QuizQuestion;
