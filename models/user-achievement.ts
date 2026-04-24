import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IUserAchievement extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  achievementId: Types.ObjectId;
  achievementKeySnapshot: string;
  progress: number;
  target: number | null;
  completed: boolean;
  unlockedAt: Date | null;
  grantedByUserId: Types.ObjectId | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserAchievementSchema = new Schema<IUserAchievement>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    achievementId: {
      type: Schema.Types.ObjectId,
      ref: "Achievement",
      required: true,
      index: true,
    },
    achievementKeySnapshot: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
    },
    progress: { type: Number, default: 0, min: 0 },
    target: { type: Number, default: null, min: 0 },
    completed: { type: Boolean, default: false, index: true },
    unlockedAt: { type: Date, default: null },
    grantedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    note: { type: String, default: null, maxlength: 300 },
  },
  { timestamps: true }
);

// Ein User hat pro Achievement maximal einen Eintrag (bleibt nach Unlock).
UserAchievementSchema.index({ userId: 1, achievementId: 1 }, { unique: true });
UserAchievementSchema.index({ userId: 1, completed: 1, unlockedAt: -1 });

const UserAchievement: Model<IUserAchievement> =
  mongoose.models.UserAchievement ??
  mongoose.model<IUserAchievement>("UserAchievement", UserAchievementSchema);

export default UserAchievement;
