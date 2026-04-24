import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IFairnessSeed extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  serverSeed: string;
  serverSeedHash: string;
  status: "active" | "revealed";
  nonce: number;
  activatedAt: Date;
  revealedAt: Date | null;
  replacedBySeedId: Types.ObjectId | null;
}

const FairnessSeedSchema = new Schema<IFairnessSeed>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    serverSeed: { type: String, required: true, select: false },
    serverSeedHash: { type: String, required: true },
    status: { type: String, enum: ["active", "revealed"], required: true },
    nonce: { type: Number, required: true, default: 0, min: 0 },
    activatedAt: { type: Date, required: true, default: Date.now },
    revealedAt: { type: Date, default: null },
    replacedBySeedId: { type: Schema.Types.ObjectId, ref: "FairnessSeed", default: null },
  },
  { timestamps: true },
);

// At most one active seed per user — atomic rotate relies on this.
FairnessSeedSchema.index(
  { userId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "active" } },
);
FairnessSeedSchema.index({ userId: 1, activatedAt: -1 });

const FairnessSeed: Model<IFairnessSeed> =
  mongoose.models.FairnessSeed ??
  mongoose.model<IFairnessSeed>("FairnessSeed", FairnessSeedSchema);

export default FairnessSeed;
