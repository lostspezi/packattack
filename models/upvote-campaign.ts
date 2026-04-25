import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type UpvoteCampaignStatus = "draft" | "active" | "closed";
export type UpvoteItemKind = "card" | "option" | "box";
export type UpvoteCardSource = "internal" | "justtcg";

export interface IUpvoteCampaignItem {
  _id: Types.ObjectId;
  kind: UpvoteItemKind;
  /** Bilingual primary display label. For cards/boxes copied from the source. */
  label: { de: string; en: string };
  /** Optional bilingual secondary text. Shown only for `option` items today. */
  description: { de: string; en: string };
  image: string | null;
  position: number;

  // card-specific (kind === "card")
  source: UpvoteCardSource | null;
  internalCardId: Types.ObjectId | null;
  justTcgId: string | null;
  game: string | null;
  set: string | null;
  setName: string | null;
  rarity: string | null;
  tcgplayerId: string | null;

  // box-specific (kind === "box")
  boxId: Types.ObjectId | null;
  boxSlug: string | null;
}

export interface IUpvoteCampaign extends Document {
  title: { de: string; en: string };
  description: { de: string; en: string };
  question: { de: string; en: string };
  status: UpvoteCampaignStatus;
  topN: number;
  items: Types.DocumentArray<IUpvoteCampaignItem>;
  endsAt: Date | null;
  closedAt: Date | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const UpvoteCampaignItemSchema = new Schema<IUpvoteCampaignItem>(
  {
    kind: { type: String, enum: ["card", "option", "box"], required: true },
    label: {
      de: { type: String, required: true },
      en: { type: String, required: true },
    },
    description: {
      de: { type: String, default: "" },
      en: { type: String, default: "" },
    },
    image: { type: String, default: null },
    position: { type: Number, required: true, min: 0 },

    source: { type: String, enum: ["internal", "justtcg", null], default: null },
    internalCardId: { type: Schema.Types.ObjectId, ref: "Card", default: null },
    justTcgId: { type: String, default: null },
    game: { type: String, default: null },
    set: { type: String, default: null },
    setName: { type: String, default: null },
    rarity: { type: String, default: null },
    tcgplayerId: { type: String, default: null },

    boxId: { type: Schema.Types.ObjectId, ref: "Box", default: null },
    boxSlug: { type: String, default: null },
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
    items: { type: [UpvoteCampaignItemSchema], default: [] },
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
