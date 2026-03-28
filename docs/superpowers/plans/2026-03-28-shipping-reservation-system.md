# Shipping & Reservation System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the permanent card inventory with a 6h-reservation cart system, add checkout with shipping (coins or Stripe), multi-shop fulfillment, and BullMQ background workers for auto-expiry.

**Architecture:** Claimed cards become `CartItem` documents with a 6-hour TTL. A checkout flow creates `Order` documents with embedded `Fulfillment` subdocs assigned to shops via a greedy set-cover algorithm. BullMQ workers running on the same Redis instance handle auto-expiry and warning notifications.

**Tech Stack:** Next.js 16, Mongoose 9, BullMQ, ioredis, Stripe, Zod

**Spec:** `docs/superpowers/specs/2026-03-28-shipping-reservation-system-design.md`

---

## Task 1: Install BullMQ

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install bullmq**

```bash
npm install bullmq
```

- [ ] **Step 2: Verify installation**

```bash
node -e "require('bullmq'); console.log('bullmq OK')"
```

Expected: `bullmq OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add bullmq dependency for background job processing"
```

---

## Task 2: Create CartItem Model

**Files:**
- Create: `models/cart-item.ts`

- [ ] **Step 1: Create the CartItem model**

```typescript
// models/cart-item.ts
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
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit --pretty
```

Expected: No errors related to `cart-item.ts`.

- [ ] **Step 3: Commit**

```bash
git add models/cart-item.ts
git commit -m "feat: add CartItem model for 6h card reservation"
```

---

## Task 3: Create Order Model

**Files:**
- Create: `models/order.ts`

- [ ] **Step 1: Create the Order model with embedded Fulfillment subdocs**

```typescript
// models/order.ts
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
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit --pretty
```

- [ ] **Step 3: Commit**

```bash
git add models/order.ts
git commit -m "feat: add Order model with embedded Fulfillment subdocs"
```

---

## Task 4: Create ShippingTier Model

**Files:**
- Create: `models/shipping-tier.ts`

- [ ] **Step 1: Create the ShippingTier model**

```typescript
// models/shipping-tier.ts
import mongoose, { Document, Model, Schema } from "mongoose";

export interface IShippingTier extends Document {
  country: "DE" | "AT" | "CH";
  minCards: number;
  maxCards: number;
  costCents: number;
  costCoins: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ShippingTierSchema = new Schema<IShippingTier>(
  {
    country: { type: String, enum: ["DE", "AT", "CH"], required: true },
    minCards: { type: Number, required: true, min: 1 },
    maxCards: { type: Number, required: true, min: 1 },
    costCents: { type: Number, required: true, min: 0 },
    costCoins: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ShippingTierSchema.index({ country: 1, minCards: 1 });

const ShippingTier: Model<IShippingTier> =
  mongoose.models.ShippingTier ?? mongoose.model<IShippingTier>("ShippingTier", ShippingTierSchema);

export default ShippingTier;
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit --pretty
```

- [ ] **Step 3: Commit**

```bash
git add models/shipping-tier.ts
git commit -m "feat: add ShippingTier model for admin-configurable shipping costs"
```

---

## Task 5: Modify Existing Models (PackPull, User, CoinTransaction)

**Files:**
- Modify: `models/pack-pull.ts:10,28-31`
- Modify: `models/user.ts:3-62,80-147`
- Modify: `models/coin-transaction.ts:6,20-21`

- [ ] **Step 1: Add "reserved" status to PackPull**

In `models/pack-pull.ts`, change line 10:
```typescript
  status: "claimed" | "converted" | "reserved";
```

And change lines 28-31:
```typescript
    status: {
      type: String,
      enum: ["claimed", "converted", "reserved"],
      required: true,
    },
```

- [ ] **Step 2: Add shippingAddress and reservationRulesAccepted to User**

In `models/user.ts`, add to the `IUser` interface (after line 60, before `createdAt`):
```typescript
  shippingAddress: {
    name: string | null;
    street: string | null;
    city: string | null;
    zip: string | null;
    country: "DE" | "AT" | "CH" | null;
  } | null;
  reservationRulesAccepted: Date | null;
```

In the `UserSchema` definition (after line 144, after `identityVerifiedAt`):
```typescript
    shippingAddress: {
      type: new Schema(
        {
          name: { type: String, default: null },
          street: { type: String, default: null },
          city: { type: String, default: null },
          zip: { type: String, default: null },
          country: { type: String, enum: ["DE", "AT", "CH"], default: null },
        },
        { _id: false }
      ),
      default: null,
    },
    reservationRulesAccepted: { type: Date, default: null },
```

- [ ] **Step 3: Add new types and relatedOrderId to CoinTransaction**

In `models/coin-transaction.ts`, change line 6:
```typescript
  type: "admin_grant" | "admin_deduct" | "pack_purchase" | "card_conversion" | "coin_purchase" | "shipping_payment" | "reservation_expired";
```

Add to the interface (after `relatedPurchaseId`, line 10):
```typescript
  relatedOrderId: Types.ObjectId | null;
```

Change the enum in the schema (lines 20-21):
```typescript
      enum: ["admin_grant", "admin_deduct", "pack_purchase", "card_conversion", "coin_purchase", "shipping_payment", "reservation_expired"],
```

Add to the schema (after `relatedPurchaseId` field, after line 26):
```typescript
    relatedOrderId: { type: Schema.Types.ObjectId, ref: "Order", default: null },
```

- [ ] **Step 4: Verify types compile**

```bash
npx tsc --noEmit --pretty
```

- [ ] **Step 5: Commit**

```bash
git add models/pack-pull.ts models/user.ts models/coin-transaction.ts
git commit -m "feat: extend PackPull, User, CoinTransaction for reservation system"
```

---

## Task 6: Create Shipping Cost Calculation Library

**Files:**
- Create: `lib/shipping.ts`

- [ ] **Step 1: Create the shipping cost calculation function**

```typescript
// lib/shipping.ts
import connectDB from "@/lib/db";
import ShippingTier from "@/models/shipping-tier";

export interface ShippingCostResult {
  costCents: number;
  costCoins: number;
  tierFound: boolean;
}

export async function calculateShippingCost(
  cardCount: number,
  country: "DE" | "AT" | "CH"
): Promise<ShippingCostResult> {
  await connectDB();

  const tier = await ShippingTier.findOne({
    country,
    minCards: { $lte: cardCount },
    maxCards: { $gte: cardCount },
    isActive: true,
  }).lean();

  if (!tier) {
    return { costCents: 0, costCoins: 0, tierFound: false };
  }

  return {
    costCents: tier.costCents,
    costCoins: tier.costCoins,
    tierFound: true,
  };
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit --pretty
```

- [ ] **Step 3: Commit**

```bash
git add lib/shipping.ts
git commit -m "feat: add shipping cost calculation library"
```

---

## Task 7: Create Fulfillment Assignment Algorithm

**Files:**
- Create: `lib/fulfillment-assignment.ts`

- [ ] **Step 1: Create the greedy set-cover fulfillment assignment**

