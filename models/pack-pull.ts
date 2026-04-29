import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IPackPull extends Document {
  userId: Types.ObjectId;
  boxId: Types.ObjectId;
  cardId: Types.ObjectId;
  rarity: string;
  coinValue: number;
  conversionValue: number;
  status: "pending" | "claimed" | "converted" | "reserved";
  decidedAt: Date | null;
  jackpotAnnouncedAt: Date | null;
  packGroupId: string;
  packIndex: number;
  cardIndex: number;
  ipAddress: string;
  userAgent: string;
  battleId: Types.ObjectId | null;
  expiresAt: Date | null;
  fairnessCommitmentId: Types.ObjectId | null;
  fairnessNonce: number | null;
  binderId: Types.ObjectId | null;
  isGodpack: boolean;
  godpackEventId: Types.ObjectId | null;
  godpackPosition: number | null;
  createdAt: Date;
}

const PackPullSchema = new Schema<IPackPull>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    boxId: { type: Schema.Types.ObjectId, ref: "Box", required: true },
    cardId: { type: Schema.Types.ObjectId, ref: "Card", required: true },
    rarity: { type: String, required: true },
    coinValue: { type: Number, required: true },
    conversionValue: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "claimed", "converted", "reserved"],
      required: true,
    },
    decidedAt: { type: Date, default: null },
    jackpotAnnouncedAt: { type: Date, default: null },
    packGroupId: { type: String, required: true },
    packIndex: { type: Number, required: true },
    cardIndex: { type: Number, required: true },
    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    battleId: { type: Schema.Types.ObjectId, ref: "Battle", default: null },
    expiresAt: { type: Date, default: null },
    fairnessCommitmentId: {
      type: Schema.Types.ObjectId,
      ref: "PackOpenCommitment",
      default: null,
    },
    fairnessNonce: { type: Number, default: null, min: 0 },
    binderId: { type: Schema.Types.ObjectId, ref: "Binder", default: null },
    isGodpack: { type: Boolean, default: false },
    godpackEventId: {
      type: Schema.Types.ObjectId,
      ref: "GodpackEvent",
      default: null,
    },
    godpackPosition: { type: Number, default: null, min: 1, max: 5 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

PackPullSchema.index({ userId: 1, status: 1 });
PackPullSchema.index({ userId: 1, packGroupId: 1 });
PackPullSchema.index({ userId: 1, createdAt: -1, _id: -1 });
PackPullSchema.index({ boxId: 1, createdAt: -1 });
PackPullSchema.index({ packGroupId: 1, cardIndex: 1 }, { unique: true });
PackPullSchema.index({ status: 1, expiresAt: 1 });
PackPullSchema.index({ battleId: 1, status: 1 });
PackPullSchema.index({ fairnessCommitmentId: 1, fairnessNonce: 1 });
PackPullSchema.index({ userId: 1, binderId: 1 });
PackPullSchema.index({ isGodpack: 1, createdAt: -1 });
PackPullSchema.index({ godpackEventId: 1 });

const PackPull: Model<IPackPull> =
  mongoose.models.PackPull ?? mongoose.model<IPackPull>("PackPull", PackPullSchema);

export default PackPull;
