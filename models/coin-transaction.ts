import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface ICoinTransaction extends Document {
  userId: Types.ObjectId;
  amount: number;
  type: "admin_grant" | "admin_deduct" | "pack_purchase" | "card_conversion";
  reason: string | null;
  relatedPullId: Types.ObjectId | null;
  relatedBoxId: Types.ObjectId | null;
  performedBy: Types.ObjectId | null;
  createdAt: Date;
}

const CoinTransactionSchema = new Schema<ICoinTransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    type: {
      type: String,
      enum: ["admin_grant", "admin_deduct", "pack_purchase", "card_conversion"],
      required: true,
    },
    reason: { type: String, default: null },
    relatedPullId: { type: Schema.Types.ObjectId, ref: "PackPull", default: null },
    relatedBoxId: { type: Schema.Types.ObjectId, ref: "Box", default: null },
    performedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

CoinTransactionSchema.index({ userId: 1, createdAt: -1 });
CoinTransactionSchema.index({ type: 1 });

const CoinTransaction: Model<ICoinTransaction> =
  mongoose.models.CoinTransaction ?? mongoose.model<ICoinTransaction>("CoinTransaction", CoinTransactionSchema);

export default CoinTransaction;