```typescript
// lib/fulfillment-assignment.ts
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import InventoryItem from "@/models/inventory-item";
import type { IFulfillment } from "@/models/order";

interface CartCardInfo {
  cardId: string;
  rarity: string;
}

export async function assignFulfillments(
  cards: CartCardInfo[]
): Promise<IFulfillment[]> {
  await connectDB();

  // 1. For each unique cardId, find shops with stock
  const uniqueCardIds = [...new Set(cards.map((c) => c.cardId))];
  const inventoryItems = await InventoryItem.find({
    card: { $in: uniqueCardIds.map((id) => new mongoose.Types.ObjectId(id)) },
    stock: { $gte: 1 },
  }).lean();

  // Build map: cardId -> Set<shopId>
  const cardToShops = new Map<string, Set<string>>();
  for (const item of inventoryItems) {
    const cardKey = item.card.toString();
    if (!cardToShops.has(cardKey)) {
      cardToShops.set(cardKey, new Set());
    }
    cardToShops.get(cardKey)!.add(item.shop.toString());
  }

  // 2. Greedy set-cover: pick shop covering most uncovered cards
  const uncovered = new Set(cards.map((_, i) => i));
  const fulfillmentMap = new Map<string | null, number[]>(); // shopId -> card indices

  while (uncovered.size > 0) {
    let bestShop: string | null = null;
    let bestCoverage: number[] = [];

    // Find shop that covers the most uncovered cards
    const shopCoverage = new Map<string, number[]>();
    for (const idx of uncovered) {
      const cardId = cards[idx].cardId;
      const shops = cardToShops.get(cardId);
      if (!shops) continue;
      for (const shopId of shops) {
        if (!shopCoverage.has(shopId)) {
          shopCoverage.set(shopId, []);
        }
        shopCoverage.get(shopId)!.push(idx);
      }
    }

    for (const [shopId, covered] of shopCoverage) {
      if (covered.length > bestCoverage.length) {
        bestShop = shopId;
        bestCoverage = covered;
      }
    }

    if (bestShop === null || bestCoverage.length === 0) break;

    fulfillmentMap.set(bestShop, bestCoverage);
    for (const idx of bestCoverage) {
      uncovered.delete(idx);
    }
  }

  // 3. Remaining uncovered cards -> platform (shopId: null)
  if (uncovered.size > 0) {
    fulfillmentMap.set(null, [...uncovered]);
  }

  // 4. Build Fulfillment array
  const fulfillments: IFulfillment[] = [];
  for (const [shopId, indices] of fulfillmentMap) {
    fulfillments.push({
      shopId: shopId ? new mongoose.Types.ObjectId(shopId) : null,
      items: indices.map((i) => ({
        cardId: new mongoose.Types.ObjectId(cards[i].cardId),
        rarity: cards[i].rarity,
      })),
      status: "pending",
      trackingNumber: null,
      shippedAt: null,
    });
  }

  return fulfillments;
}

/**
 * Decrement InventoryItem stock for each card in each fulfillment.
 * Called after order is confirmed paid.
 */
export async function decrementShopStock(
  fulfillments: IFulfillment[]
): Promise<void> {
  for (const f of fulfillments) {
    if (!f.shopId) continue; // platform stock not tracked in InventoryItem
    for (const item of f.items) {
      await InventoryItem.updateOne(
        { shop: f.shopId, card: item.cardId, stock: { $gte: 1 } },
        { $inc: { stock: -1 } }
      );
    }
  }
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit --pretty
```

- [ ] **Step 3: Commit**

```bash
git add lib/fulfillment-assignment.ts
git commit -m "feat: add greedy set-cover fulfillment assignment algorithm"
```

---

## Task 8: Add Validation Schemas

**Files:**
- Modify: `lib/validations.ts`

- [ ] **Step 1: Add shipping and checkout validation schemas**

Append to the end of `lib/validations.ts` (before the closing of the file):

```typescript
export const shippingAddressSchema = z.object({
  name: z.string().trim().min(2).max(100),
  street: z.string().trim().min(3).max(200),
  city: z.string().trim().min(2).max(100),
  zip: z.string().trim().regex(/^\d{4,5}$/, "Invalid postal code"),
  country: z.enum(["DE", "AT", "CH"]),
});

export const cartCheckoutSchema = z.object({
  paymentMethod: z.enum(["coins", "stripe"]),
  address: shippingAddressSchema,
  lang: z.enum(["de", "en"]).default("de"),
});

export const shippingEstimateSchema = z.object({
  country: z.enum(["DE", "AT", "CH"]),
});

export const shippingTierSchema = z.object({
  country: z.enum(["DE", "AT", "CH"]),
  minCards: z.number().int().min(1),
  maxCards: z.number().int().min(1),
  costCents: z.number().int().min(0),
  costCoins: z.number().int().min(0),
  isActive: z.boolean().default(true),
});

export const shippingTierUpdateSchema = shippingTierSchema.partial();

export const fulfillmentUpdateSchema = z.object({
  status: z.enum(["processing", "shipped", "delivered"]),
  trackingNumber: z.string().trim().max(100).optional(),
});
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit --pretty
```

- [ ] **Step 3: Commit**

```bash
git add lib/validations.ts
git commit -m "feat: add Zod schemas for shipping, checkout, and fulfillment"
```

---

## Task 9: Create BullMQ Queue Infrastructure

**Files:**
- Create: `lib/queue.ts`

- [ ] **Step 1: Create queue factory using existing Redis connection**

```typescript
// lib/queue.ts
import { Queue, Worker, type Processor, type WorkerOptions } from "bullmq";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || "localhost",
    port: parseInt(parsed.port || "6379", 10),
    password: parsed.password || undefined,
  };
}

const connection = parseRedisUrl(REDIS_URL);

export const RESERVATION_QUEUE = "reservation-jobs";

export function getQueue(name: string): Queue {
  return new Queue(name, { connection });
}

export function createWorker<T = unknown>(
  name: string,
  processor: Processor<T>,
  opts?: Partial<WorkerOptions>
): Worker<T> {
  return new Worker<T>(name, processor, {
    connection,
    ...opts,
  });
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit --pretty
```

- [ ] **Step 3: Commit**

```bash
git add lib/queue.ts
git commit -m "feat: add BullMQ queue factory with Redis connection"
```

---

## Task 10: Create Reservation Worker

**Files:**
- Create: `workers/reservation-worker.ts`

- [ ] **Step 1: Create the reservation expiry and warning worker**

