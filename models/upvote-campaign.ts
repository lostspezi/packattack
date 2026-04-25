import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type UpvoteCampaignStatus = "draft" | "active" | "closed";
export type UpvoteCardSource = "internal" | "justtcg";

export interface IUpvoteCampaignCard {
  _id: Types.ObjectId;
  source: UpvoteCardSource;
  internalCardId: Types.ObjectId | null;
  justTcgId: string | null;
  name: string;
  game: string;
  set: string;
  setName: string;
  rarity: string;
  image: string | null;
  tcgplayerId: string | null;
  position: number;
}

export interface IUpvoteCampaign extends Document {
  title: { de: string; en: string };
  description: { de: string; en: string };
  question: { de: string; en: string };
  status: UpvoteCampaignStatus;
  topN: number;
  cards: Types.DocumentArray<IUpvoteCampaignCard>;
  endsAt: Date | null;
  closedAt: Date | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const UpvoteCampaignCardSchema = new Schema<IUpvoteCampaignCard>(
  {
    source: { type: String, enum: ["internal", "justtcg"], required: true },
    internalCardId: { type: Schema.Types.ObjectId, ref: "Card", default: null },
    justTcgId: { type: String, default: null },
    name: { type: String, required: true },
    game: { type: String, required: true },
    set: { type: String, required: true },
    setName: { type: String, required: true },
    rarity: { type: String, required: true },
    image: { type: String, default: null },
    tcgplayerId: { type: String, default: null },
    position: { type: Number, required: true, min: 0 },
  },
  { _id: true }
);

const UpvoteCampaignSchema = new Schema<IUpvoteCampaign>(
  {
    title: {
      de: { type: String, required: true },
      en: { type: String, required: true },
    },
    description: {
      de: { type: String, default: "" },
      en: { type: String, default: "" },
    },
    question: {
      de: { type: String, required: true },
      en: { type: String, required: true },
    },
    status: {
      type: String,
      enum: ["draft", "active", "closed"],
      default: "draft",
    },
    topN: { type: Number, required: true, min: 1, max: 10 },
    cards: { type: [UpvoteCampaignCardSchema], default: [] },
    endsAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

UpvoteCampaignSchema.index({ status: 1, endsAt: 1 });
UpvoteCampaignSchema.index({ createdAt: -1 });

const UpvoteCampaign: Model<IUpvoteCampaign> =
  mongoose.models.UpvoteCampaign ??
  mongoose.model<IUpvoteCampaign>("UpvoteCampaign", UpvoteCampaignSchema);

export default UpvoteCampaign;
