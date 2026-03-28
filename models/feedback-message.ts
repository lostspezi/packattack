import mongoose, { Document, Model, Schema, Types } from "mongoose";
import {
  FEEDBACK_MESSAGE_AUTHOR_TYPES,
  type FeedbackMessageAuthorType,
} from "@/lib/feedback-constants";
import type { IFeedbackAttachment } from "@/models/feedback-item";

export interface IFeedbackMessage extends Document {
  _id: Types.ObjectId;
  feedbackId: Types.ObjectId;
  authorUserId: Types.ObjectId | null;
  authorType: FeedbackMessageAuthorType;
  body: string;
  attachments: IFeedbackAttachment[];
  isInternal: boolean;
  editedAt: Date | null;
  editedByUserId: Types.ObjectId | null;
  editCount: number;
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

const FeedbackMessageSchema = new Schema<IFeedbackMessage>(
  {
    feedbackId: {
      type: Schema.Types.ObjectId,
      ref: "FeedbackItem",
      required: true,
      index: true,
    },
    authorUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    authorType: {
      type: String,
      enum: FEEDBACK_MESSAGE_AUTHOR_TYPES,
      required: true,
    },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    attachments: {
      type: [FeedbackAttachmentSchema],
      default: [],
    },
    isInternal: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    editedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    editCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

FeedbackMessageSchema.index({ feedbackId: 1, createdAt: 1 });

const FeedbackMessage: Model<IFeedbackMessage> =
  mongoose.models.FeedbackMessage ??
  mongoose.model<IFeedbackMessage>("FeedbackMessage", FeedbackMessageSchema);

export default FeedbackMessage;
