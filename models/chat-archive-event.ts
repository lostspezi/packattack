import mongoose, { Document, Model, Schema, Types } from "mongoose";
import {
  CHAT_ARCHIVE_EVENT_TYPES,
  CHAT_ROOM_SLUG,
  type ChatArchiveEventType,
} from "@/lib/chat-constants";

export interface IChatArchiveEvent extends Document {
  _id: Types.ObjectId;
  roomId: Types.ObjectId;
  roomSlug: string;
  eventType: ChatArchiveEventType;
  messageId: Types.ObjectId | null;
  submissionSeq: number | null;
  actorUserId: Types.ObjectId | null;
  payload: Record<string, unknown>;
  createdAt: Date;
}

const ChatArchiveEventSchema = new Schema<IChatArchiveEvent>(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: "ChatRoom",
      required: true,
      index: true,
    },
    roomSlug: { type: String, required: true, default: CHAT_ROOM_SLUG },
    eventType: {
      type: String,
      enum: CHAT_ARCHIVE_EVENT_TYPES,
      required: true,
      index: true,
    },
    messageId: {
      type: Schema.Types.ObjectId,
      ref: "ChatMessage",
      default: null,
    },
    submissionSeq: { type: Number, default: null, index: true },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    payload: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ChatArchiveEventSchema.index({ roomId: 1, createdAt: -1 });

const ChatArchiveEvent: Model<IChatArchiveEvent> =
  mongoose.models.ChatArchiveEvent ??
  mongoose.model<IChatArchiveEvent>("ChatArchiveEvent", ChatArchiveEventSchema);

export default ChatArchiveEvent;
