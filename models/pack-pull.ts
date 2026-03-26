import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IPackPull extends Document {
  userId: Types.ObjectId;
  boxId: Types.ObjectId;
  cardId: Types.ObjectId;
  rarity: string;
  coinValue: number;
  conversionValue: number;
  status: "claimed" | "converted";
  decidedAt: Date;
  packGroupId: string;
  packIndex: number;
  cardIndex: number;
  ipAddress: string;
  userAgent: string;
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
      enum: ["claimed", "converted"],
      required: true,
    },
    decidedAt: { type: Date, required: true },
    packGroupId: { type: String, required: true },
    packIndex: { type: Number, required: true },
    cardIndex: { type: Number, required: true },
    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

PackPullSchema.index({ userId: 1, status: 1 });
PackPullSchema.index({ userId: 1, packGroupId: 1 });
PackPullSchema.index({ boxId: 1, createdAt: -1 });
PackPullSchema.index({ packGroupId: 1, cardIndex: 1 }, { unique: true });

const PackPull: Model<IPackPull> =
  mongoose.models.PackPull ?? mongoose.model<IPackPull>("PackPull", PackPullSchema);

export default PackPull;
