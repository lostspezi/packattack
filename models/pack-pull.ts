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
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

PackPullSchema.index({ userId: 1, status: 1 });
PackPullSchema.index({ userId: 1, packGroupId: 1 });
PackPullSchema.index({ boxId: 1, createdAt: -1 });
PackPullSchema.index({ packGroupId: 1, cardIndex: 1 }, { unique: true });
PackPullSchema.index({ status: 1, expiresAt: 1 });

const PackPull: Model<IPackPull> =
  mongoose.models.PackPull ?? mongoose.model<IPackPull>("PackPull", PackPullSchema);

export default PackPull;
