import mongoose, { Schema, Document, Types } from "mongoose";

export type PurchaseStatus =
  | "pending"
  | "completed"
  | "failed"
  | "refunded"
  | "expired";

export interface ICoinPurchase extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  packageId: Types.ObjectId;
  packageSnapshot: {
    name: { de: string; en: string };
    baseCoins: number;
    bonusCoins: number;
    priceEurCents: number;
  };
  status: PurchaseStatus;
  stripeSessionId: string;
  stripePaymentIntentId: string | null;
  stripeInvoiceUrl: string | null;
  stripeReceiptUrl: string | null;
  coinsGranted: number;
  withdrawalConsentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const CoinPurchaseSchema = new Schema<ICoinPurchase>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    packageId: {
      type: Schema.Types.ObjectId,
      ref: "CoinPackage",
      required: true,
    },
    packageSnapshot: {
      name: {
        de: { type: String, required: true },
        en: { type: String, required: true },
      },
      baseCoins: { type: Number, required: true },
      bonusCoins: { type: Number, required: true },
      priceEurCents: { type: Number, required: true },
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded", "expired"],
      default: "pending",
    },
    stripeSessionId: { type: String, required: true, unique: true },
    stripePaymentIntentId: { type: String, default: null },
    stripeInvoiceUrl: { type: String, default: null },
    stripeReceiptUrl: { type: String, default: null },
    coinsGranted: { type: Number, default: 0 },
    withdrawalConsentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

CoinPurchaseSchema.index({ userId: 1, createdAt: -1 });
CoinPurchaseSchema.index({ status: 1 });

const CoinPurchase =
  mongoose.models.CoinPurchase ||
  mongoose.model<ICoinPurchase>("CoinPurchase", CoinPurchaseSchema);

export default CoinPurchase;
