import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IFulfillment {
  shopId: Types.ObjectId | null;
  items: Array<{ cardId: Types.ObjectId; rarity: string }>;
  status: "pending" | "processing" | "shipped" | "delivered";
  trackingNumber: string | null;
  shippedAt: Date | null;
}

export interface IOrderItem {
  cartItemId: Types.ObjectId;
  cardId: Types.ObjectId;
  rarity: string;
}

export interface IShippingAddress {
  name: string;
  street: string;
  city: string;
  zip: string;
  country: "DE" | "AT" | "CH";
}

export interface IOrder extends Document {
  userId: Types.ObjectId;
  orderNumber: string;
  items: IOrderItem[];
  shippingAddress: IShippingAddress;
  paymentMethod: "coins" | "stripe";
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  shippingCostCents: number;
  shippingCostCoins: number | null;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  fulfillments: IFulfillment[];
  status: "pending_payment" | "paid" | "processing" | "shipped" | "delivered" | "cancelled";
  createdAt: Date;
  updatedAt: Date;
}

const FulfillmentSchema = new Schema<IFulfillment>(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    items: [
      {
        cardId: { type: Schema.Types.ObjectId, ref: "Card", required: true },
        rarity: { type: String, required: true },
      },
    ],
    status: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered"],
      default: "pending",
    },
    trackingNumber: { type: String, default: null },
    shippedAt: { type: Date, default: null },
  },
  { _id: true }
);

const ShippingAddressSchema = new Schema<IShippingAddress>(
  {
    name: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    zip: { type: String, required: true },
    country: { type: String, enum: ["DE", "AT", "CH"], required: true },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    orderNumber: { type: String, required: true, unique: true },
    items: [
      {
        cartItemId: { type: Schema.Types.ObjectId, ref: "CartItem", required: true },
        cardId: { type: Schema.Types.ObjectId, ref: "Card", required: true },
        rarity: { type: String, required: true },
      },
    ],
    shippingAddress: { type: ShippingAddressSchema, required: true },
    paymentMethod: { type: String, enum: ["coins", "stripe"], required: true },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    shippingCostCents: { type: Number, required: true },
    shippingCostCoins: { type: Number, default: null },
    stripeSessionId: { type: String, default: null },
    stripePaymentIntentId: { type: String, default: null },
    fulfillments: { type: [FulfillmentSchema], default: [] },
    status: {
      type: String,
      enum: ["pending_payment", "paid", "processing", "shipped", "delivered", "cancelled"],
      default: "pending_payment",
    },
  },
  { timestamps: true }
);

OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ orderNumber: 1 }, { unique: true });
OrderSchema.index({ "fulfillments.shopId": 1, "fulfillments.status": 1 });
OrderSchema.index({ status: 1 });

const Order: Model<IOrder> =
  mongoose.models.Order ?? mongoose.model<IOrder>("Order", OrderSchema);

export default Order;
