import mongoose, { Document, Model, Schema } from "mongoose";

export interface ICard extends Omit<Document, "set"> {
  justTcgId: string;
  name: string;
  game: string;
  set: string;
  setName: string;
  rarity: string;
  image: string | null;
  tcgplayerId: string | null;
  marketPrice: number | null;
  internalPrice: number | null;
  lastPriceUpdate: Date | null;
  variants: Array<{ condition: string; printing: string; price: number }>;
  createdAt: Date;
  updatedAt: Date;
}

const CardSchema = new Schema<ICard>(
  {
    justTcgId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    game: { type: String, required: true },
    set: { type: String, required: true },
    setName: { type: String, required: true },
    rarity: { type: String, required: true },
    image: { type: String, default: null },
    tcgplayerId: { type: String, default: null },
    marketPrice: { type: Number, default: null },
    internalPrice: { type: Number, default: null },
    lastPriceUpdate: { type: Date, default: null },
    variants: [
      {
        condition: { type: String, required: true },
        printing: { type: String, required: true },
        price: { type: Number, required: true },
      },
    ],
  },
  { timestamps: true }
);

CardSchema.index({ game: 1 });
CardSchema.index({ set: 1 });
CardSchema.index({ rarity: 1 });

const Card: Model<ICard> =
  mongoose.models.Card ?? mongoose.model<ICard>("Card", CardSchema);

export default Card;
