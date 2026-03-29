import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IBattlePull extends Document {
  battle: Types.ObjectId;
  user: Types.ObjectId;
  card: Types.ObjectId;
  rarity: string;
  coinValue: number;
  conversionValue: number;
  roundIndex: number;
  status: "pending" | "distributed" | "claimed" | "converted";
  distributedTo: Types.ObjectId | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const BattlePullSchema = new Schema<IBattlePull>(
  {
    battle: { type: Schema.Types.ObjectId, ref: "Battle", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    card: { type: Schema.Types.ObjectId, ref: "Card", required: true },
    rarity: { type: String, required: true },
    coinValue: { type: Number, required: true },
    conversionValue: { type: Number, required: true },
    roundIndex: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "distributed", "claimed", "converted"],
      default: "pending",
      required: true,
    },
    distributedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

BattlePullSchema.index({ battle: 1, roundIndex: 1 });
BattlePullSchema.index({ battle: 1, user: 1 });
BattlePullSchema.index({ distributedTo: 1, status: 1 });

const BattlePull: Model<IBattlePull> =
  mongoose.models.BattlePull ?? mongoose.model<IBattlePull>("BattlePull", BattlePullSchema);

export default BattlePull;
