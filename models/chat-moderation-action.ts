import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { CHAT_ADMIN_ACTIONS, CHAT_ROOM_SLUG, type ChatAdminAction } from "@/lib/chat-constants";

interface IChatActionActorSnapshot {
  name: string;
  username: string | null;
  role: string;
}

interface IChatActionTargetUserSnapshot {
  name: string | null;
  username: string | null;
  email: string | null;
}

interface IChatActionSourceMessageSnapshot {
  messageId: Types.ObjectId | null;
  body: string | null;
  visibleSeq: number | null;
  authorName: string | null;
}

export interface IChatModerationAction extends Document {
  _id: Types.ObjectId;
  roomId: Types.ObjectId;
  roomSlug: string;
  targetType: "message" | "user" | "room";
  targetMessageId: Types.ObjectId | null;
  targetUserId: Types.ObjectId | null;
  actionType: ChatAdminAction;
  reasonCode: string;
  reasonText: string | null;
  durationSeconds: number | null;
  expiresAt: Date | null;
  actorUserId: Types.ObjectId;
  actorSnapshot: IChatActionActorSnapshot;
  targetUserSnapshot: IChatActionTargetUserSnapshot | null;
  sourceMessageSnapshot: IChatActionSourceMessageSnapshot | null;
  reversalOfActionId: Types.ObjectId | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

const ChatActionActorSnapshotSchema = new Schema<IChatActionActorSnapshot>(
  {
    name: { type: String, required: true, maxlength: 120 },
    username: { type: String, default: null, maxlength: 64 },
    role: { type: String, required: true, maxlength: 32 },
  },
  { _id: false }
);

const ChatActionTargetUserSnapshotSchema = new Schema<IChatActionTargetUserSnapshot>(
  {
    name: { type: String, default: null, maxlength: 120 },
    username: { type: String, default: null, maxlength: 64 },
    email: { type: String, default: null, maxlength: 320 },
  },
  { _id: false }
);

const ChatActionSourceMessageSnapshotSchema = new Schema<IChatActionSourceMessageSnapshot>(
  {
    messageId: {
      type: Schema.Types.ObjectId,
      ref: "ChatMessage",
      default: null,
    },
    body: { type: String, default: null, maxlength: 500 },
    visibleSeq: { type: Number, default: null },
    authorName: { type: String, default: null, maxlength: 120 },
  },
  { _id: false }
);

const ChatModerationActionSchema = new Schema<IChatModerationAction>(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: "ChatRoom",
      required: true,
      index: true,
    },
    roomSlug: { type: String, required: true, default: CHAT_ROOM_SLUG },
    targetType: {
      type: String,
      enum: ["message", "user", "room"],
      required: true,
    },
    targetMessageId: {
      type: Schema.Types.ObjectId,
      ref: "ChatMessage",
      default: null,
    },
    targetUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    actionType: {
      type: String,
      enum: CHAT_ADMIN_ACTIONS,
      required: true,
    },
    reasonCode: { type: String, required: true, maxlength: 64 },
    reasonText: { type: String, default: null, maxlength: 300 },
    durationSeconds: { type: Number, default: null },
    expiresAt: { type: Date, default: null },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    actorSnapshot: { type: ChatActionActorSnapshotSchema, required: true },
    targetUserSnapshot: {
      type: ChatActionTargetUserSnapshotSchema,
      default: null,
    },
    sourceMessageSnapshot: {
      type: ChatActionSourceMessageSnapshotSchema,
      default: null,
    },
    reversalOfActionId: {
      type: Schema.Types.ObjectId,
      ref: "ChatModerationAction",
      default: null,
    },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ChatModerationActionSchema.index({ targetMessageId: 1, createdAt: -1 });
ChatModerationActionSchema.index({ targetUserId: 1, createdAt: -1 });
ChatModerationActionSchema.index({ actionType: 1, createdAt: -1 });
ChatModerationActionSchema.index({ reversalOfActionId: 1 });

const ChatModerationAction: Model<IChatModerationAction> =
  mongoose.models.ChatModerationAction ??
  mongoose.model<IChatModerationAction>("ChatModerationAction", ChatModerationActionSchema);

export default ChatModerationAction;
