import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type AchievementCategory =
  | "level"
  | "progression"
  | "battle"
  | "economy"
  | "social"
  | "event";

export type AchievementTriggerType = "level" | "counter" | "once" | "manual";

export type AchievementCounterMetric =
  | "boxesOpened"
  | "cardsConverted"
  | "battlesPlayed"
  | "battlesWon"
  | "coinsSpent"
  | "loginDays";

export type AchievementOnceEvent =
  | "tour_completed"
  | "first_pack_opened"
  | "first_battle"
  | "first_purchase";

export interface AchievementLevelTrigger {
  type: "level";
  params: { level: number };
}

export interface AchievementCounterTrigger {
  type: "counter";
  params: { metric: AchievementCounterMetric; target: number };
}

export interface AchievementOnceTrigger {
  type: "once";
  params: { event: AchievementOnceEvent };
}

export interface AchievementManualTrigger {
  type: "manual";
  params: Record<string, never>;
}

export type AchievementTrigger =
  | AchievementLevelTrigger
  | AchievementCounterTrigger
  | AchievementOnceTrigger
  | AchievementManualTrigger;

export type AchievementRewardType =
  | "coins"
  | "convert_multiplier"
  | "unlock_box"
  | "cosmetic"
  | "grant_badge";

export interface AchievementReward {
  type: AchievementRewardType;
  // Shape depends on type. Runtime-validiert in rewards-Engine (Phase 4).
  //  - coins: { amount: number }
  //  - convert_multiplier: { multiplier: number }
  //  - unlock_box: { boxSlug: string }
  //  - cosmetic: { slot: "title" | "frame" | "chat_color"; value: string }
  //  - grant_badge: { badgeKey: string }
  params: Record<string, unknown>;
}

export interface IAchievement extends Document {
  _id: Types.ObjectId;
  key: string;
  titleKey: string;
  descriptionKey: string;
  iconImageId: Types.ObjectId | null;
  category: AchievementCategory;
  hidden: boolean;
  active: boolean;
  sortOrder: number;
  trigger: AchievementTrigger;
  rewards: AchievementReward[];
  createdAt: Date;
  updatedAt: Date;
}

const RewardSchema = new Schema<AchievementReward>(
  {
    type: {
      type: String,
      enum: ["coins", "convert_multiplier", "unlock_box", "cosmetic", "grant_badge"],
      required: true,
    },
    params: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const TriggerSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["level", "counter", "once", "manual"],
      required: true,
    },
    params: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const AchievementSchema = new Schema<IAchievement>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 64,
    },
    titleKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    descriptionKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    iconImageId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    category: {
      type: String,
      enum: ["level", "progression", "battle", "economy", "social", "event"],
      default: "progression",
      index: true,
    },
    hidden: { type: Boolean, default: false },
    active: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
    trigger: { type: TriggerSchema, required: true },
    rewards: { type: [RewardSchema], default: [] },
  },
  { timestamps: true }
);

AchievementSchema.index({ active: 1, "trigger.type": 1 });
AchievementSchema.index({ "trigger.type": 1, "trigger.params.metric": 1 });

const Achievement: Model<IAchievement> =
  mongoose.models.Achievement ??
  mongoose.model<IAchievement>("Achievement", AchievementSchema);

export default Achievement;
