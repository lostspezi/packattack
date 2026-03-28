import mongoose, { Document, Model, Schema, Types } from "mongoose";
import {
  CHAT_MESSAGE_STATUSES,
  CHAT_ROOM_SLUG,
  type ChatMessageStatus,
} from "@/lib/chat-constants";

interface IChatProfileBadge {
  key: string;
  label: string;
  tone: "neutral" | "green" | "gold" | "lilac" | "blue";
}

interface IChatAuthorSnapshot {
  name: string;
  username: string | null;
  role: string;
  roleBadge: string | null;
  profileBadges: IChatProfileBadge[];
  avatarUrl: string | null;
  identityVerified: boolean;
}

interface IChatModerationSummary {
  provider: string | null;
  action: string | null;
  reasonCodes: string[];
}

interface IChatMentionTarget {
  userId: Types.ObjectId;
  username: string | null;
  name: string;
}

interface IChatGif {
  provider: "giphy";
  id: string;
  title: string;
  rating: string | null;
  previewUrl: string;
  displayUrl: string;
  width: number;
  height: number;
}

export interface IChatMessage extends Document {
  _id: Types.ObjectId;
  roomId: Types.ObjectId;
  roomSlug: string;
  submissionSeq: number;
  visibleSeq: number | null;
  authorUserId: Types.ObjectId | null;
  source: "user" | "moderator" | "admin" | "system";
  authorSnapshot: IChatAuthorSnapshot | null;
  bodyOriginal: string;
  bodyNormalized: string;
  bodyDisplay: string;
  gif: IChatGif | null;
  status: ChatMessageStatus;
  clientNonce: string;
  mentionTargets: IChatMentionTarget[];
  hasMention: boolean;
  hasLink: boolean;
  hasPII: boolean;
  moderation: IChatModerationSummary;
  deletedAt: Date | null;
  deletedByUserId: Types.ObjectId | null;
  deleteReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ChatProfileBadgeSchema = new Schema<IChatProfileBadge>(
  {
    key: { type: String, required: true, maxlength: 64 },
    label: { type: String, required: true, maxlength: 64 },
    tone: {
      type: String,
      enum: ["neutral", "green", "gold", "lilac", "blue"],
      default: "neutral",
    },
  },
  { _id: false }
);

const ChatAuthorSnapshotSchema = new Schema<IChatAuthorSnapshot>(
  {
    name: { type: String, required: true, maxlength: 120 },
    username: { type: String, default: null, maxlength: 64 },
    role: { type: String, required: true, maxlength: 32 },
    roleBadge: { type: String, default: null, maxlength: 32 },
    profileBadges: { type: [ChatProfileBadgeSchema], default: [] },
    avatarUrl: { type: String, default: null, maxlength: 500 },
    identityVerified: { type: Boolean, default: false },
  },
  { _id: false }
);

const ChatModerationSummarySchema = new Schema<IChatModerationSummary>(
  {
    provider: { type: String, default: null, maxlength: 32 },
    action: { type: String, default: null, maxlength: 32 },
    reasonCodes: { type: [String], default: [] },
  },
  { _id: false }
);

const ChatMentionTargetSchema = new Schema<IChatMentionTarget>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    username: { type: String, default: null, maxlength: 64 },
    name: { type: String, required: true, maxlength: 120 },
  },
  { _id: false }
);

const ChatGifSchema = new Schema<IChatGif>(
  {
    provider: {
      type: String,
      enum: ["giphy"],
      default: "giphy",
      required: true,
    },
    id: { type: String, required: true, maxlength: 64 },
    title: { type: String, required: true, maxlength: 300 },
    rating: { type: String, default: null, maxlength: 16 },
    previewUrl: { type: String, required: true, maxlength: 500 },
    displayUrl: { type: String, required: true, maxlength: 500 },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: "ChatRoom",
      required: true,
      index: true,
    },
    roomSlug: { type: String, required: true, default: CHAT_ROOM_SLUG, index: true },
    submissionSeq: { type: Number, required: true },
    visibleSeq: { type: Number, default: null },
    authorUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    source: {
      type: String,
      enum: ["user", "moderator", "admin", "system"],
      default: "user",
    },
    authorSnapshot: { type: ChatAuthorSnapshotSchema, default: null },
    bodyOriginal: { type: String, default: "", trim: true, maxlength: 500 },
    bodyNormalized: { type: String, default: "", trim: true, maxlength: 500 },
    bodyDisplay: { type: String, default: "", trim: true, maxlength: 500 },
    gif: { type: ChatGifSchema, default: null },
    status: {
      type: String,
      enum: CHAT_MESSAGE_STATUSES,
      default: "visible",
      index: true,
    },
    clientNonce: { type: String, required: true, maxlength: 64 },
    mentionTargets: { type: [ChatMentionTargetSchema], default: [] },
    hasMention: { type: Boolean, default: false },
    hasLink: { type: Boolean, default: false },
    hasPII: { type: Boolean, default: false },
    moderation: {
      type: ChatModerationSummarySchema,
      default: () => ({ provider: null, action: null, reasonCodes: [] }),
    },
    deletedAt: { type: Date, default: null },
    deletedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    deleteReason: { type: String, default: null, maxlength: 300 },
  },
  { timestamps: true }
);

ChatMessageSchema.index({ roomId: 1, submissionSeq: 1 }, { unique: true });
ChatMessageSchema.index(
  { roomId: 1, visibleSeq: 1 },
  {
    unique: true,
    partialFilterExpression: {
      visibleSeq: { $type: "number" },
    },
  }
);
ChatMessageSchema.index({ roomId: 1, createdAt: -1 });

const ChatMessage: Model<IChatMessage> =
  mongoose.models.ChatMessage ?? mongoose.model<IChatMessage>("ChatMessage", ChatMessageSchema);

export default ChatMessage;
