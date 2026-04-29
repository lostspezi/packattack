import mongoose, { Document, Model, Schema, Types } from "mongoose";
import {
  CHAT_MESSAGE_STATUSES,
  CHAT_ROOM_SLUG,
  type ChatMessageStatus,
  type ChatReactionEmoji,
} from "@/lib/chat-constants";
import {
  CHAT_MAX_REACTION_EMOJI_LENGTH,
  isSupportedChatReactionEmoji,
} from "@/lib/chat-reactions";

interface IChatProfileBadge {
  key: string;
  slug: string | null;
  label: string;
  iconUrl: string | null;
  description: string | null;
  tone: "neutral" | "green" | "gold" | "lilac" | "blue";
  awardedAt: Date | null;
  awardReason: string | null;
  category: string | null;
}

interface IChatAuthorSnapshot {
  name: string;
  username: string | null;
  role: string;
  roleBadge: string | null;
  profileBadges: IChatProfileBadge[];
  avatarUrl: string | null;
  identityVerified: boolean;
  /**
   * Vom Author zum Sendezeitpunkt aktiver Cosmetic-Titel. Snapshot wie der
   * Username — alte Nachrichten behalten den damaligen Titel, auch wenn der
   * User später wechselt.
   */
  title: string | null;
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

interface IChatQuotedMessage {
  messageId: Types.ObjectId;
  body: string;
  authorName: string;
  authorUsername: string | null;
  gif: IChatGif | null;
}

interface IChatHighlightCard {
  name: string;
  image: string | null;
  rarity: string | null;
  coinValue: number;
}

interface IChatGodpackHighlightCard {
  cardId: Types.ObjectId;
  name: string;
  image: string | null;
  rarity: string;
  coinValue: number;
}

interface IChatGodpackHighlight {
  eventId: Types.ObjectId;
  username: string;
  game: string;
  totalCoinValue: number;
  cards: IChatGodpackHighlightCard[];
}

interface IChatBattleInvite {
  battleId: string;
  battleSlug: string;
  boxName: string;
  boxImage: string | null;
  boxGame: string;
  rounds: number;
  playerCount: number;
  mode: string;
  previewCards: string[];
}

interface IChatReaction {
  emoji: ChatReactionEmoji;
  userIds: Types.ObjectId[];
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
  highlightCard: IChatHighlightCard | null;
  godpackHighlight: IChatGodpackHighlight | null;
  battleInvite: IChatBattleInvite | null;
  quotedMessage: IChatQuotedMessage | null;
  status: ChatMessageStatus;
  clientNonce: string;
  mentionTargets: IChatMentionTarget[];
  hasMention: boolean;
  hasLink: boolean;
  hasPII: boolean;
  reactions: IChatReaction[];
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
    slug: { type: String, default: null, maxlength: 80 },
    label: { type: String, required: true, maxlength: 64 },
    iconUrl: { type: String, default: null, maxlength: 300 },
    description: { type: String, default: null, maxlength: 300 },
    tone: {
      type: String,
      enum: ["neutral", "green", "gold", "lilac", "blue"],
      default: "neutral",
    },
    awardedAt: { type: Date, default: null },
    awardReason: { type: String, default: null, maxlength: 200 },
    category: { type: String, default: null, maxlength: 64 },
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
    title: { type: String, default: null, maxlength: 64 },
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

const ChatQuotedMessageSchema = new Schema<IChatQuotedMessage>(
  {
    messageId: {
      type: Schema.Types.ObjectId,
      ref: "ChatMessage",
      required: true,
    },
    body: { type: String, default: "", trim: true, maxlength: 500 },
    authorName: { type: String, required: true, maxlength: 120 },
    authorUsername: { type: String, default: null, maxlength: 64 },
    gif: { type: ChatGifSchema, default: null },
  },
  { _id: false }
);

const ChatHighlightCardSchema = new Schema<IChatHighlightCard>(
  {
    name: { type: String, required: true, maxlength: 200 },
    image: { type: String, default: null, maxlength: 500 },
    rarity: { type: String, default: null, maxlength: 64 },
    coinValue: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const ChatGodpackHighlightCardSchema = new Schema<IChatGodpackHighlightCard>(
  {
    cardId: { type: Schema.Types.ObjectId, ref: "Card", required: true },
    name: { type: String, required: true, maxlength: 200 },
    image: { type: String, default: null, maxlength: 500 },
    rarity: { type: String, required: true, maxlength: 64 },
    coinValue: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const ChatGodpackHighlightSchema = new Schema<IChatGodpackHighlight>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "GodpackEvent", required: true },
    username: { type: String, required: true, maxlength: 64 },
    game: { type: String, required: true, maxlength: 64 },
    totalCoinValue: { type: Number, required: true, min: 1 },
    cards: { type: [ChatGodpackHighlightCardSchema], required: true },
  },
  { _id: false }
);

const ChatBattleInviteSchema = new Schema<IChatBattleInvite>(
  {
    battleId: { type: String, required: true, maxlength: 32 },
    battleSlug: { type: String, required: true, maxlength: 32 },
    boxName: { type: String, required: true, maxlength: 200 },
    boxImage: { type: String, default: null, maxlength: 500 },
    boxGame: { type: String, required: true, maxlength: 64 },
    rounds: { type: Number, required: true },
    playerCount: { type: Number, required: true },
    mode: { type: String, required: true, maxlength: 32 },
    previewCards: { type: [String], default: [] },
  },
  { _id: false }
);

const ChatReactionSchema = new Schema<IChatReaction>(
  {
    emoji: {
      type: String,
      required: true,
      maxlength: CHAT_MAX_REACTION_EMOJI_LENGTH,
      validate: {
        validator: (value: string) => isSupportedChatReactionEmoji(value),
        message: "Invalid reaction emoji",
      },
    },
    userIds: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
      ],
      default: [],
    },
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
    highlightCard: { type: ChatHighlightCardSchema, default: null },
    godpackHighlight: { type: ChatGodpackHighlightSchema, default: null },
    battleInvite: { type: ChatBattleInviteSchema, default: null },
    quotedMessage: { type: ChatQuotedMessageSchema, default: null },
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
    reactions: { type: [ChatReactionSchema], default: [] },
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

const existingChatMessageModel = mongoose.models.ChatMessage as Model<IChatMessage> | undefined;
const cachedSchemaMissingQuotedMessage =
  existingChatMessageModel && !existingChatMessageModel.schema.path("quotedMessage");
const cachedSchemaMissingGodpackHighlight =
  existingChatMessageModel && !existingChatMessageModel.schema.path("godpackHighlight");

if (cachedSchemaMissingQuotedMessage || cachedSchemaMissingGodpackHighlight) {
  delete mongoose.models.ChatMessage;
}

const ChatMessage: Model<IChatMessage> =
  (mongoose.models.ChatMessage as Model<IChatMessage> | undefined) ??
  mongoose.model<IChatMessage>("ChatMessage", ChatMessageSchema);

export default ChatMessage;
