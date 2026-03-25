import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IPlatformSettings extends Document {
  tosVersion: string;
  privacyVersion: string;
  updatedAt: Date;
  updatedBy: Types.ObjectId | null;
}

const PlatformSettingsSchema = new Schema<IPlatformSettings>(
  {
    tosVersion: { type: String, required: true },
    privacyVersion: { type: String, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

const PlatformSettings: Model<IPlatformSettings> =
  mongoose.models.PlatformSettings ??
  mongoose.model<IPlatformSettings>("PlatformSettings", PlatformSettingsSchema);

export default PlatformSettings;