```typescript
// workers/reservation-worker.ts
import { RESERVATION_QUEUE, createWorker, getQueue } from "@/lib/queue";
import connectDB from "@/lib/db";
import CartItem from "@/models/cart-item";
import PackPull from "@/models/pack-pull";
import User from "@/models/user";
import Box from "@/models/box";
import CoinTransaction from "@/models/coin-transaction";
import Notification from "@/models/notification";
import { runRedisCommand } from "@/lib/redis";
import mongoose from "mongoose";

async function processExpiredReservations() {
  await connectDB();

  const now = new Date();
  const expiredItems = await CartItem.find({
    status: "reserved",
    expiresAt: { $lt: now },
  }).lean();

  if (expiredItems.length === 0) return;

  // Group by user for batch notification
  const userCoinsMap = new Map<string, number>();

  for (const item of expiredItems) {
    // Update CartItem status
    await CartItem.updateOne(
      { _id: item._id, status: "reserved" },
      { status: "expired" }
    );

    // Update PackPull status
    await PackPull.updateOne(
      { _id: item.pullId, status: "reserved" },
      { status: "converted", decidedAt: now }
    );

    // Grant coins back to user
    await User.findByIdAndUpdate(item.userId, {
      $inc: { coins: item.conversionValue },
    });

    // Return card stock to box
    const cardObjectId = new mongoose.Types.ObjectId(item.cardId.toString());
    await Box.updateOne(
      { _id: item.boxId, "cards.card": cardObjectId },
      { $inc: { "cards.$.stock": 1 } }
    );

    // Create transaction record
    await CoinTransaction.create({
      userId: item.userId,
      amount: item.conversionValue,
      type: "reservation_expired",
      reason: "Reservation expired after 6 hours",
      relatedPullId: item.pullId,
      relatedBoxId: item.boxId,
    });

    // Accumulate coins per user
    const uid = item.userId.toString();
    userCoinsMap.set(uid, (userCoinsMap.get(uid) ?? 0) + item.conversionValue);
  }

  // Send batch notification per user
  for (const [userId, totalCoins] of userCoinsMap) {
    await Notification.create({
      userId,
      title: "Reservierung abgelaufen",
      message: `Deine reservierten Karten wurden automatisch in ${totalCoins} Coins umgewandelt.`,
      type: "info",
      cta: { label: "Zum Guthaben", url: "/balance" },
      category: "reservation",
      entityType: "cart_expiry",
    });

    // Publish SSE notification update
    await runRedisCommand("notify-expiry", undefined, async (redis) => {
      const count = await Notification.countDocuments({ userId, read: false });
      await redis.set(`notifications:unread:${userId}`, count, "EX", 60);
      await redis.publish(`notifications:${userId}`, JSON.stringify({ unreadCount: count }));
    });
  }

  console.log(`[reservation-worker] Processed ${expiredItems.length} expired reservations`);
}

async function processExpiryWarnings() {
  await connectDB();

  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

  const warningItems = await CartItem.find({
    status: "reserved",
    expiresAt: { $lt: oneHourFromNow, $gt: now },
    warningNotified: false,
  }).lean();

  if (warningItems.length === 0) return;

  // Group by user
  const userItems = new Map<string, number>();
  const itemIds: mongoose.Types.ObjectId[] = [];

  for (const item of warningItems) {
    const uid = item.userId.toString();
    userItems.set(uid, (userItems.get(uid) ?? 0) + 1);
    itemIds.push(item._id as mongoose.Types.ObjectId);
  }

  // Mark all as notified
  await CartItem.updateMany(
    { _id: { $in: itemIds } },
    { warningNotified: true }
  );

  // Send notification per user
  for (const [userId, cardCount] of userItems) {
    await Notification.create({
      userId,
      title: "Reservierung läuft bald ab",
      message: `${cardCount} Karte${cardCount > 1 ? "n" : ""} im Warenkorb ${cardCount > 1 ? "laufen" : "läuft"} in weniger als 1 Stunde ab. Schließe jetzt den Versand ab.`,
      type: "warning",
      cta: { label: "Zum Warenkorb", url: "/cart" },
      category: "reservation",
      entityType: "cart_warning",
    });

    await runRedisCommand("notify-warning", undefined, async (redis) => {
      const count = await Notification.countDocuments({ userId, read: false });
      await redis.set(`notifications:unread:${userId}`, count, "EX", 60);
      await redis.publish(`notifications:${userId}`, JSON.stringify({ unreadCount: count }));
    });
  }

  console.log(`[reservation-worker] Sent ${warningItems.length} expiry warnings`);
}

export function startReservationWorker() {
  const worker = createWorker(RESERVATION_QUEUE, async (job) => {
    if (job.name === "check-expired") {
      await processExpiredReservations();
    } else if (job.name === "send-warnings") {
      await processExpiryWarnings();
    }
  });

  worker.on("failed", (job, err) => {
    console.error(`[reservation-worker] Job ${job?.name} failed:`, err);
  });

  // Schedule repeatable jobs
  const queue = getQueue(RESERVATION_QUEUE);
  void queue.add("check-expired", {}, { repeat: { every: 60_000 }, removeOnComplete: 100, removeOnFail: 50 });
  void queue.add("send-warnings", {}, { repeat: { every: 60_000 }, removeOnComplete: 100, removeOnFail: 50 });

  console.log("[reservation-worker] Started with 60s interval");

  return worker;
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit --pretty
```

- [ ] **Step 3: Commit**

```bash
git add workers/reservation-worker.ts
git commit -m "feat: add BullMQ reservation worker for expiry and warnings"
```

---

## Task 11: Bootstrap Worker in instrumentation.ts

**Files:**
- Modify: `instrumentation.ts`

- [ ] **Step 1: Start the reservation worker on server boot**

Replace the contents of `instrumentation.ts`:

```typescript
export async function register() {
  // Only run on the server at runtime (skip during build/prerender)
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    const { runSeed } = await import("@/lib/seed");
    await runSeed();

    const { startReservationWorker } = await import("@/workers/reservation-worker");
    startReservationWorker();
  }
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit --pretty
```

- [ ] **Step 3: Commit**

```bash
git add instrumentation.ts
git commit -m "feat: bootstrap BullMQ reservation worker on server start"
```

---

## Task 12: Modify pulls/decide API Route

**Files:**
- Modify: `app/api/pulls/decide/route.ts`

- [ ] **Step 1: Replace UserInventory with CartItem creation on claim**

Replace the full contents of `app/api/pulls/decide/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { getRedis } from "@/lib/redis";
import PackPull from "@/models/pack-pull";
import CartItem from "@/models/cart-item";
import User from "@/models/user";
import Box from "@/models/box";
import CoinTransaction from "@/models/coin-transaction";

const RESERVATION_HOURS = 6;

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { packGroupId, cardId, cardIndex, packIndex, rarity, coinValue, conversionValue, decision, boxId } = body as {
    packGroupId?: string;
    cardId?: string;
    cardIndex?: number;
    packIndex?: number;
    rarity?: string;
    coinValue?: number;
    conversionValue?: number;
    decision?: "claim" | "convert";
    boxId?: string;
  };

  if (!packGroupId || !cardId || cardIndex === undefined || !decision || !boxId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (decision !== "claim" && decision !== "convert") {
    return NextResponse.json({ error: "decision must be 'claim' or 'convert'" }, { status: 400 });
  }

  try {
    await connectDB();

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip")
      ?? "unknown";
    const ua = req.headers.get("user-agent") ?? "unknown";

    // Create the PackPull record
    // Unique index on (packGroupId, cardIndex) prevents duplicates atomically
    let pull;
    try {
      pull = await PackPull.create({
        userId,
        boxId,
        cardId,
        rarity: rarity ?? "",
        coinValue: coinValue ?? 0,
        conversionValue: conversionValue ?? 0,
        status: decision === "claim" ? "reserved" : "converted",
        decidedAt: new Date(),
        packGroupId,
        packIndex: packIndex ?? 0,
        cardIndex,
        ipAddress: ip,
        userAgent: ua,
      });
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 11000) {
        return NextResponse.json({ error: "Already decided for this card" }, { status: 400 });
      }
      throw err;
    }

    // Get user info for SSE event
    const userDoc = await User.findById(userId).select("name username image").lean();
    const cardDoc = await (await import("@/models/card")).default.findById(cardId).select("name image").lean();

    if (decision === "claim") {
      // Create CartItem with 6h reservation
      const expiresAt = new Date(Date.now() + RESERVATION_HOURS * 60 * 60 * 1000);
      await CartItem.create({
        userId,
        cardId,
        boxId,
        pullId: pull._id,
        rarity: rarity ?? "",
        conversionValue: conversionValue ?? 0,
        status: "reserved",
        expiresAt,
      });

      const user = await User.findById(userId).select("coins").lean();

      // Publish SSE live event
      void publishLiveEvent(boxId, userDoc, cardDoc, rarity ?? "", coinValue ?? 0, decision);

      return NextResponse.json({
        success: true,
        decision: "reserved",
        expiresAt: expiresAt.toISOString(),
        newBalance: user?.coins ?? 0,
      });
    } else {
      const user = await User.findByIdAndUpdate(
        userId,
        { $inc: { coins: conversionValue ?? 0 } },
        { returnDocument: "after" }
      );

      const { Types } = await import("mongoose");
      const cardObjectId = new Types.ObjectId(cardId);
      await Box.updateOne(
        { _id: boxId, "cards.card": cardObjectId },
        { $inc: { "cards.$.stock": 1 } }
      );

      await CoinTransaction.create({
        userId,
        amount: conversionValue ?? 0,
        type: "card_conversion",
        relatedPullId: pull._id,
        relatedBoxId: boxId,
      });

      // Publish SSE live event
      void publishLiveEvent(boxId, userDoc, cardDoc, rarity ?? "", coinValue ?? 0, decision);

      return NextResponse.json({ success: true, decision: "converted", newBalance: user?.coins ?? 0 });
    }
  } catch (err) {
    console.error("[pulls/decide POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

async function publishLiveEvent(
  boxId: string,
  userDoc: { name?: string; username?: string; image?: string | null } | null,
  cardDoc: { name?: string; image?: string | null } | null,
  rarity: string,
  coinValue: number,
  decision: string
) {
  try {
    const redis = getRedis();
    await redis.publish(`box-events:${boxId}`, JSON.stringify({
      userName: userDoc?.name ?? userDoc?.username ?? "User",
      userImage: userDoc?.image ?? null,
      cardName: cardDoc?.name ?? "Unknown",
      cardImage: cardDoc?.image ?? null,
      rarity,
      coinValue,
      decision,
      timestamp: Date.now(),
    }));
  } catch {
    // Non-critical — SSE is best-effort
  }
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit --pretty
```

