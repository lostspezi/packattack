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
  variants: Array<{
    condition: string;
    printing: string;
    price: number;
    priceHistory?: Array<{ p: number; t: number }>;
    priceHistory30d?: Array<{ p: number; t: number }>;
    priceChange7d?: number | null;
    priceChange30d?: number | null;
    priceChange90d?: number | null;
    avgPrice?: number | null;
    avgPrice30d?: number | null;
    minPrice7d?: number | null;
    maxPrice7d?: number | null;
  }>;
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
        priceHistory: { type: [{ p: Number, t: Number }], default: undefined },
        priceHistory30d: { type: [{ p: Number, t: Number }], default: undefined },
        priceChange7d: { type: Number, default: null },
        priceChange30d: { type: Number, default: null },
        priceChange90d: { type: Number, default: null },
        avgPrice: { type: Number, default: null },
        avgPrice30d: { type: Number, default: null },
        minPrice7d: { type: Number, default: null },
        maxPrice7d: { type: Number, default: null },
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
