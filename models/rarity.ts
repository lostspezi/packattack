import mongoose, { Document, Model, Schema } from "mongoose";

export interface IRarity extends Document {
  name: string;
  game: string;
}

const RaritySchema = new Schema<IRarity>(
  {
    name: { type: String, required: true },
    game: { type: String, required: true },
  },
  { timestamps: true }
);

RaritySchema.index({ game: 1, name: 1 }, { unique: true });

const Rarity: Model<IRarity> =
  mongoose.models.Rarity ?? mongoose.model<IRarity>("Rarity", RaritySchema);

export default Rarity;
