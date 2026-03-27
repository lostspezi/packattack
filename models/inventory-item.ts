// models/inventory-item.ts
import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IInventoryItem extends Document {
  card: Types.ObjectId;
  shop: Types.ObjectId;
  condition: "Mint" | "Near Mint" | "Lightly Played" | "Moderately Played" | "Heavily Played";
  stock: number;
  ean: string | null;
  sku: string | null;
  notes: string | null;
  netPrice: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryItemSchema = new Schema<IInventoryItem>(
  {
    card: { type: Schema.Types.ObjectId, ref: "Card", required: true },
    shop: { type: Schema.Types.ObjectId, ref: "User", required: true },
    condition: {
      type: String,
      required: true,
      enum: ["Mint", "Near Mint", "Lightly Played", "Moderately Played", "Heavily Played"],
      default: "Near Mint",
    },
    stock: { type: Number, required: true, default: 0, min: 0 },
    ean: { type: String, default: null },
    sku: { type: String, default: null },
    notes: { type: String, default: null },
    netPrice: { type: Number, default: null, min: 0 },
  },
  { timestamps: true }
);

InventoryItemSchema.index({ shop: 1 });
InventoryItemSchema.index({ card: 1 });
InventoryItemSchema.index({ shop: 1, card: 1, condition: 1 }, { unique: true });

const InventoryItem: Model<IInventoryItem> =
  mongoose.models.InventoryItem ??
  mongoose.model<IInventoryItem>("InventoryItem", InventoryItemSchema);

export default InventoryItem;
