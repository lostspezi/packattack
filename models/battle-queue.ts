import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IBattleQueueEntry extends Document {
  user: Types.ObjectId;
  box: Types.ObjectId;
  playerCount: number;
  elo: number;
  queuedAt: Date;
  status: "waiting" | "matched" | "cancelled";
}

const BattleQueueSchema = new Schema<IBattleQueueEntry>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    box: { type: Schema.Types.ObjectId, ref: "Box", required: true },
    playerCount: { type: Number, required: true, min: 2, max: 4 },
    elo: { type: Number, required: true },
    queuedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["waiting", "matched", "cancelled"],
      default: "waiting",
      required: true,
    },
  },
  { timestamps: true },
);

BattleQueueSchema.index({ box: 1, playerCount: 1, status: 1, elo: 1 });
BattleQueueSchema.index({ user: 1, status: 1 });
BattleQueueSchema.index(
  { queuedAt: 1 },
  { expireAfterSeconds: 300 },
);

const BattleQueue: Model<IBattleQueueEntry> =
  mongoose.models.BattleQueue ??
  mongoose.model<IBattleQueueEntry>("BattleQueue", BattleQueueSchema);

export default BattleQueue;
