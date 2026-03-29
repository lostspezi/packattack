import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface ICoinTransaction extends Document {
  userId: Types.ObjectId;
  amount: number;
  type: "admin_grant" | "admin_deduct" | "pack_purchase" | "card_conversion" | "coin_purchase" | "shipping_payment" | "reservation_expired" | "battle_entry" | "battle_card_conversion" | "battle_refund";
  reason: string | null;
  relatedPullId: Types.ObjectId | null;
  relatedBoxId: Types.ObjectId | null;
  relatedPurchaseId: Types.ObjectId | null;
  relatedOrderId: Types.ObjectId | null;
  relatedBattleId: Types.ObjectId | null;
  performedBy: Types.ObjectId | null;
  createdAt: Date;
}

const CoinTransactionSchema = new Schema<ICoinTransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    type: {
      type: String,
      enum: ["admin_grant", "admin_deduct", "pack_purchase", "card_conversion", "coin_purchase", "shipping_payment", "reservation_expired", "battle_entry", "battle_card_conversion", "battle_refund"],
      required: true,
    },
    reason: { type: String, default: null },
    relatedPullId: { type: Schema.Types.ObjectId, ref: "PackPull", default: null },
    relatedBoxId: { type: Schema.Types.ObjectId, ref: "Box", default: null },
    relatedPurchaseId: { type: Schema.Types.ObjectId, ref: "CoinPurchase", default: null },
    relatedOrderId: { type: Schema.Types.ObjectId, ref: "Order", default: null },
    relatedBattleId: { type: Schema.Types.ObjectId, ref: "Battle", default: null },
    performedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

CoinTransactionSchema.index({ userId: 1, createdAt: -1 });
CoinTransactionSchema.index({ type: 1 });

const CoinTransaction: Model<ICoinTransaction> =
  mongoose.models.CoinTransaction ?? mongoose.model<ICoinTransaction>("CoinTransaction", CoinTransactionSchema);

export default CoinTransaction;
