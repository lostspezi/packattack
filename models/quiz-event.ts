import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type QuizEventStatus = "draft" | "upcoming" | "active" | "ended";

export interface IQuizEventWinner {
  userId: Types.ObjectId;
  placement: 1 | 2 | 3;
  correctCount: number;
  totalTimeMs: number;
}

export interface IQuizEvent extends Document {
  title: { de: string; en: string };
  slug: string;
  status: QuizEventStatus;
  startsAt: Date;
  endsAt: Date | null;
  questionsPerParticipant: number;
  requiredBadgeKey: string | null;
  winners: IQuizEventWinner[];
  createdBy: Types.ObjectId;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const QuizEventWinnerSchema = new Schema<IQuizEventWinner>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    placement: { type: Number, enum: [1, 2, 3], required: true },
    correctCount: { type: Number, required: true },
    totalTimeMs: { type: Number, required: true },
  },
  { _id: false },
);

const QuizEventSchema = new Schema<IQuizEvent>(
  {
    title: {
      de: { type: String, required: true, maxlength: 200 },
      en: { type: String, required: true, maxlength: 200 },
    },
    slug: { type: String, unique: true },
    status: {
      type: String,
      enum: ["draft", "upcoming", "active", "ended"],
      default: "draft",
      required: true,
    },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, default: null },
    questionsPerParticipant: { type: Number, required: true, min: 1, max: 100 },
    requiredBadgeKey: { type: String, default: null },
    winners: { type: [QuizEventWinnerSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

// Auto-generate slug
QuizEventSchema.pre("save", async function () {
  if (this.slug) return;

  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let slug: string;
  const QuizEventModel = this.constructor as Model<IQuizEvent>;

  while (true) {
    slug = Array.from({ length: 8 }, () =>
      chars[Math.floor(Math.random() * chars.length)],
    ).join("");
    const existing = await QuizEventModel.findOne({ slug }).select("_id").lean();
    if (!existing) break;
  }

  this.slug = slug;
});

QuizEventSchema.index({ slug: 1 }, { unique: true });
QuizEventSchema.index({ status: 1, startsAt: -1 });
QuizEventSchema.index({ createdAt: -1 });

const QuizEvent: Model<IQuizEvent> =
  mongoose.models.QuizEvent ??
  mongoose.model<IQuizEvent>("QuizEvent", QuizEventSchema);

export default QuizEvent;
