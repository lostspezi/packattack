import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type ShopStatus = "pending" | "approved" | "rejected";

export interface IShopProfile extends Document {
  user: Types.ObjectId;
  companyName: string;
  status: ShopStatus;
  isSmallBusiness: boolean;
  rejectReason: string | null;
  licenseFileId: string | null;
  licenseFileName: string | null;
  submittedAt: Date;
  reviewedBy: Types.ObjectId | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ShopProfileSchema = new Schema<IShopProfile>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    companyName: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    isSmallBusiness: { type: Boolean, default: false },
    rejectReason: { type: String, default: null },
    licenseFileId: { type: String, default: null },
    licenseFileName: { type: String, default: null },
    submittedAt: { type: Date, required: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ShopProfileSchema.index({ status: 1 });

const ShopProfile: Model<IShopProfile> =
  mongoose.models.ShopProfile ??
  mongoose.model<IShopProfile>("ShopProfile", ShopProfileSchema);

export default ShopProfile;
