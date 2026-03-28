import mongoose, { Document, Model, Schema, Types } from "mongoose";
import {
  CHAT_ROOM_MODES,
  CHAT_ROOM_SLUG,
  CHAT_ROOM_TITLE,
  CHAT_TRUST_TIERS,
  type ChatRoomMode,
  type ChatTrustTier,
} from "@/lib/chat-constants";

export interface IChatRoom extends Document {
  _id: Types.ObjectId;
  slug: string;
  title: string;
  description: string;
  mode: ChatRoomMode;
  slowModeSeconds: number;
  requireEmailVerifiedToPost: boolean;
  minTrustTier: ChatTrustTier;
  submissionSeq: number;
  visibleSeq: number;
  rulesVersion: number;
  lastVisibleMessageAt: Date | null;
  lastVisibleMessageId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const ChatRoomSchema = new Schema<IChatRoom>(
  {
    slug: { type: String, required: true, unique: true, default: CHAT_ROOM_SLUG },
    title: { type: String, required: true, default: CHAT_ROOM_TITLE },
    description: {
      type: String,
      default:
        "Der öffentliche Live-Chat für alle verifizierten Nutzer und Admins.",
    },
    mode: {
      type: String,
      enum: CHAT_ROOM_MODES,
      default: "open",
    },
    slowModeSeconds: { type: Number, default: 0, min: 0, max: 300 },
    requireEmailVerifiedToPost: { type: Boolean, default: true },
    minTrustTier: {
      type: String,
      enum: CHAT_TRUST_TIERS,
      default: "new",
    },
    submissionSeq: { type: Number, default: 0 },
    visibleSeq: { type: Number, default: 0 },
    rulesVersion: { type: Number, default: 1 },
    lastVisibleMessageAt: { type: Date, default: null },
    lastVisibleMessageId: {
      type: Schema.Types.ObjectId,
      ref: "ChatMessage",
      default: null,
    },
  },
  { timestamps: true }
);

const ChatRoom: Model<IChatRoom> =
  mongoose.models.ChatRoom ?? mongoose.model<IChatRoom>("ChatRoom", ChatRoomSchema);

export default ChatRoom;
