import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { CHAT_REPORT_CATEGORIES, CHAT_ROOM_SLUG, type ChatReportCategory } from "@/lib/chat-constants";

export interface IChatReport extends Document {
  _id: Types.ObjectId;
  roomId: Types.ObjectId;
  roomSlug: string;
  messageId: Types.ObjectId;
  reporterUserId: Types.ObjectId;
  category: ChatReportCategory;
  note: string | null;
  status: "open" | "dismissed" | "actioned";
  resolutionActionId: Types.ObjectId | null;
  resolvedByUserId: Types.ObjectId | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ChatReportSchema = new Schema<IChatReport>(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: "ChatRoom",
      required: true,
      index: true,
    },
    roomSlug: { type: String, required: true, default: CHAT_ROOM_SLUG },
    messageId: {
      type: Schema.Types.ObjectId,
      ref: "ChatMessage",
      required: true,
      index: true,
    },
    reporterUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: CHAT_REPORT_CATEGORIES,
      required: true,
    },
    note: { type: String, default: null, maxlength: 500 },
    status: {
      type: String,
      enum: ["open", "dismissed", "actioned"],
      default: "open",
      index: true,
    },
    resolutionActionId: {
      type: Schema.Types.ObjectId,
      ref: "ChatModerationAction",
      default: null,
    },
    resolvedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ChatReportSchema.index({ reporterUserId: 1, messageId: 1 }, { unique: true });

const ChatReport: Model<IChatReport> =
  mongoose.models.ChatReport ?? mongoose.model<IChatReport>("ChatReport", ChatReportSchema);

export default ChatReport;
