import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IBoxCard {
  card: Types.ObjectId;
  weight: number;
  rarity: string;
  stock: number;
}

export interface IBox extends Document {
  name: { de: string; en: string };
  description: { de: string; en: string } | null;
  game: string;
  image: string | null;
  status: "draft" | "published" | "paused" | "archived";
  priceInCoins: number;
  cardsPerPack: number;
  totalPacks: number | null;
  packsOpened: number;
  minStock: number;
  rarityWeights: Array<{ rarity: string; weight: number }>;
  cards: IBoxCard[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BoxSchema = new Schema<IBox>(
  {
    name: {
      de: { type: String, required: true },
      en: { type: String, required: true },
    },
    description: {
      type: new Schema(
        {
          de: { type: String, default: "" },
          en: { type: String, default: "" },
        },
        { _id: false }
      ),
      default: null,
    },
    game: { type: String, required: true },
    image: { type: String, default: null },
    status: {
      type: String,
      enum: ["draft", "published", "paused", "archived"],
      default: "draft",
    },
    priceInCoins: { type: Number, required: true },
    cardsPerPack: { type: Number, required: true },
    totalPacks: { type: Number, default: null },
    packsOpened: { type: Number, default: 0 },
    minStock: { type: Number, default: 5 },
    rarityWeights: [
      {
        rarity: { type: String, required: true },
        weight: { type: Number, required: true, default: 0 },
      },
    ],
    cards: [
      {
        card: { type: Schema.Types.ObjectId, ref: "Card", required: true },
        weight: { type: Number, required: true, default: 1, min: 0.001, max: 1000 },
        rarity: { type: String, required: true },
        stock: { type: Number, required: true, default: 0, min: 0 },
      },
    ],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

BoxSchema.index({ status: 1 });
BoxSchema.index({ game: 1 });

const Box: Model<IBox> =
  mongoose.models.Box ?? mongoose.model<IBox>("Box", BoxSchema);

export default Box;
