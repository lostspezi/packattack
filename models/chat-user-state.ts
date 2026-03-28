import mongoose, { Document, Model, Schema, Types } from "mongoose";
import {
  CHAT_RESTRICTION_TYPES,
  CHAT_TRUST_TIERS,
  CHAT_USER_STATUSES,
  type ChatRestrictionType,
  type ChatTrustTier,
  type ChatUserStatus,
} from "@/lib/chat-constants";

interface IActiveChatRestriction {
  type: ChatRestrictionType;
  reason: string | null;
  sourceMessageId: Types.ObjectId | null;
  sourceMessageBody: string | null;
  sourceVisibleSeq: number | null;
  actorUserId: Types.ObjectId | null;
  actorName: string | null;
  imposedAt: Date | null;
  expiresAt: Date | null;
}

export interface IChatUserState extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  trustTier: ChatTrustTier;
  chatStatus: ChatUserStatus;
  timeoutUntil: Date | null;
  banReason: string | null;
  activeRestriction: IActiveChatRestriction | null;
  strikeCount: number;
  successfulMessageCount: number;
  lastSubmittedAt: Date | null;
  lastVisibleAt: Date | null;
  duplicateWindowHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ActiveChatRestrictionSchema = new Schema<IActiveChatRestriction>(
  {
    type: {
      type: String,
      enum: CHAT_RESTRICTION_TYPES,
      required: true,
    },
    reason: { type: String, default: null, maxlength: 300 },
    sourceMessageId: {
      type: Schema.Types.ObjectId,
      ref: "ChatMessage",
      default: null,
    },
    sourceMessageBody: { type: String, default: null, maxlength: 500 },
    sourceVisibleSeq: { type: Number, default: null },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    actorName: { type: String, default: null, maxlength: 120 },
    imposedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
  },
  { _id: false }
);

const ChatUserStateSchema = new Schema<IChatUserState>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    trustTier: {
      type: String,
      enum: CHAT_TRUST_TIERS,
      default: "new",
    },
    chatStatus: {
      type: String,
      enum: CHAT_USER_STATUSES,
      default: "active",
    },
    timeoutUntil: { type: Date, default: null },
    banReason: { type: String, default: null, maxlength: 300 },
    activeRestriction: { type: ActiveChatRestrictionSchema, default: null },
    strikeCount: { type: Number, default: 0 },
    successfulMessageCount: { type: Number, default: 0 },
    lastSubmittedAt: { type: Date, default: null },
    lastVisibleAt: { type: Date, default: null },
    duplicateWindowHash: { type: String, default: null, maxlength: 128 },
  },
  { timestamps: true }
);

ChatUserStateSchema.index({ "activeRestriction.type": 1, updatedAt: -1 });

const ChatUserState: Model<IChatUserState> =
  mongoose.models.ChatUserState ??
  mongoose.model<IChatUserState>("ChatUserState", ChatUserStateSchema);

export default ChatUserState;
