import mongoose, { Document, Model, Schema, Types } from "mongoose";
import {
  FEEDBACK_AUDIT_VISIBILITIES,
  FEEDBACK_MESSAGE_AUTHOR_TYPES,
  type FeedbackAuditVisibility,
  type FeedbackMessageAuthorType,
} from "@/lib/feedback-constants";

export interface IFeedbackAuditLog extends Document {
  _id: Types.ObjectId;
  feedbackId: Types.ObjectId;
  actorUserId: Types.ObjectId | null;
  actorType: FeedbackMessageAuthorType;
  action: string;
  message: string;
  visibility: FeedbackAuditVisibility;
  field: string | null;
  before: unknown;
  after: unknown;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

const FeedbackAuditLogSchema = new Schema<IFeedbackAuditLog>(
  {
    feedbackId: {
      type: Schema.Types.ObjectId,
      ref: "FeedbackItem",
      required: true,
      index: true,
    },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    actorType: {
      type: String,
      enum: FEEDBACK_MESSAGE_AUTHOR_TYPES,
      required: true,
    },
    action: { type: String, required: true, trim: true, maxlength: 64 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    visibility: {
      type: String,
      enum: FEEDBACK_AUDIT_VISIBILITIES,
      required: true,
      default: "public",
    },
    field: { type: String, default: null },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

FeedbackAuditLogSchema.index({ feedbackId: 1, createdAt: -1 });

const FeedbackAuditLog: Model<IFeedbackAuditLog> =
  mongoose.models.FeedbackAuditLog ??
  mongoose.model<IFeedbackAuditLog>("FeedbackAuditLog", FeedbackAuditLogSchema);

export default FeedbackAuditLog;
