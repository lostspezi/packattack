import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface INotification extends Document {
  userId: Types.ObjectId;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  cta: { label: string; url: string } | null;
  category: string | null;
  entityType: string | null;
  entityId: string | null;
  meta: Record<string, unknown> | null;
  read: boolean;
  acknowledgedAt: Date | null;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ["info", "success", "warning", "error"],
      required: true,
    },
    cta: {
      type: new Schema(
        {
          label: { type: String, required: true },
          url: { type: String, required: true },
        },
        { _id: false }
      ),
      default: null,
    },
    category: { type: String, default: null },
    entityType: { type: String, default: null },
    entityId: { type: String, default: null },
    meta: { type: Schema.Types.Mixed, default: null },
    read: { type: Boolean, default: false },
    acknowledgedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

NotificationSchema.index({ userId: 1, read: 1 });
NotificationSchema.index({ createdAt: 1 });
NotificationSchema.index({ userId: 1, category: 1, entityType: 1, entityId: 1 });

const Notification: Model<INotification> =
  mongoose.models.Notification ??
  mongoose.model<INotification>("Notification", NotificationSchema);

export default Notification;
