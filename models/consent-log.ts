import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IConsentLog extends Document {
  userId: Types.ObjectId;
  type: "tos" | "privacy";
  version: string;
  action: "accepted" | "revoked";
  ip: string;
  userAgent: string;
  createdAt: Date;
}

const ConsentLogSchema = new Schema<IConsentLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["tos", "privacy"], required: true },
    version: { type: String, required: true },
    action: { type: String, enum: ["accepted", "revoked"], required: true },
    ip: { type: String, required: true },
    userAgent: { type: String, required: true },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false }
);

ConsentLogSchema.index({ userId: 1 });

const ConsentLog: Model<IConsentLog> =
  mongoose.models.ConsentLog ??
  mongoose.model<IConsentLog>("ConsentLog", ConsentLogSchema);

export default ConsentLog;
