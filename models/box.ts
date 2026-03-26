import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IBox extends Document {
  name: { de: string; en: string };
  description: { de: string; en: string } | null;
  game: string;
  image: string | null;
  status: "draft" | "published" | "archived";
  priceInCoins: number;
  cardsPerPack: number;
  totalPacks: number | null;
  packsOpened: number;
  rarityWeights: Array<{ rarity: string; weight: number }>;
  cards: Types.ObjectId[];
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
          de: { type: String, required: true },
          en: { type: String, required: true },
        },
        { _id: false }
      ),
      default: null,
    },
    game: { type: String, required: true },
    image: { type: String, default: null },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    priceInCoins: { type: Number, required: true },
    cardsPerPack: { type: Number, required: true },
    totalPacks: { type: Number, default: null },
    packsOpened: { type: Number, default: 0 },
    rarityWeights: [
      {
        rarity: { type: String, required: true },
        weight: { type: Number, required: true },
      },
    ],
    cards: [{ type: Schema.Types.ObjectId, ref: "Card" }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

BoxSchema.index({ status: 1 });
BoxSchema.index({ game: 1 });

const Box: Model<IBox> =
  mongoose.models.Box ?? mongoose.model<IBox>("Box", BoxSchema);

export default Box;
