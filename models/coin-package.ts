import mongoose, { Schema, Document, Types } from "mongoose";

export interface ICoinPackage extends Document {
  _id: Types.ObjectId;
  name: { de: string; en: string };
  slug: string;
  baseCoins: number;
  bonusCoins: number;
  priceEurCents: number;
  stripePriceId: string | null;
  stripeProductId: string | null;
  isActive: boolean;
  sortOrder: number;
  icon: string | null;
  highlightLabel: { de: string; en: string } | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CoinPackageSchema = new Schema<ICoinPackage>(
  {
    name: {
      de: { type: String, required: true },
      en: { type: String, required: true },
    },
    slug: { type: String, required: true, unique: true },
    baseCoins: { type: Number, required: true, min: 1, max: 1000 },
    bonusCoins: { type: Number, default: 0, min: 0 },
    priceEurCents: { type: Number, required: true, min: 100 },
    stripePriceId: { type: String, default: null },
    stripeProductId: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    icon: { type: String, default: null },
    highlightLabel: {
      type: {
        de: { type: String },
        en: { type: String },
      },
      default: null,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

CoinPackageSchema.virtual("totalCoins").get(function () {
  return this.baseCoins + this.bonusCoins;
});

CoinPackageSchema.set("toJSON", { virtuals: true });
CoinPackageSchema.set("toObject", { virtuals: true });

CoinPackageSchema.index({ isActive: 1, sortOrder: 1 });

const CoinPackage =
  mongoose.models.CoinPackage ||
  mongoose.model<ICoinPackage>("CoinPackage", CoinPackageSchema);

export default CoinPackage;
