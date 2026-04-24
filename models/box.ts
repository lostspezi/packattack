import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type CardCondition = "Mint" | "Near Mint" | "Lightly Played" | "Moderately Played" | "Heavily Played";

export const CONDITION_ORDER: CardCondition[] = ["Mint", "Near Mint", "Lightly Played", "Moderately Played", "Heavily Played"];

export interface IBoxCard {
  card: Types.ObjectId;
  weight: number;
  rarity: string;
  stock: number;
  minStock: number;
  conditions: CardCondition[];
  isSubstitute: boolean;
  originalCard: Types.ObjectId | null;
}

export interface IBoxPausedReason {
  cardId: Types.ObjectId;
  cardName: string;
  at: Date;
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
  battleFeePerRound: number;
  /**
   * Marks the box used by the onboarding tour. At most one box should carry
   * this flag at a time — see the partial unique index below.
   */
  isTutorial: boolean;
  /**
   * Optional gate: wenn gesetzt, darf nur ein User mit level >= requiredLevel
   * die Box öffnen. Null oder undefined = keine Beschränkung.
   */
  requiredLevel: number | null;
  /** Set when the box was auto-paused because a card hit stock 0. Cleared on reactivate. */
  pausedAt: Date | null;
  pausedReason: IBoxPausedReason | null;
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
        conditions: { type: [String], enum: ["Mint", "Near Mint", "Lightly Played", "Moderately Played", "Heavily Played"], default: ["Near Mint"] },
        isSubstitute: { type: Boolean, default: false },
        originalCard: { type: Schema.Types.ObjectId, ref: "Card", default: null },
      },
    ],
    battleFeePerRound: { type: Number, default: 0, min: 0 },
    isTutorial: { type: Boolean, default: false },
    requiredLevel: { type: Number, default: null, min: 1, max: 100 },
    pausedAt: { type: Date, default: null },
    pausedReason: {
      type: new Schema<IBoxPausedReason>(
        {
          cardId: { type: Schema.Types.ObjectId, ref: "Card", required: true },
          cardName: { type: String, required: true },
          at: { type: Date, required: true },
        },
        { _id: false }
      ),
      default: null,
    },
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
// Partial unique index: only one box may have isTutorial=true at a time.
BoxSchema.index(
  { isTutorial: 1 },
  { unique: true, partialFilterExpression: { isTutorial: true } }
);

const Box: Model<IBox> =
  mongoose.models.Box ?? mongoose.model<IBox>("Box", BoxSchema);

export default Box;
