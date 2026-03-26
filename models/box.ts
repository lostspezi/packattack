import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IBoxCard {
  card: Types.ObjectId;
  weight: number;
  rarity: string;
  stock: number;
  minStock: number;
}

export interface IBox extends Document {
  name: { de: string; en: string };
  slug: string;
  description: { de: string; en: string } | null;
  game: string;
  image: string | null;
  status: "draft" | "published" | "paused" | "archived";
  priceInCoins: number;
  cardsPerPack: number;
  totalPacks: number | null;
  packsOpened: number;
  coinConversionRate: number;
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
    slug: { type: String, unique: true, sparse: true },
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
    coinConversionRate: { type: Number, default: 50, min: 1, max: 100 },
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
        minStock: { type: Number, required: true, default: 5, min: 0 },
      },
    ],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// Auto-generate unique slug from name
BoxSchema.pre("save", async function () {
  if (this.slug) return;

  const base = (this.name?.en || this.name?.de || "box")
    .toLowerCase()
    .replace(/[äöüß]/g, (c: string) => ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" }[c] ?? c))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  let slug = base;
  let attempt = 0;
  const BoxModel = this.constructor as Model<IBox>;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await BoxModel.findOne({ slug, _id: { $ne: this._id } }).select("_id").lean();
    if (!existing) break;
    attempt++;
    slug = `${base}-${attempt}`;
  }

  this.slug = slug;
});

BoxSchema.index({ status: 1 });
BoxSchema.index({ game: 1 });
BoxSchema.index({ slug: 1 });

const Box: Model<IBox> =
  mongoose.models.Box ?? mongoose.model<IBox>("Box", BoxSchema);

export default Box;
