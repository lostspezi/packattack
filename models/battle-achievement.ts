import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IBattleAchievement extends Document {
  user: Types.ObjectId;
  key: string;
  unlockedAt: Date;
  battle: Types.ObjectId | null;
}

const BattleAchievementSchema = new Schema<IBattleAchievement>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    key: { type: String, required: true },
    unlockedAt: { type: Date, default: Date.now },
    battle: { type: Schema.Types.ObjectId, ref: "Battle", default: null },
  },
  { timestamps: false }
);

BattleAchievementSchema.index({ user: 1, key: 1 }, { unique: true });

const BattleAchievement: Model<IBattleAchievement> =
  mongoose.models.BattleAchievement ?? mongoose.model<IBattleAchievement>("BattleAchievement", BattleAchievementSchema);

export default BattleAchievement;