- [ ] **Step 3: Commit**

```bash
git add app/api/pulls/decide/route.ts
git commit -m "feat: pulls/decide creates CartItem reservation instead of UserInventory"
```

---

## Task 13: Create Cart API Routes

**Files:**
- Create: `app/api/cart/route.ts`
- Create: `app/api/cart/[itemId]/route.ts`
- Create: `app/api/cart/shipping-estimate/route.ts`

- [ ] **Step 1: Create GET /api/cart**

```typescript
// app/api/cart/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import CartItem from "@/models/cart-item";
import "@/models/card";
import "@/models/box";

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const now = Date.now();
    const items = await CartItem.find({ userId, status: "reserved" })
      .populate("cardId", "name image rarity setName")
      .populate("boxId", "name game")
      .sort({ expiresAt: 1 })
      .lean();

    return NextResponse.json({
      items: items.map((item) => ({
        _id: item._id.toString(),
        card: item.cardId,
        box: item.boxId,
        rarity: item.rarity,
        conversionValue: item.conversionValue,
        expiresAt: item.expiresAt,
        remainingSeconds: Math.max(0, Math.floor((new Date(item.expiresAt).getTime() - now) / 1000)),
        createdAt: item.createdAt,
      })),
      totalItems: items.length,
    });
  } catch (err) {
    console.error("[cart GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create DELETE /api/cart/[itemId] (manual convert)**

```typescript
// app/api/cart/[itemId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import mongoose from "mongoose";
import CartItem from "@/models/cart-item";
import PackPull from "@/models/pack-pull";
import User from "@/models/user";
import Box from "@/models/box";
import CoinTransaction from "@/models/coin-transaction";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { itemId } = await params;

  try {
    await connectDB();

    // Atomically claim the item (only if still reserved and belongs to user)
    const item = await CartItem.findOneAndUpdate(
      { _id: itemId, userId, status: "reserved" },
      { status: "expired" },
      { returnDocument: "before" }
    );

    if (!item) {
      return NextResponse.json({ error: "Item not found or already processed" }, { status: 404 });
    }

    // Update PackPull to converted
    await PackPull.updateOne(
      { _id: item.pullId, status: "reserved" },
      { status: "converted" }
    );

    // Grant coins
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { coins: item.conversionValue } },
      { returnDocument: "after" }
    );

    // Return stock to box
    const cardObjectId = new mongoose.Types.ObjectId(item.cardId.toString());
    await Box.updateOne(
      { _id: item.boxId, "cards.card": cardObjectId },
      { $inc: { "cards.$.stock": 1 } }
    );

    // Create transaction
    await CoinTransaction.create({
      userId,
      amount: item.conversionValue,
      type: "card_conversion",
      reason: "Manual conversion from cart",
      relatedPullId: item.pullId,
      relatedBoxId: item.boxId,
    });

    return NextResponse.json({
      success: true,
      convertedCoins: item.conversionValue,
      newBalance: user?.coins ?? 0,
    });
  } catch (err) {
    console.error("[cart/[itemId] DELETE]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create POST /api/cart/shipping-estimate**

```typescript
// app/api/cart/shipping-estimate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import CartItem from "@/models/cart-item";
import { calculateShippingCost } from "@/lib/shipping";
import { shippingEstimateSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = shippingEstimateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await connectDB();

    const cardCount = await CartItem.countDocuments({ userId, status: "reserved" });
    if (cardCount === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    const cost = await calculateShippingCost(cardCount, parsed.data.country);

    return NextResponse.json({
      cardCount,
      costCents: cost.costCents,
      costCoins: cost.costCoins,
      tierFound: cost.tierFound,
    });
  } catch (err) {
    console.error("[cart/shipping-estimate POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Verify types compile**

```bash
npx tsc --noEmit --pretty
```

- [ ] **Step 5: Commit**

```bash
git add app/api/cart/route.ts app/api/cart/[itemId]/route.ts app/api/cart/shipping-estimate/route.ts
git commit -m "feat: add cart API routes (list, manual convert, shipping estimate)"
```

---

## Task 14: Create Checkout API Route

**Files:**
- Create: `app/api/cart/checkout/route.ts`

- [ ] **Step 1: Create the checkout endpoint**

```typescript
// app/api/cart/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { getRedis } from "@/lib/redis";
import User from "@/models/user";
import CartItem from "@/models/cart-item";
import PackPull from "@/models/pack-pull";
import Order from "@/models/order";
import CoinTransaction from "@/models/coin-transaction";
import Notification from "@/models/notification";
import { calculateShippingCost } from "@/lib/shipping";
import { assignFulfillments, decrementShopStock } from "@/lib/fulfillment-assignment";
import { cartCheckoutSchema } from "@/lib/validations";
import stripe from "@/lib/stripe";

function generateOrderNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PA-${dateStr}-${rand}`;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = cartCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const { paymentMethod, address, lang } = parsed.data;

  try {
    await connectDB();

    // Distributed lock to prevent double checkout
    const redis = getRedis();
    const lockKey = `checkout:${userId}`;
    const locked = await redis.set(lockKey, "1", "EX", 30, "NX");
    if (!locked) {
      return NextResponse.json({ error: "Checkout already in progress" }, { status: 429 });
    }

    try {
      // Load reserved items (not expired)
      const now = new Date();
      const cartItems = await CartItem.find({
        userId,
        status: "reserved",
        expiresAt: { $gt: now },
      }).lean();

      if (cartItems.length === 0) {
        return NextResponse.json({ error: "No reserved items in cart" }, { status: 400 });
      }

      // Calculate shipping cost
      const shippingCost = await calculateShippingCost(cartItems.length, address.country);
      if (!shippingCost.tierFound) {
        return NextResponse.json({ error: "No shipping tier found for this country and card count" }, { status: 400 });
      }

      // Assign fulfillments
      const cards = cartItems.map((item) => ({
        cardId: item.cardId.toString(),
        rarity: item.rarity,
      }));
      const fulfillments = await assignFulfillments(cards);

      // Generate order number (retry on collision)
      let orderNumber = generateOrderNumber();
      let retries = 0;
      while (retries < 5) {
        const existing = await Order.findOne({ orderNumber }).select("_id").lean();
        if (!existing) break;
        orderNumber = generateOrderNumber();
        retries++;
      }

      if (paymentMethod === "coins") {
        // Atomic coin deduction
        const user = await User.findOneAndUpdate(
          { _id: userId, coins: { $gte: shippingCost.costCoins } },
          {
            $inc: { coins: -shippingCost.costCoins },
            $set: { shippingAddress: address },
          },
          { returnDocument: "after" }
        );

        if (!user) {
          return NextResponse.json({ error: "Insufficient coins" }, { status: 400 });
        }

        // Create order
        const order = await Order.create({
          userId,
          orderNumber,
          items: cartItems.map((item) => ({
            cartItemId: item._id,
            cardId: item.cardId,
            rarity: item.rarity,
          })),
          shippingAddress: address,
          paymentMethod: "coins",
          paymentStatus: "paid",
          shippingCostCents: shippingCost.costCents,
          shippingCostCoins: shippingCost.costCoins,
          fulfillments,
          status: "paid",
        });

        // Update CartItems -> checked_out
        await CartItem.updateMany(
          { _id: { $in: cartItems.map((i) => i._id) }, status: "reserved" },
          { status: "checked_out", orderId: order._id }
        );

        // Update PackPulls -> claimed
        await PackPull.updateMany(
          { _id: { $in: cartItems.map((i) => i.pullId) }, status: "reserved" },
          { status: "claimed" }
        );

        // Decrement shop inventory stock
        await decrementShopStock(fulfillments);

        // Create coin transaction
        await CoinTransaction.create({
          userId,
          amount: -shippingCost.costCoins,
          type: "shipping_payment",
          reason: `Shipping for order ${orderNumber}`,
          relatedOrderId: order._id,
        });

        // Notify shops with assigned fulfillments
        await notifyShops(order._id.toString(), orderNumber, fulfillments);

        return NextResponse.json({
          success: true,
          orderId: order._id.toString(),
          orderNumber,
          newBalance: user.coins,
        });
      } else {
        // Stripe payment
        const user = await User.findById(userId);
        if (!user) {
          return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Save address early
        user.shippingAddress = address;
        await user.save();

        // Create order in pending state
        const order = await Order.create({
          userId,
          orderNumber,
          items: cartItems.map((item) => ({
            cartItemId: item._id,
            cardId: item.cardId,
            rarity: item.rarity,
          })),
          shippingAddress: address,
          paymentMethod: "stripe",
          paymentStatus: "pending",
          shippingCostCents: shippingCost.costCents,
          shippingCostCoins: shippingCost.costCoins,
          fulfillments,
          status: "pending_payment",
        });

        // Extend CartItem expiry to cover Stripe session (30 min grace)
        const minExpiry = new Date(Date.now() + 30 * 60 * 1000);
        await CartItem.updateMany(
          {
            _id: { $in: cartItems.map((i) => i._id) },
            status: "reserved",
            expiresAt: { $lt: minExpiry },
          },
          { expiresAt: minExpiry }
        );

        // Get or create Stripe customer
        let stripeCustomerId = user.stripeCustomerId;
        if (!stripeCustomerId) {
          const customer = await stripe.customers.create({
            email: user.email,
            name: user.name || user.username,
            metadata: { userId },
          });
          stripeCustomerId = customer.id;
          user.stripeCustomerId = stripeCustomerId;
          await user.save();
        }

        // Create Stripe checkout session
        const checkoutSession = await stripe.checkout.sessions.create({
          mode: "payment",
          customer: stripeCustomerId,
          line_items: [
            {
              price_data: {
                currency: "eur",
                product_data: {
                  name: `Versand – Bestellung ${orderNumber}`,
                  description: `${cartItems.length} Karte${cartItems.length > 1 ? "n" : ""}`,
                },
                unit_amount: shippingCost.costCents,
              },
              quantity: 1,
            },
          ],
          metadata: {
            type: "shipping",
            orderId: order._id.toString(),
            userId,
          },
          expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 min
          success_url: `${process.env.NEXT_PUBLIC_APP_URL}/${lang}/orders/${order._id}?payment=success`,
          cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/${lang}/cart?payment=cancelled`,
          locale: lang === "de" ? "de" : "en",
        });

        // Store stripe session ID on order
        order.stripeSessionId = checkoutSession.id;
        await order.save();

        return NextResponse.json({
          success: true,
          checkoutUrl: checkoutSession.url,
          orderId: order._id.toString(),
          orderNumber,
        });
      }
    } finally {
      await redis.del(lockKey);
    }
  } catch (err) {
    console.error("[cart/checkout POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

async function notifyShops(
  orderId: string,
  orderNumber: string,
  fulfillments: Array<{ shopId: unknown; items: unknown[] }>
) {
  for (const f of fulfillments) {
    if (!f.shopId) continue;
    const shopUserId = f.shopId.toString();
    await Notification.create({
      userId: shopUserId,
      title: "Neuer Versandauftrag",
      message: `Bestellung ${orderNumber}: ${f.items.length} Karte${f.items.length > 1 ? "n" : ""} zum Versand.`,
      type: "info",
      cta: { label: "Aufträge ansehen", url: "/shop/fulfillments" },
      category: "fulfillment",
      entityType: "order",
      entityId: orderId,
    });
  }
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit --pretty
```

- [ ] **Step 3: Commit**

```bash
git add app/api/cart/checkout/route.ts
git commit -m "feat: add checkout API with coins and Stripe payment support"
```

---

## Task 15: Extend Stripe Webhook for Shipping Payments

**Files:**
- Modify: `app/api/stripe/webhook/route.ts`

- [ ] **Step 1: Add shipping payment handling to the webhook**

Add these imports at the top of `app/api/stripe/webhook/route.ts` (after existing imports):

```typescript
import CartItem from "@/models/cart-item";
import PackPull from "@/models/pack-pull";
import Order from "@/models/order";
import Notification from "@/models/notification";
import { decrementShopStock } from "@/lib/fulfillment-assignment";
import { runRedisCommand } from "@/lib/redis";
```

In the `switch (event.type)` block, modify the `checkout.session.completed` case to dispatch based on metadata:

```typescript
    case "checkout.session.completed": {
      const checkoutSession = event.data.object as Stripe.Checkout.Session;
      if (checkoutSession.metadata?.type === "shipping") {
        await handleShippingCheckoutCompleted(checkoutSession);
      } else {
        await handleCheckoutCompleted(checkoutSession);
      }
      break;
    }
    case "checkout.session.expired": {
      const expiredSession = event.data.object as Stripe.Checkout.Session;
      if (expiredSession.metadata?.type === "shipping") {
        await handleShippingCheckoutExpired(expiredSession);
      } else {
        await handleCheckoutExpired(expiredSession);
      }
      break;
    }
```

Add these new handler functions (after the existing `handleIdentityFailed`):

```typescript
async function handleShippingCheckoutCompleted(session: Stripe.Checkout.Session) {
  const { orderId, userId } = session.metadata || {};
  if (!orderId || !userId) {
    console.error("Shipping webhook missing metadata:", session.id);
    return;
  }

  const order = await Order.findById(orderId);
  if (!order || order.paymentStatus === "paid") return; // idempotency

  // Update order
  order.paymentStatus = "paid";
  order.status = "paid";
  order.stripePaymentIntentId = session.payment_intent as string;
  await order.save();

  // Update CartItems -> checked_out
  const cartItemIds = order.items.map((i) => i.cartItemId);
  await CartItem.updateMany(
    { _id: { $in: cartItemIds }, status: "reserved" },
    { status: "checked_out", orderId: order._id }
  );

  // Update PackPulls -> claimed
  const cartItems = await CartItem.find({ _id: { $in: cartItemIds } }).select("pullId").lean();
  const pullIds = cartItems.map((c) => c.pullId);
  await PackPull.updateMany(
    { _id: { $in: pullIds }, status: "reserved" },
    { status: "claimed" }
  );

  // Decrement shop inventory
  await decrementShopStock(order.fulfillments);

  // Create coin transaction for record-keeping (amount 0 since paid via stripe)
  await CoinTransaction.create({
    userId,
    amount: 0,
    type: "shipping_payment",
    reason: `Stripe shipping payment for order ${order.orderNumber}`,
    relatedOrderId: order._id,
  });

  // Notify shops
  for (const f of order.fulfillments) {
    if (!f.shopId) continue;
    await Notification.create({
      userId: f.shopId,
      title: "Neuer Versandauftrag",
      message: `Bestellung ${order.orderNumber}: ${f.items.length} Karte${f.items.length > 1 ? "n" : ""} zum Versand.`,
      type: "info",
      cta: { label: "Aufträge ansehen", url: "/shop/fulfillments" },
      category: "fulfillment",
      entityType: "order",
      entityId: orderId,
    });
  }

  // Notify user
  await Notification.create({
    userId,
    title: "Bestellung bestätigt",
    message: `Deine Bestellung ${order.orderNumber} wurde bezahlt und wird bearbeitet.`,
    type: "success",
    cta: { label: "Bestellung ansehen", url: `/orders/${orderId}` },
    category: "order",
    entityType: "order",
    entityId: orderId,
  });

  await runRedisCommand("notify-order", undefined, async (redis) => {
    const count = await Notification.countDocuments({ userId, read: false });
    await redis.set(`notifications:unread:${userId}`, count, "EX", 60);
    await redis.publish(`notifications:${userId}`, JSON.stringify({ unreadCount: count }));
  });
}

async function handleShippingCheckoutExpired(session: Stripe.Checkout.Session) {
  const { orderId } = session.metadata || {};
  if (!orderId) return;

  await Order.findByIdAndUpdate(
    orderId,
    { paymentStatus: "failed", status: "cancelled" }
  );
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit --pretty
```

- [ ] **Step 3: Commit**

```bash
git add app/api/stripe/webhook/route.ts
git commit -m "feat: extend Stripe webhook for shipping payment handling"
```

---

## Task 16: Create Shop Fulfillment API Routes

**Files:**
- Create: `app/api/shop/fulfillments/route.ts`
- Create: `app/api/shop/fulfillments/[orderId]/route.ts`

- [ ] **Step 1: Create GET /api/shop/fulfillments**

```typescript
// app/api/shop/fulfillments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Order from "@/models/order";
import "@/models/card";
import "@/models/user";

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const allowedRoles = ["shop", "admin", "super_admin"];

  if (!session?.user || !userId || !role || !allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.max(1, Math.min(50, parseInt(searchParams.get("limit") ?? "20", 10)));

  try {
    await connectDB();

    const query: Record<string, unknown> = {
      "fulfillments.shopId": userId,
      paymentStatus: "paid",
    };
    if (status) {
      query["fulfillments.status"] = status;
    }

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("items.cardId", "name image rarity setName")
        .populate("userId", "name username")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Order.countDocuments(query),
    ]);

    // Filter fulfillments to only show this shop's assignments
    const mapped = orders.map((order) => {
      const myFulfillment = order.fulfillments.find(
        (f) => f.shopId?.toString() === userId
      );
      return {
        _id: order._id.toString(),
        orderNumber: order.orderNumber,
        user: order.userId,
        shippingAddress: order.shippingAddress,
        fulfillment: myFulfillment ?? null,
        items: order.items,
        createdAt: order.createdAt,
      };
    });

    return NextResponse.json({
      orders: mapped,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[shop/fulfillments GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create PATCH /api/shop/fulfillments/[orderId]**

```typescript
// app/api/shop/fulfillments/[orderId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Order from "@/models/order";
import Notification from "@/models/notification";
import { runRedisCommand } from "@/lib/redis";
import { fulfillmentUpdateSchema } from "@/lib/validations";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const allowedRoles = ["shop", "admin", "super_admin"];

  if (!session?.user || !userId || !role || !allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orderId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = fulfillmentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await connectDB();

    const order = await Order.findById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Find this shop's fulfillment
    const fulfillment = order.fulfillments.find(
      (f) => f.shopId?.toString() === userId
    );
    if (!fulfillment) {
      return NextResponse.json({ error: "No fulfillment assigned to you" }, { status: 403 });
    }

    // Update fulfillment
    fulfillment.status = parsed.data.status;
    if (parsed.data.trackingNumber !== undefined) {
      fulfillment.trackingNumber = parsed.data.trackingNumber;
    }
    if (parsed.data.status === "shipped") {
      fulfillment.shippedAt = new Date();
    }

    // Check if all fulfillments are shipped/delivered -> update order status
    const allShipped = order.fulfillments.every(
      (f) => f.status === "shipped" || f.status === "delivered"
    );
    const allDelivered = order.fulfillments.every(
      (f) => f.status === "delivered"
    );

    if (allDelivered) {
      order.status = "delivered";
    } else if (allShipped) {
      order.status = "shipped";
    } else {
      order.status = "processing";
    }

    await order.save();

    // Notify user on shipped
    if (parsed.data.status === "shipped") {
      const orderUserId = order.userId.toString();
      await Notification.create({
        userId: orderUserId,
        title: "Bestellung versendet",
        message: fulfillment.trackingNumber
          ? `Deine Bestellung ${order.orderNumber} wurde versendet. Tracking: ${fulfillment.trackingNumber}`
          : `Deine Bestellung ${order.orderNumber} wurde versendet.`,
        type: "success",
        cta: { label: "Bestellung ansehen", url: `/orders/${orderId}` },
        category: "order",
        entityType: "order",
        entityId: orderId,
      });

      await runRedisCommand("notify-shipped", undefined, async (redis) => {
        const count = await Notification.countDocuments({ userId: orderUserId, read: false });
        await redis.set(`notifications:unread:${orderUserId}`, count, "EX", 60);
        await redis.publish(`notifications:${orderUserId}`, JSON.stringify({ unreadCount: count }));
      });
    }

    return NextResponse.json({ success: true, status: order.status });
  } catch (err) {
    console.error("[shop/fulfillments/[orderId] PATCH]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify types compile**

```bash
npx tsc --noEmit --pretty
```

- [ ] **Step 4: Commit**

```bash
git add app/api/shop/fulfillments/route.ts app/api/shop/fulfillments/[orderId]/route.ts
git commit -m "feat: add shop fulfillment API routes"
```

---

## Task 17: Create Admin Shipping Tier API

**Files:**
- Create: `app/api/admin/shipping-tiers/route.ts`

- [ ] **Step 1: Create CRUD for shipping tiers**

```typescript
// app/api/admin/shipping-tiers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import ShippingTier from "@/models/shipping-tier";
import { shippingTierSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectDB();
    const tiers = await ShippingTier.find().sort({ country: 1, minCards: 1 }).lean();

    return NextResponse.json({
      tiers: tiers.map((t) => ({
        _id: t._id.toString(),
        country: t.country,
        minCards: t.minCards,
        maxCards: t.maxCards,
        costCents: t.costCents,
        costCoins: t.costCoins,
        isActive: t.isActive,
      })),
    });
  } catch (err) {
    console.error("[admin/shipping-tiers GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = shippingTierSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.minCards > parsed.data.maxCards) {
    return NextResponse.json({ error: "minCards must be <= maxCards" }, { status: 400 });
  }

  try {
    await connectDB();

    // Check for overlapping tiers
    const overlap = await ShippingTier.findOne({
      country: parsed.data.country,
      isActive: true,
      $or: [
        { minCards: { $lte: parsed.data.maxCards }, maxCards: { $gte: parsed.data.minCards } },
      ],
    });

    if (overlap) {
      return NextResponse.json({ error: "Overlapping tier exists for this country" }, { status: 409 });
    }

    const tier = await ShippingTier.create(parsed.data);
    return NextResponse.json({ _id: tier._id.toString() }, { status: 201 });
  } catch (err) {
    console.error("[admin/shipping-tiers POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit --pretty
```

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/shipping-tiers/route.ts
git commit -m "feat: add admin shipping tier CRUD API"
```

---

## Task 18: Create Admin Orders API

**Files:**
- Create: `app/api/admin/orders/route.ts`
- Create: `app/api/admin/orders/[id]/route.ts`

- [ ] **Step 1: Create GET /api/admin/orders**

```typescript
// app/api/admin/orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Order from "@/models/order";
import "@/models/card";
import "@/models/user";

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") ?? "20", 10)));
  const status = searchParams.get("status") ?? "";
  const userId = searchParams.get("userId") ?? "";

  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  if (userId) query.userId = userId;

  try {
    await connectDB();

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("userId", "name username email")
        .populate("items.cardId", "name image rarity")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Order.countDocuments(query),
    ]);

    return NextResponse.json({
      orders: orders.map((o) => ({
        ...o,
        _id: o._id.toString(),
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[admin/orders GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create GET/PATCH /api/admin/orders/[id]**

```typescript
// app/api/admin/orders/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Order from "@/models/order";
import "@/models/card";
import "@/models/user";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await connectDB();
    const order = await Order.findById(id)
      .populate("userId", "name username email")
      .populate("items.cardId", "name image rarity setName")
      .populate("fulfillments.shopId", "name username")
      .lean();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (err) {
    console.error("[admin/orders/[id] GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { status } = body as { status?: string };

  try {
    await connectDB();

    const validStatuses = ["pending_payment", "paid", "processing", "shipped", "delivered", "cancelled"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    if (status) update.status = status;

    const order = await Order.findByIdAndUpdate(id, update, { returnDocument: "after" });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, status: order.status });
  } catch (err) {
    console.error("[admin/orders/[id] PATCH]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify types compile**

```bash
npx tsc --noEmit --pretty
```

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/orders/route.ts app/api/admin/orders/[id]/route.ts
git commit -m "feat: add admin orders API routes"
```

---

## Task 19: Create User Orders API

**Files:**
- Create: `app/api/orders/route.ts`
- Create: `app/api/orders/[id]/route.ts`

- [ ] **Step 1: Create GET /api/orders (user's order history)**

```typescript
// app/api/orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Order from "@/models/order";
import "@/models/card";

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.max(1, Math.min(50, parseInt(searchParams.get("limit") ?? "20", 10)));

  try {
    await connectDB();

    const [orders, total] = await Promise.all([
      Order.find({ userId })
        .populate("items.cardId", "name image rarity setName")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Order.countDocuments({ userId }),
    ]);

    return NextResponse.json({
      orders: orders.map((o) => ({
        _id: o._id.toString(),
        orderNumber: o.orderNumber,
        items: o.items,
        status: o.status,
        paymentMethod: o.paymentMethod,
        shippingCostCents: o.shippingCostCents,
        fulfillments: o.fulfillments.map((f) => ({
          status: f.status,
          trackingNumber: f.trackingNumber,
          shippedAt: f.shippedAt,
          itemCount: f.items.length,
        })),
        createdAt: o.createdAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[orders GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create GET /api/orders/[id] (order detail)**

```typescript
// app/api/orders/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Order from "@/models/order";
import "@/models/card";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await connectDB();

    const order = await Order.findOne({ _id: id, userId })
      .populate("items.cardId", "name image rarity setName")
      .lean();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({
      _id: order._id.toString(),
      orderNumber: order.orderNumber,
      items: order.items,
      shippingAddress: order.shippingAddress,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      shippingCostCents: order.shippingCostCents,
      fulfillments: order.fulfillments.map((f) => ({
        status: f.status,
        trackingNumber: f.trackingNumber,
        shippedAt: f.shippedAt,
        itemCount: f.items.length,
      })),
      status: order.status,
      createdAt: order.createdAt,
    });
  } catch (err) {
    console.error("[orders/[id] GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify types compile**

```bash
npx tsc --noEmit --pretty
```

- [ ] **Step 4: Commit**

```bash
git add app/api/orders/route.ts app/api/orders/[id]/route.ts
git commit -m "feat: add user orders API routes"
```

---

## Task 20: Remove Old Claimed Routes and Model

**Files:**
- Delete: `app/api/claimed/route.ts`
- Delete: `models/user-inventory.ts`
- Delete: `app/[lang]/(dashboard)/(pages)/claimed/page.tsx`
- Modify: `components/layout/sidebar-nav.ts:12`
- Modify: `components/layout/user-header.tsx:111-121,236-248`

- [ ] **Step 1: Delete old files**

```bash
rm app/api/claimed/route.ts
rm models/user-inventory.ts
rm app/[lang]/\(dashboard\)/\(pages\)/claimed/page.tsx
rmdir app/[lang]/\(dashboard\)/\(pages\)/claimed 2>/dev/null || true
```

- [ ] **Step 2: Update sidebar-nav.ts — replace "claimed" with "cart" and "orders"**

In `components/layout/sidebar-nav.tsx`, replace line 12:

```typescript
  { key: "cart", href: "/cart", icon: "ShoppingCart" },
  { key: "orders", href: "/orders", icon: "Package" },
```

Also add to `shopNavItems` (after the existing shopInventory entry):
```typescript
  { key: "shopFulfillments", href: "/shop/fulfillments", icon: "Truck" },
```

Also add to `adminNavItems` (after the existing entries, before the closing `]`):
```typescript
  { key: "adminOrders", href: "/admin/orders", icon: "ClipboardList" },
  { key: "adminShipping", href: "/admin/shipping", icon: "Truck" },
```

- [ ] **Step 3: Update user-header.tsx — replace claimed links with cart**

In `components/layout/user-header.tsx`, replace the desktop nav link (around lines 110-121) from `/claimed` to `/cart`:

Change `href={/${lang}/claimed}` to `href={/${lang}/cart}` (both desktop and mobile occurrences).
Change `pathname.startsWith(/${lang}/claimed)` to `pathname.startsWith(/${lang}/cart)`.
Change `dict["claimed"] ?? "Sammlung"` to `dict["cart"] ?? "Warenkorb"`.
Change the `<Layers` icon to `<ShoppingCart` (import from lucide-react).

Apply the same changes for the mobile menu occurrence (around lines 236-248).

- [ ] **Step 4: Remove any remaining imports of UserInventory**

Search for any remaining imports:

```bash
grep -r "user-inventory\|UserInventory" --include="*.ts" --include="*.tsx" -l
```

Remove or update any found imports. The `app/api/pulls/decide/route.ts` import was already replaced in Task 12.

- [ ] **Step 5: Verify types compile**

```bash
npx tsc --noEmit --pretty
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: remove claimed page/API, replace with cart/orders navigation"
```

---

## Task 21: Create Frontend Cart Page

**Files:**
- Create: `app/[lang]/(dashboard)/(pages)/cart/page.tsx`
- Create: `components/cart/cart-page.tsx`

- [ ] **Step 1: Create the cart page route**

```typescript
// app/[lang]/(dashboard)/(pages)/cart/page.tsx
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { CartPage } from "@/components/cart/cart-page";

export default async function CartPageRoute({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale, "cart");

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {dict.pageTitle || "Warenkorb"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {dict.pageSubtitle || "Deine reservierten Karten. Schließe den Versand innerhalb der Frist ab."}
        </p>
      </div>
      <CartPage lang={lang} dict={dict} />
    </div>
  );
}
```

- [ ] **Step 2: Create the CartPage client component**

This is a large component. Create `components/cart/cart-page.tsx` with:
- Fetches `GET /api/cart` on mount
- Displays card grid with countdown timers per card
- "In Coins umwandeln" button per card (calls `DELETE /api/cart/[itemId]`)
- Shipping address form (pre-filled from user data via `GET /api/account/profile`)
- Country selector (DE/AT/CH)
- Shipping cost display (calls `POST /api/cart/shipping-estimate`)
- Payment method selector (Coins / Stripe)
- Checkout button (calls `POST /api/cart/checkout`)
- Empty state with link to packs
- Reservation info banner with the transparent 6h communication text

The component is a "use client" component with state management for address, payment method, and checkout loading. Use existing UI patterns from the codebase (tailwind classes, `bg-card`, `text-text-primary`, etc.).

**Note:** This is a large UI component — the implementing agent should follow existing component patterns from `components/balance/balance-page.tsx` and `components/packs/pack-opening.tsx` for styling consistency.

- [ ] **Step 3: Verify types compile**

```bash
npx tsc --noEmit --pretty
```

- [ ] **Step 4: Commit**

```bash
git add app/[lang]/\(dashboard\)/\(pages\)/cart/ components/cart/
git commit -m "feat: add cart page with countdown timers and checkout flow"
```

---

## Task 22: Create Frontend Orders Pages

**Files:**
- Create: `app/[lang]/(dashboard)/(pages)/orders/page.tsx`
- Create: `app/[lang]/(dashboard)/(pages)/orders/[id]/page.tsx`
- Create: `components/orders/orders-list.tsx`
- Create: `components/orders/order-detail.tsx`

- [ ] **Step 1: Create order list page**

```typescript
// app/[lang]/(dashboard)/(pages)/orders/page.tsx
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { OrdersList } from "@/components/orders/orders-list";

export default async function OrdersPageRoute({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale, "orders");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {dict.pageTitle || "Bestellungen"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {dict.pageSubtitle || "Deine Bestellhistorie und Versandstatus."}
        </p>
      </div>
      <OrdersList lang={lang} dict={dict} />
    </div>
  );
}
```

- [ ] **Step 2: Create order detail page**

```typescript
// app/[lang]/(dashboard)/(pages)/orders/[id]/page.tsx
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { OrderDetail } from "@/components/orders/order-detail";

export default async function OrderDetailPageRoute({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  const dict = await getDictionary(lang as Locale, "orders");

  return (
    <div className="space-y-6">
      <OrderDetail lang={lang} dict={dict} orderId={id} />
    </div>
  );
}
```

- [ ] **Step 3: Create OrdersList component**

Create `components/orders/orders-list.tsx` — a "use client" component that:
- Fetches `GET /api/orders` with pagination
- Displays order cards showing: orderNumber, date, card count, status badge, payment method
- Click navigates to order detail page
- Empty state: "Noch keine Bestellungen"

- [ ] **Step 4: Create OrderDetail component**

Create `components/orders/order-detail.tsx` — a "use client" component that:
- Fetches `GET /api/orders/[id]`
- Shows: order number, date, status, shipping address, card grid with images
- Fulfillment sections with status and tracking number (if available)
- Back button to orders list

- [ ] **Step 5: Verify types compile**

```bash
npx tsc --noEmit --pretty
```

- [ ] **Step 6: Commit**

```bash
git add app/[lang]/\(dashboard\)/\(pages\)/orders/ components/orders/
git commit -m "feat: add orders list and detail pages"
```

---

## Task 23: Create Shop Fulfillment Page

**Files:**
- Create: `app/[lang]/(dashboard)/shop/fulfillments/page.tsx`
- Create: `components/shop/shop-fulfillments.tsx`

- [ ] **Step 1: Create shop fulfillments page**

```typescript
// app/[lang]/(dashboard)/shop/fulfillments/page.tsx
import { ShopFulfillments } from "@/components/shop/shop-fulfillments";

export default async function ShopFulfillmentsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const isDe = lang === "de";

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {isDe ? "Versandaufträge" : "Fulfillment Orders"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {isDe
            ? "Verwalte deine zugewiesenen Versandaufträge."
            : "Manage your assigned shipping orders."}
        </p>
      </div>
      <ShopFulfillments lang={lang} />
    </div>
  );
}
```

- [ ] **Step 2: Create ShopFulfillments component**

Create `components/shop/shop-fulfillments.tsx` — a "use client" component that:
- Fetches `GET /api/shop/fulfillments` with status filter tabs (pending, processing, shipped, delivered)
- Shows order cards with: order number, user name, shipping address, assigned cards
- Action buttons: "Verarbeiten" (→ processing), "Versendet" (→ shipped with optional tracking input), "Zugestellt" (→ delivered)
- Calls `PATCH /api/shop/fulfillments/[orderId]` on action

- [ ] **Step 3: Verify types compile**

```bash
npx tsc --noEmit --pretty
```

- [ ] **Step 4: Commit**

```bash
git add app/[lang]/\(dashboard\)/shop/fulfillments/ components/shop/shop-fulfillments.tsx
git commit -m "feat: add shop fulfillment management page"
```

---

## Task 24: Create Admin Shipping and Orders Pages

**Files:**
- Create: `app/[lang]/(dashboard)/admin/shipping/page.tsx`
- Create: `components/admin/shipping-tiers-manager.tsx`
- Create: `app/[lang]/(dashboard)/admin/orders/page.tsx`
- Create: `components/admin/admin-orders.tsx`

- [ ] **Step 1: Create admin shipping tier page**

```typescript
// app/[lang]/(dashboard)/admin/shipping/page.tsx
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { ShippingTiersManager } from "@/components/admin/shipping-tiers-manager";

export default async function AdminShippingPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const adminDict = await getDictionary(lang as Locale, "admin");

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {adminDict["shipping_pageTitle"] ?? "Versandkosten"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {adminDict["shipping_pageSubtitle"] ?? "Versandkosten-Staffeln nach Land und Kartenanzahl verwalten."}
        </p>
      </div>
      <ShippingTiersManager lang={lang} dict={adminDict} />
    </div>
  );
}
```

- [ ] **Step 2: Create ShippingTiersManager component**

Create `components/admin/shipping-tiers-manager.tsx` — a "use client" component that:
- Fetches `GET /api/admin/shipping-tiers`
- Displays tiers in a table grouped by country
- Add tier form: country, minCards, maxCards, costCents, costCoins
- Calls `POST /api/admin/shipping-tiers` to create

- [ ] **Step 3: Create admin orders page**

```typescript
// app/[lang]/(dashboard)/admin/orders/page.tsx
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { AdminOrders } from "@/components/admin/admin-orders";

export default async function AdminOrdersPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const adminDict = await getDictionary(lang as Locale, "admin");

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {adminDict["orders_pageTitle"] ?? "Bestellungen"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {adminDict["orders_pageSubtitle"] ?? "Alle Bestellungen verwalten und Status überwachen."}
        </p>
      </div>
      <AdminOrders lang={lang} dict={adminDict} />
    </div>
  );
}
```

- [ ] **Step 4: Create AdminOrders component**

Create `components/admin/admin-orders.tsx` — a "use client" component that:
- Fetches `GET /api/admin/orders` with status filters and pagination
- Displays orders table: order number, user, status, payment, date, card count
- Click navigates to admin order detail (can reuse the user order detail with admin context)
- Status filter dropdown

- [ ] **Step 5: Verify types compile**

```bash
npx tsc --noEmit --pretty
```

- [ ] **Step 6: Commit**

```bash
git add app/[lang]/\(dashboard\)/admin/shipping/ app/[lang]/\(dashboard\)/admin/orders/ components/admin/shipping-tiers-manager.tsx components/admin/admin-orders.tsx
git commit -m "feat: add admin shipping tiers and orders management pages"
```

---

## Task 25: Update Pack Opening Component

**Files:**
- Modify: `components/packs/pack-opening.tsx`

- [ ] **Step 1: Update the pack opening decision phase**

In `components/packs/pack-opening.tsx`, update the claim flow:

1. Change the "Claim" button label to "In den Warenkorb" (DE) / "Add to Cart" (EN)
2. After a successful claim response (`decision: "reserved"`), show a small toast/badge: "6h reserviert — zum Warenkorb"
3. The response now returns `expiresAt` — display this to the user
4. Import `ShoppingCart` from lucide-react for the button icon

The exact changes depend on the current component structure. The implementing agent should:
- Read the full component
- Find where `decision === "claimed"` is handled in the response
- Change to handle `decision === "reserved"` with `expiresAt`
- Update the button text and add cart link after claim

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit --pretty
```

- [ ] **Step 3: Commit**

```bash
git add components/packs/pack-opening.tsx
git commit -m "feat: update pack opening to show cart reservation instead of claim"
```

---

## Task 26: Delete InventoryGrid Component (if exists)

**Files:**
- Investigate and delete: `components/inventory/inventory-grid.tsx` (and any related files)

- [ ] **Step 1: Find and remove the InventoryGrid component**

```bash
find components/inventory -type f 2>/dev/null
```

Delete the entire `components/inventory/` directory if it exists and is only used by the removed claimed page. First verify no other pages import from it:

```bash
grep -r "components/inventory\|inventory-grid" --include="*.ts" --include="*.tsx" -l
```

If only referenced by the deleted claimed page, remove it:
```bash
rm -rf components/inventory
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit --pretty
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove unused InventoryGrid component"
```

---

## Task 27: Final Verification

- [ ] **Step 1: Full type check**

```bash
npx tsc --noEmit --pretty
```

Expected: No errors.

- [ ] **Step 2: Lint check**

```bash
npm run lint
```

Fix any lint errors.

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Manual smoke test checklist**

Start the dev server and verify:

1. Open a pack → claim a card → response includes `expiresAt`
2. `GET /api/cart` → shows the reserved card with countdown
3. `DELETE /api/cart/[itemId]` → card converted, coins returned
4. `POST /api/cart/shipping-estimate` → returns cost for given country
5. `POST /api/cart/checkout` with coins → order created, CartItems checked out
6. `GET /api/orders` → shows the order
7. `GET /api/admin/shipping-tiers` → works (empty initially)
8. `POST /api/admin/shipping-tiers` → creates a tier
9. Navigation shows "Warenkorb" instead of "Sammlung"
10. `/claimed` page returns 404

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: address build and lint issues from shipping system implementation"
```
