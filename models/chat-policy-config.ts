import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { CHAT_LINK_ALLOWED_ROLES } from "@/lib/chat-constants";

export interface IChatPolicyConfig extends Document {
  _id: Types.ObjectId;
  roomSlug: string;
  provider: "none" | "local" | "sightengine";
  linkPolicy: "admins_only";
  linkAllowedRoles: string[];
  mildProfanityMask: number;
  targetedAbuseHold: number;
  severeAbuseBlock: number;
  piiPolicy: "block";
  unsafeLinkPolicy: "block";
  newUserCooldownSeconds: number;
  standardCooldownSeconds: number;
  slowModeSecondsDefault: number;
  updatedByUserId: Types.ObjectId | null;
  updatedAt: Date;
  createdAt: Date;
}

const ChatPolicyConfigSchema = new Schema<IChatPolicyConfig>(
  {
    roomSlug: { type: String, required: true, unique: true, index: true },
    provider: {
      type: String,
      enum: ["none", "local", "sightengine"],
      default: "local",
    },
    linkPolicy: {
      type: String,
      enum: ["admins_only"],
      default: "admins_only",
    },
    linkAllowedRoles: {
      type: [String],
      default: [...CHAT_LINK_ALLOWED_ROLES],
    },
    mildProfanityMask: { type: Number, default: 0.65 },
    targetedAbuseHold: { type: Number, default: 0.55 },
    severeAbuseBlock: { type: Number, default: 0.8 },
    piiPolicy: {
      type: String,
      enum: ["block"],
      default: "block",
    },
    unsafeLinkPolicy: {
      type: String,
      enum: ["block"],
      default: "block",
    },
    newUserCooldownSeconds: { type: Number, default: 6 },
    standardCooldownSeconds: { type: Number, default: 2 },
    slowModeSecondsDefault: { type: Number, default: 5 },
    updatedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

const ChatPolicyConfig: Model<IChatPolicyConfig> =
  mongoose.models.ChatPolicyConfig ??
  mongoose.model<IChatPolicyConfig>("ChatPolicyConfig", ChatPolicyConfigSchema);

export default ChatPolicyConfig;


