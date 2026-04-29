import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IGodpackEventCard {
  cardId: Types.ObjectId;
  sourceBoxId: Types.ObjectId;
  name: string;
  image: string | null;
  rarity: string;
  coinValue: number;
  conversionValue: number;
}

/**
 * Snapshot eines Godpack-Pulls. Die Karten sind hier dupliziert, damit ein
 * Re-Render auch dann funktioniert, wenn sich `Card.internalPrice` oder
 * `Box.cards` später ändert. PackPulls referenzieren über `godpackEventId`
 * zurück.
 */
export interface IGodpackEvent extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  username: string;
  game: string;
  triggerCount: number;
  packGroupId: string;
  cards: IGodpackEventCard[];
  totalCoinValue: number;
  fairnessCommitmentId: Types.ObjectId;
  poolSize: number;
  poolFallbackUsed: boolean;
  revealedAt: Date | null;
  chatMessageId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const GodpackEventCardSchema = new Schema<IGodpackEventCard>(
  {
    cardId: { type: Schema.Types.ObjectId, ref: "Card", required: true },
    sourceBoxId: { type: Schema.Types.ObjectId, ref: "Box", required: true },
    name: { type: String, required: true },
    image: { type: String, default: null },
    rarity: { type: String, required: true },
    coinValue: { type: Number, required: true, min: 1 },
    conversionValue: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const GodpackEventSchema = new Schema<IGodpackEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    username: { type: String, required: true, maxlength: 64 },
    game: { type: String, required: true, index: true },
    triggerCount: { type: Number, required: true, min: 1 },
    packGroupId: { type: String, required: true, unique: true },
    cards: { type: [GodpackEventCardSchema], required: true },
    totalCoinValue: { type: Number, required: true, min: 1 },
    fairnessCommitmentId: {
      type: Schema.Types.ObjectId,
      ref: "PackOpenCommitment",
      required: true,
    },
    poolSize: { type: Number, required: true, min: 5 },
    poolFallbackUsed: { type: Boolean, default: false },
    revealedAt: { type: Date, default: null },
    chatMessageId: {
      type: Schema.Types.ObjectId,
      ref: "ChatMessage",
      default: null,
    },
  },
  { timestamps: true },
);

GodpackEventSchema.index({ createdAt: -1 });
GodpackEventSchema.index({ userId: 1, createdAt: -1 });

const GodpackEvent: Model<IGodpackEvent> =
  mongoose.models.GodpackEvent ??
  mongoose.model<IGodpackEvent>("GodpackEvent", GodpackEventSchema);

export default GodpackEvent;
