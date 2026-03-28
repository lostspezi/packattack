import mongoose, { Document, Model, Schema, Types } from "mongoose";
import {
  FEEDBACK_KINDS,
  FEEDBACK_PRIORITIES,
  FEEDBACK_SEVERITIES,
  FEEDBACK_SOURCES,
  FEEDBACK_STATUSES,
  FEEDBACK_VISIBILITIES,
  FEEDBACK_WAITING_ON,
  type FeedbackKind,
  type FeedbackPriority,
  type FeedbackSeverity,
  type FeedbackSource,
  type FeedbackStatus,
  type FeedbackVisibility,
  type FeedbackWaitingOn,
} from "@/lib/feedback-constants";

export interface IFeedbackAttachment {
  attachmentId: string;
  filename: string;
  contentType: string;
  size: number;
  uploadedAt: Date;
}

interface IFeedbackContext {
  route: string | null;
  locale: string;
  userAgent: string | null;
  viewportWidth: number | null;
  viewportHeight: number | null;
  releaseId: string | null;
  objectType: string | null;
  objectId: string | null;
}

export interface IFeedbackItem extends Document {
  _id: Types.ObjectId;
  ticketNo: string;
  submitterUserId: Types.ObjectId;
  kind: FeedbackKind;
  title: string;
  description: string;
  status: FeedbackStatus;
  waitingOn: FeedbackWaitingOn;
  priority: FeedbackPriority;
  severity: FeedbackSeverity;
  visibility: FeedbackVisibility;
  source: FeedbackSource;
  areaTags: string[];
  issueTags: string[];
  attachments: IFeedbackAttachment[];
  assignedTo: Types.ObjectId | null;
  duplicateOf: Types.ObjectId | null;
  context: IFeedbackContext;
  firstResponseAt: Date | null;
  closedAt: Date | null;
  lastStaffReplyAt: Date | null;
  lastUserReplyAt: Date | null;
  lastActivityAt: Date;
  reopenCount: number;
  painScore: number;
  createdAt: Date;
  updatedAt: Date;
}

const FeedbackAttachmentSchema = new Schema<IFeedbackAttachment>(
  {
    attachmentId: { type: String, required: true },
    filename: { type: String, required: true, maxlength: 120 },
    contentType: { type: String, required: true, maxlength: 120 },
    size: { type: Number, required: true, min: 1 },
    uploadedAt: { type: Date, required: true },
  },
  { _id: false }
);

const FeedbackContextSchema = new Schema<IFeedbackContext>(
  {
    route: { type: String, default: null },
    locale: { type: String, default: "en" },
    userAgent: { type: String, default: null },
    viewportWidth: { type: Number, default: null },
    viewportHeight: { type: Number, default: null },
    releaseId: { type: String, default: null },
    objectType: { type: String, default: null },
    objectId: { type: String, default: null },
  },
  { _id: false }
);

const FeedbackItemSchema = new Schema<IFeedbackItem>(
  {
    ticketNo: { type: String, required: true, unique: true },
    submitterUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: FEEDBACK_KINDS,
      required: true,
      default: "general_feedback",
    },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    status: {
      type: String,
      enum: FEEDBACK_STATUSES,
      required: true,
      default: "new",
    },
    waitingOn: {
      type: String,
      enum: FEEDBACK_WAITING_ON,
      required: true,
      default: "staff",
    },
    priority: {
      type: String,
      enum: FEEDBACK_PRIORITIES,
      required: true,
      default: "medium",
    },
    severity: {
      type: String,
      enum: FEEDBACK_SEVERITIES,
      required: true,
      default: "minor",
    },
    visibility: {
      type: String,
      enum: FEEDBACK_VISIBILITIES,
      required: true,
      default: "private",
    },
    source: {
      type: String,
      enum: FEEDBACK_SOURCES,
      required: true,
      default: "dashboard",
    },
    areaTags: {
      type: [String],
      default: [],
    },
    issueTags: {
      type: [String],
      default: [],
    },
    attachments: {
      type: [FeedbackAttachmentSchema],
      default: [],
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    duplicateOf: {
      type: Schema.Types.ObjectId,
      ref: "FeedbackItem",
      default: null,
    },
    context: {
      type: FeedbackContextSchema,
      default: () => ({
        route: null,
        locale: "en",
        userAgent: null,
        viewportWidth: null,
        viewportHeight: null,
        releaseId: null,
        objectType: null,
        objectId: null,
      }),
    },
    firstResponseAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    lastStaffReplyAt: { type: Date, default: null },
    lastUserReplyAt: { type: Date, default: null },
    lastActivityAt: { type: Date, default: Date.now, index: true },
    reopenCount: { type: Number, default: 0 },
    painScore: { type: Number, default: 0 },
  },
  { timestamps: true }
);

FeedbackItemSchema.index({ submitterUserId: 1, createdAt: -1 });
FeedbackItemSchema.index({ status: 1, assignedTo: 1, updatedAt: -1 });
FeedbackItemSchema.index({ kind: 1, createdAt: -1 });

const FeedbackItem: Model<IFeedbackItem> =
  mongoose.models.FeedbackItem ??
  mongoose.model<IFeedbackItem>("FeedbackItem", FeedbackItemSchema);

export default FeedbackItem;