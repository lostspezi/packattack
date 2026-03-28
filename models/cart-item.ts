import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface ICartItem extends Document {
  userId: Types.ObjectId;
  cardId: Types.ObjectId;
  boxId: Types.ObjectId;
  pullId: Types.ObjectId;
  rarity: string;
  conversionValue: number;
  status: "reserved" | "checked_out" | "expired";
  expiresAt: Date;
  warningNotified: boolean;
  orderId: Types.ObjectId | null;
  createdAt: Date;
}

const CartItemSchema = new Schema<ICartItem>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    cardId: { type: Schema.Types.ObjectId, ref: "Card", required: true },
    boxId: { type: Schema.Types.ObjectId, ref: "Box", required: true },
    pullId: { type: Schema.Types.ObjectId, ref: "PackPull", required: true },
    rarity: { type: String, required: true },
    conversionValue: { type: Number, required: true },
    status: {
      type: String,
      enum: ["reserved", "checked_out", "expired"],
      default: "reserved",
      required: true,
    },
    expiresAt: { type: Date, required: true },
    warningNotified: { type: Boolean, default: false },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

CartItemSchema.index({ userId: 1, status: 1 });
CartItemSchema.index({ expiresAt: 1, status: 1 });
CartItemSchema.index({ pullId: 1 }, { unique: true });

const CartItem: Model<ICartItem> =
  mongoose.models.CartItem ?? mongoose.model<ICartItem>("CartItem", CartItemSchema);

export default CartItem;
