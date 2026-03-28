import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { CHAT_SOUND_MODES, type ChatSoundMode } from "@/lib/chat-constants";

export interface IChatReadState extends Document {
  _id: Types.ObjectId;
  roomId: Types.ObjectId;
  userId: Types.ObjectId;
  lastSeenVisibleSeq: number;
  lastReadVisibleSeq: number;
  lastMentionSeenSeq: number;
  muted: boolean;
  mutedUntil: Date | null;
  soundMode: ChatSoundMode;
  browserNotifications: boolean;
  lastConnectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ChatReadStateSchema = new Schema<IChatReadState>(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: "ChatRoom",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    lastSeenVisibleSeq: { type: Number, default: 0 },
    lastReadVisibleSeq: { type: Number, default: 0 },
    lastMentionSeenSeq: { type: Number, default: 0 },
    muted: { type: Boolean, default: false },
    mutedUntil: { type: Date, default: null },
    soundMode: {
      type: String,
      enum: CHAT_SOUND_MODES,
      default: "off",
    },
    browserNotifications: { type: Boolean, default: true },
    lastConnectedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ChatReadStateSchema.index({ roomId: 1, userId: 1 }, { unique: true });

const ChatReadState: Model<IChatReadState> =
  mongoose.models.ChatReadState ??
  mongoose.model<IChatReadState>("ChatReadState", ChatReadStateSchema);

export default ChatReadState;
