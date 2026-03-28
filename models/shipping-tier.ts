import mongoose, { Document, Model, Schema } from "mongoose";

export interface IShippingTier extends Document {
  country: "DE" | "AT" | "CH";
  minCards: number;
  maxCards: number;
  costCents: number;
  costCoins: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ShippingTierSchema = new Schema<IShippingTier>(
  {
    country: { type: String, enum: ["DE", "AT", "CH"], required: true },
    minCards: { type: Number, required: true, min: 1 },
    maxCards: { type: Number, required: true, min: 1 },
    costCents: { type: Number, required: true, min: 0 },
    costCoins: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ShippingTierSchema.index({ country: 1, minCards: 1 });

const ShippingTier: Model<IShippingTier> =
  mongoose.models.ShippingTier ?? mongoose.model<IShippingTier>("ShippingTier", ShippingTierSchema);

export default ShippingTier;
