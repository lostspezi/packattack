# Inventory & Shop-System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a global card inventory system with shop partner registration, automatic card substitution when box stock hits zero, and admin/shop management UIs.

**Architecture:** New `InventoryItem` and `ShopProfile` Mongoose models back REST APIs. When a box card hits stock=0 during pack opening, `lib/substitution.ts` finds a ±5-coin replacement from the global inventory and updates the box in-place. Shops register via Account Settings, admins approve via `/admin/shops`, and approved shops manage their inventory at `/shop/inventory`.

**Tech Stack:** Next.js App Router, Mongoose, MongoDB GridFS (license uploads), Zod validation, TypeScript

---

> **Note on testing:** No test runner is configured. Each task uses `npm run typecheck` (runs `tsc --noEmit`) as the primary verification step. Run from the project root.

---

## File Map

**New models:**
- `models/inventory-item.ts` — InventoryItem schema
- `models/shop-profile.ts` — ShopProfile schema

**Modified models:**
- `models/box.ts` — add `isSubstitute`, `originalCard` to `IBoxCard`

**New lib:**
- `lib/substitution.ts` — substitution logic called from pack-open route
- `lib/gridfs-licenses.ts` — GridFS upload/download/delete for shop license documents

**Modified lib:**
- `lib/validations.ts` — add `shopApplySchema`
- `app/api/packs/[id]/open/route.ts` — call `runSubstitutions` after stock decrements

**New API routes:**
- `app/api/shop/apply/route.ts` — POST: submit shop application
- `app/api/shop/profile/route.ts` — GET: own ShopProfile
- `app/api/admin/shops/route.ts` — GET: list all applications
- `app/api/admin/shops/[id]/route.ts` — PATCH: approve/reject
- `app/api/admin/shops/[id]/license/route.ts` — GET: stream license file
- `app/api/inventory/route.ts` — GET/POST: shop inventory items
- `app/api/inventory/[id]/route.ts` — PATCH/DELETE: shop inventory item
- `app/api/admin/inventory/route.ts` — GET: all inventory items
- `app/api/admin/inventory/[id]/route.ts` — PATCH: admin override

**New components:**
- `components/shop/shop-apply-form.tsx` — application form with file upload
- `components/shop/shop-inventory-table.tsx` — shop CRUD table
- `components/admin/shops-table.tsx` — admin approval table
- `components/admin/inventory-overview-table.tsx` — admin inventory table

**New pages:**
- `app/[lang]/(dashboard)/settings/page.tsx` — modified: add "Als Shop bewerben" section
- `app/[lang]/(dashboard)/shop/layout.tsx` — auth guard: shop role only
- `app/[lang]/(dashboard)/shop/inventory/page.tsx` — shop inventory page
- `app/[lang]/(dashboard)/admin/shops/page.tsx` — admin shop applications
- `app/[lang]/(dashboard)/admin/inventory/page.tsx` — admin inventory overview

---

## Task 1: InventoryItem Model

**Files:**
- Create: `models/inventory-item.ts`

- [ ] **Step 1: Create the model**

```typescript
// models/inventory-item.ts
import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IInventoryItem extends Document {
  card: Types.ObjectId;
  shop: Types.ObjectId;
  stock: number;
  ean: string | null;
  sku: string | null;
  notes: string | null;
  pricePerUnit: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryItemSchema = new Schema<IInventoryItem>(
  {
    card: { type: Schema.Types.ObjectId, ref: "Card", required: true },
    shop: { type: Schema.Types.ObjectId, ref: "User", required: true },
    stock: { type: Number, required: true, default: 0, min: 0 },
    ean: { type: String, default: null },
    sku: { type: String, default: null },
    notes: { type: String, default: null },
    pricePerUnit: { type: Number, default: null },
  },
  { timestamps: true }
);

InventoryItemSchema.index({ shop: 1 });
InventoryItemSchema.index({ card: 1 });
InventoryItemSchema.index({ shop: 1, card: 1 });

const InventoryItem: Model<IInventoryItem> =
  mongoose.models.InventoryItem ??
  mongoose.model<IInventoryItem>("InventoryItem", InventoryItemSchema);

export default InventoryItem;
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: no errors related to `models/inventory-item.ts`

- [ ] **Step 3: Commit**

```bash
git add models/inventory-item.ts
git commit -m "feat: InventoryItem mongoose model"
```

---

## Task 2: ShopProfile Model + GridFS Licenses

**Files:**
- Create: `models/shop-profile.ts`
- Create: `lib/gridfs-licenses.ts`

- [ ] **Step 1: Create ShopProfile model**

```typescript
// models/shop-profile.ts
import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type ShopStatus = "pending" | "approved" | "rejected";

export interface IShopProfile extends Document {
  user: Types.ObjectId;
  companyName: string;
  status: ShopStatus;
  rejectReason: string | null;
  licenseFileId: string | null;
  licenseFileName: string | null;
  submittedAt: Date;
  reviewedBy: Types.ObjectId | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ShopProfileSchema = new Schema<IShopProfile>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    companyName: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    rejectReason: { type: String, default: null },
    licenseFileId: { type: String, default: null },
    licenseFileName: { type: String, default: null },
    submittedAt: { type: Date, required: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ShopProfileSchema.index({ status: 1 });

const ShopProfile: Model<IShopProfile> =
  mongoose.models.ShopProfile ??
  mongoose.model<IShopProfile>("ShopProfile", ShopProfileSchema);

export default ShopProfile;
```

- [ ] **Step 2: Create GridFS license helpers**

```typescript
// lib/gridfs-licenses.ts
import { MongoClient, GridFSBucket, ObjectId } from "mongodb";
import type { Readable } from "stream";

let _client: MongoClient | null = null;

function getMongoClient(): MongoClient {
  if (!_client) {
    _client = new MongoClient(process.env.MONGODB_URI!);
  }
  return _client;
}

async function getBucket(): Promise<GridFSBucket> {
  const client = getMongoClient();
  await client.connect();
  const db = client.db();
  return new GridFSBucket(db, { bucketName: "licenses" });
}

export async function uploadLicense(
  userId: string,
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  // Delete existing license first
  await deleteLicense(userId);

  const bucket = await getBucket();

  return new Promise<string>((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      metadata: { userId },
      contentType,
    });

    uploadStream.on("error", reject);
    uploadStream.on("finish", () => resolve(uploadStream.id.toString()));

    uploadStream.end(buffer);
  });
}

export async function getLicense(fileId: string): Promise<{
  stream: Readable;
  contentType: string;
  filename: string;
} | null> {
  const bucket = await getBucket();

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(fileId);
  } catch {
    return null;
  }

  const files = await bucket.find({ _id: objectId }).toArray();
  if (files.length === 0) return null;

  const file = files[0];
  const stream = bucket.openDownloadStream(objectId);

  return {
    stream: stream as unknown as Readable,
    contentType: file.contentType ?? "application/pdf",
    filename: file.filename,
  };
}

export async function deleteLicense(userId: string): Promise<void> {
  const bucket = await getBucket();
  const files = await bucket.find({ "metadata.userId": userId }).toArray();
  for (const file of files) {
    await bucket.delete(file._id as ObjectId);
  }
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add models/shop-profile.ts lib/gridfs-licenses.ts
git commit -m "feat: ShopProfile model and GridFS license helpers"
```

---

## Task 3: Box Schema — isSubstitute + originalCard

**Files:**
- Modify: `models/box.ts`

- [ ] **Step 1: Add fields to IBoxCard interface**

In `models/box.ts`, extend `IBoxCard`:

```typescript
// Replace existing IBoxCard interface with:
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
```

- [ ] **Step 2: Add fields to BoxSchema cards array**

In the `cards` array definition inside `BoxSchema`, add after `conditions`:

```typescript
isSubstitute: { type: Boolean, default: false },
originalCard: { type: Schema.Types.ObjectId, ref: "Card", default: null },
```

So the full cards array becomes:
```typescript
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
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add models/box.ts
git commit -m "feat: add isSubstitute and originalCard fields to box card entries"
```

---

## Task 4: Substitution Logic

**Files:**
- Create: `lib/substitution.ts`

- [ ] **Step 1: Create substitution module**

```typescript
// lib/substitution.ts
/**
 * Card substitution logic.
 * When a box card hits stock=0, find a replacement from global InventoryItem
 * within ±5 coins and update the box card in-place.
 *
 * Called from /api/packs/[id]/open after atomic stock decrements.
 */

import connectDB from "@/lib/db";
import Box from "@/models/box";
import Card from "@/models/card";
import InventoryItem from "@/models/inventory-item";
import Notification from "@/models/notification";
import User from "@/models/user";
import { Types } from "mongoose";

export interface SubstitutionInput {
  boxId: string;
  /** Map of cardId → number of units drawn in this opening (only cards that just hit 0) */
  depletedCards: Record<string, number>;
}

export interface SubstitutionResult {
  substituted: Array<{ originalCardId: string; newCardId: string }>;
  boxPaused: boolean;
}

/**
 * Run substitutions for all cards that just hit stock=0.
 * Updates the box document in MongoDB and sends admin notifications.
 */
export async function runSubstitutions(
  input: SubstitutionInput
): Promise<SubstitutionResult> {
  await connectDB();

  const { boxId, depletedCards } = input;
  const boxObjectId = new Types.ObjectId(boxId);

  const box = await Box.findById(boxObjectId);
  if (!box) return { substituted: [], boxPaused: false };

  const admins = await User.find({ role: { $in: ["admin", "super_admin"] } })
    .select("_id")
    .lean();
  const adminIds = admins.map((a) => a._id.toString());
  const boxName = box.name?.de ?? box.name?.en ?? "Box";

  const substituted: Array<{ originalCardId: string; newCardId: string }> = [];
  let boxPaused = false;
  let pauseTriggered = false;

  for (const [cardId, drawnCount] of Object.entries(depletedCards)) {
    const cardObjectId = new Types.ObjectId(cardId);

    // Get original card's internalPrice
    const originalCard = await Card.findById(cardObjectId).select("internalPrice name").lean();
    if (!originalCard) continue;

    const originalPrice = originalCard.internalPrice ?? 0;
    const originalName = originalCard.name ?? "Unknown";

    // Find best matching InventoryItem within ±5 coins, excluding the same card
    const candidates = await InventoryItem.aggregate([
      {
        $match: {
          stock: { $gt: 0 },
          card: { $ne: cardObjectId },
        },
      },
      {
        $lookup: {
          from: "cards",
          localField: "card",
          foreignField: "_id",
          as: "cardDoc",
        },
      },
      { $unwind: "$cardDoc" },
      {
        $match: {
          "cardDoc.internalPrice": {
            $gte: originalPrice - 5,
            $lte: originalPrice + 5,
          },
        },
      },
      {
        $addFields: {
          priceDiff: { $abs: { $subtract: ["$cardDoc.internalPrice", originalPrice] } },
        },
      },
      { $sort: { priceDiff: 1 } },
      { $limit: 1 },
    ]);

    if (candidates.length === 0) {
      // No substitute found — pause box once and notify
      if (!pauseTriggered) {
        await Box.updateOne({ _id: boxObjectId }, { $set: { status: "paused" } });
        pauseTriggered = true;
        boxPaused = true;
      }

      for (const adminId of adminIds) {
        await Notification.create({
          userId: adminId,
          title: `Kein Ersatz: ${originalName}`,
          message: `Keine Ersatzkarte für "${originalName}" in "${boxName}" gefunden. Box wurde pausiert.`,
          type: "error",
          cta: { label: "Box öffnen", url: `/de/admin/boxes/${boxId}` },
        });
      }
      continue;
    }

    const candidate = candidates[0] as {
      _id: Types.ObjectId;
      card: Types.ObjectId;
      stock: number;
      cardDoc: { _id: Types.ObjectId; name: string; internalPrice: number };
    };

    const substituteAmount = Math.min(candidate.stock, drawnCount);

    // Atomically decrement InventoryItem stock
    const updateResult = await InventoryItem.findOneAndUpdate(
      { _id: candidate._id, stock: { $gte: substituteAmount } },
      { $inc: { stock: -substituteAmount } }
    );
    if (!updateResult) continue; // Race condition — skip

    // Update the box card entry in-place
    await Box.updateOne(
      { _id: boxObjectId, "cards.card": cardObjectId },
      {
        $set: {
          "cards.$.card": candidate.card,
          "cards.$.stock": substituteAmount,
          "cards.$.isSubstitute": true,
          "cards.$.originalCard": cardObjectId,
        },
      }
    );

    substituted.push({
      originalCardId: cardId,
      newCardId: candidate.card.toString(),
    });

    // Notify admins about substitution
    for (const adminId of adminIds) {
      await Notification.create({
        userId: adminId,
        title: `Karte substituiert: ${originalName}`,
        message: `"${originalName}" in "${boxName}" wurde durch "${candidate.cardDoc.name}" ersetzt (${substituteAmount} Stück).`,
        type: "info",
        cta: { label: "Box öffnen", url: `/de/admin/boxes/${boxId}` },
      });
    }
  }

  return { substituted, boxPaused };
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add lib/substitution.ts
git commit -m "feat: card substitution logic for depleted box cards"
```

---

## Task 5: Integrate Substitution into Pack-Open Route

**Files:**
- Modify: `app/api/packs/[id]/open/route.ts`

- [ ] **Step 1: Import and call runSubstitutions**

After the existing `// 9. Check for low-stock / out-of-stock notifications` block (around line 159), add the substitution call.

Find this block:
```typescript
    // 9. Check for low-stock / out-of-stock notifications (only for drawn cards)
    if (updatedBox) void sendStockAlerts(updatedBox, cardMap, stockUpdates);
```

Replace with:
```typescript
    // 9. Check for low-stock / out-of-stock notifications (only for drawn cards)
    if (updatedBox) void sendStockAlerts(updatedBox, cardMap, stockUpdates);

    // 10. Substitute depleted cards from global inventory
    const depletedCards: Record<string, number> = {};
    if (updatedBox) {
      for (const [cardId, drawnCount] of Object.entries(stockUpdates)) {
        const entry = updatedBox.cards.find((c) => c.card.toString() === cardId);
        if (entry && (entry.stock ?? 0) === 0) {
          depletedCards[cardId] = drawnCount;
        }
      }
    }
    if (Object.keys(depletedCards).length > 0) {
      void runSubstitutions({ boxId: realBoxId.toString(), depletedCards });
    }
```

- [ ] **Step 2: Add import at top of the file**

Add after the existing imports:
```typescript
import { runSubstitutions } from "@/lib/substitution";
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add app/api/packs/[id]/open/route.ts
git commit -m "feat: trigger card substitution when box card hits stock zero"
```

---

## Task 6: Shop Apply API + Validation

**Files:**
- Modify: `lib/validations.ts`
- Create: `app/api/shop/apply/route.ts`
- Create: `app/api/shop/profile/route.ts`

- [ ] **Step 1: Add shopApplySchema to validations**

Append to `lib/validations.ts`:
```typescript
export const shopApplySchema = z.object({
  companyName: z.string().min(2).max(100),
});
```

- [ ] **Step 2: Create shop apply route**

```typescript
// app/api/shop/apply/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import ShopProfile from "@/models/shop-profile";
import User from "@/models/user";
import Notification from "@/models/notification";
import { uploadLicense } from "@/lib/gridfs-licenses";
import { shopApplySchema } from "@/lib/validations";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg"];

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const companyName = formData.get("companyName");
    const file = formData.get("file");

    // Validate companyName
    const parsed = shopApplySchema.safeParse({ companyName });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Gewerbenachweis ist erforderlich" }, { status: 400 });
    }

    const blob = file as File;
    if (!ALLOWED_TYPES.includes(blob.type)) {
      return NextResponse.json(
        { error: "Nur PDF, PNG oder JPG erlaubt" },
        { status: 400 }
      );
    }
    if (blob.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Datei darf maximal 5 MB groß sein" },
        { status: 400 }
      );
    }

    await connectDB();

    // Check if already applied
    const existing = await ShopProfile.findOne({ user: userId });
    if (existing) {
      if (existing.status === "approved") {
        return NextResponse.json({ error: "Bereits freigeschaltet" }, { status: 400 });
      }
      if (existing.status === "pending") {
        return NextResponse.json({ error: "Bewerbung bereits eingereicht" }, { status: 400 });
      }
      // If rejected, allow re-application — delete old profile
      await ShopProfile.deleteOne({ user: userId });
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    const ext = blob.type === "application/pdf" ? "pdf" : blob.type === "image/png" ? "png" : "jpg";
    const filename = `license-${userId}.${ext}`;

    const fileId = await uploadLicense(userId, buffer, filename, blob.type);

    const profile = await ShopProfile.create({
      user: userId,
      companyName: parsed.data.companyName,
      status: "pending",
      licenseFileId: fileId,
      licenseFileName: filename,
      submittedAt: new Date(),
    });

    // Notify all admins
    const admins = await User.find({ role: { $in: ["admin", "super_admin"] } })
      .select("_id")
      .lean();
    for (const admin of admins) {
      await Notification.create({
        userId: admin._id.toString(),
        title: "Neue Shop-Bewerbung",
        message: `${parsed.data.companyName} hat eine Shop-Bewerbung eingereicht.`,
        type: "info",
        cta: { label: "Bewerbung prüfen", url: `/de/admin/shops` },
      });
    }

    return NextResponse.json({ success: true, profileId: profile._id.toString() }, { status: 201 });
  } catch (err) {
    console.error("[shop/apply POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create shop profile route**

```typescript
// app/api/shop/profile/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import ShopProfile from "@/models/shop-profile";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const profile = await ShopProfile.findOne({ user: userId }).lean();
    if (!profile) {
      return NextResponse.json({ profile: null });
    }
    return NextResponse.json({
      profile: {
        _id: profile._id.toString(),
        companyName: profile.companyName,
        status: profile.status,
        rejectReason: profile.rejectReason,
        submittedAt: profile.submittedAt,
        reviewedAt: profile.reviewedAt,
      },
    });
  } catch (err) {
    console.error("[shop/profile GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add lib/validations.ts app/api/shop/apply/route.ts app/api/shop/profile/route.ts
git commit -m "feat: shop application API with license upload"
```

---

## Task 7: Admin Shops API

**Files:**
- Create: `app/api/admin/shops/route.ts`
- Create: `app/api/admin/shops/[id]/route.ts`
- Create: `app/api/admin/shops/[id]/license/route.ts`

- [ ] **Step 1: Create admin shops list route**

```typescript
// app/api/admin/shops/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import ShopProfile from "@/models/shop-profile";

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10));

  const query: Record<string, unknown> = {};
  if (status) query.status = status;

  try {
    await connectDB();
    const [profiles, total] = await Promise.all([
      ShopProfile.find(query)
        .populate("user", "name email")
        .populate("reviewedBy", "name")
        .sort({ submittedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ShopProfile.countDocuments(query),
    ]);

    return NextResponse.json({
      profiles: profiles.map((p) => ({
        _id: p._id.toString(),
        companyName: p.companyName,
        status: p.status,
        rejectReason: p.rejectReason,
        licenseFileName: p.licenseFileName,
        submittedAt: p.submittedAt,
        reviewedAt: p.reviewedAt,
        user: p.user,
        reviewedBy: p.reviewedBy,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[admin/shops GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create admin shop approve/reject route**

```typescript
// app/api/admin/shops/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import ShopProfile from "@/models/shop-profile";
import User from "@/models/user";
import Notification from "@/models/notification";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const adminId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || !adminId || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, rejectReason } = body as {
    action?: "approve" | "reject";
    rejectReason?: string;
  };

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });
  }
  if (action === "reject" && !rejectReason?.trim()) {
    return NextResponse.json({ error: "rejectReason required when rejecting" }, { status: 400 });
  }

  try {
    await connectDB();
    const profile = await ShopProfile.findById(id);
    if (!profile) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    profile.status = action === "approve" ? "approved" : "rejected";
    profile.rejectReason = action === "reject" ? (rejectReason ?? null) : null;
    profile.reviewedBy = new (await import("mongoose")).Types.ObjectId(adminId);
    profile.reviewedAt = new Date();
    await profile.save();

    // Update user role
    if (action === "approve") {
      await User.findByIdAndUpdate(profile.user, { role: "shop" });
    }

    // Notify the applicant
    await Notification.create({
      userId: profile.user.toString(),
      title: action === "approve" ? "Shop-Bewerbung angenommen" : "Shop-Bewerbung abgelehnt",
      message:
        action === "approve"
          ? "Deine Shop-Bewerbung wurde angenommen. Du kannst jetzt dein Inventar verwalten."
          : `Deine Shop-Bewerbung wurde abgelehnt: ${rejectReason}`,
      type: action === "approve" ? "success" : "error",
      cta:
        action === "approve"
          ? { label: "Inventar verwalten", url: `/de/shop/inventory` }
          : undefined,
    });

    return NextResponse.json({ success: true, status: profile.status });
  } catch (err) {
    console.error("[admin/shops/[id] PATCH]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create license file streaming route**

```typescript
// app/api/admin/shops/[id]/license/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import ShopProfile from "@/models/shop-profile";
import { getLicense } from "@/lib/gridfs-licenses";
import { Readable } from "stream";
import { ReadableStream } from "stream/web";

export async function GET(
  _req: NextRequest,
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
    const profile = await ShopProfile.findById(id).lean();
    if (!profile?.licenseFileId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const result = await getLicense(profile.licenseFileId);
    if (!result) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const webStream = Readable.toWeb(result.stream) as ReadableStream;

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `inline; filename="${result.filename}"`,
      },
    });
  } catch (err) {
    console.error("[admin/shops/[id]/license GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/shops/route.ts "app/api/admin/shops/[id]/route.ts" "app/api/admin/shops/[id]/license/route.ts"
git commit -m "feat: admin shops API — list, approve/reject, stream license"
```

---

## Task 8: Inventory API (Shop)

**Files:**
- Create: `app/api/inventory/route.ts`
- Create: `app/api/inventory/[id]/route.ts`

- [ ] **Step 1: Create GET/POST inventory route**

```typescript
// app/api/inventory/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import InventoryItem from "@/models/inventory-item";

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || !userId || role !== "shop") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10));

  try {
    await connectDB();
    const [items, total] = await Promise.all([
      InventoryItem.find({ shop: userId })
        .populate("card", "name game rarity image internalPrice")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      InventoryItem.countDocuments({ shop: userId }),
    ]);

    return NextResponse.json({
      items: items.map((i) => ({
        _id: i._id.toString(),
        card: i.card,
        stock: i.stock,
        ean: i.ean,
        sku: i.sku,
        notes: i.notes,
        pricePerUnit: i.pricePerUnit,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[inventory GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || !userId || role !== "shop") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { cardId, stock, ean, sku, notes, pricePerUnit } = body as {
    cardId?: string;
    stock?: number;
    ean?: string;
    sku?: string;
    notes?: string;
    pricePerUnit?: number;
  };

  if (!cardId) {
    return NextResponse.json({ error: "cardId is required" }, { status: 400 });
  }
  if (stock === undefined || stock < 0 || !Number.isInteger(stock)) {
    return NextResponse.json({ error: "stock must be a non-negative integer" }, { status: 400 });
  }

  try {
    await connectDB();

    // Prevent duplicate items per shop+card
    const existing = await InventoryItem.findOne({ shop: userId, card: cardId });
    if (existing) {
      return NextResponse.json(
        { error: "Dieser Artikel existiert bereits. Bitte Bestand anpassen." },
        { status: 409 }
      );
    }

    const item = await InventoryItem.create({
      card: cardId,
      shop: userId,
      stock,
      ean: ean ?? null,
      sku: sku ?? null,
      notes: notes ?? null,
      pricePerUnit: pricePerUnit ?? null,
    });

    return NextResponse.json({ _id: item._id.toString() }, { status: 201 });
  } catch (err) {
    console.error("[inventory POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create PATCH/DELETE inventory item route**

```typescript
// app/api/inventory/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import InventoryItem from "@/models/inventory-item";
import Box from "@/models/box";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || !userId || role !== "shop") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { stock, ean, sku, notes, pricePerUnit } = body as {
    stock?: number;
    ean?: string | null;
    sku?: string | null;
    notes?: string | null;
    pricePerUnit?: number | null;
  };

  if (stock !== undefined && (stock < 0 || !Number.isInteger(stock))) {
    return NextResponse.json({ error: "stock must be a non-negative integer" }, { status: 400 });
  }

  try {
    await connectDB();
    const item = await InventoryItem.findOne({ _id: id, shop: userId });
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (stock !== undefined) item.stock = stock;
    if (ean !== undefined) item.ean = ean;
    if (sku !== undefined) item.sku = sku;
    if (notes !== undefined) item.notes = notes;
    if (pricePerUnit !== undefined) item.pricePerUnit = pricePerUnit;

    await item.save();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[inventory/[id] PATCH]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || !userId || role !== "shop") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await connectDB();
    const item = await InventoryItem.findOne({ _id: id, shop: userId });
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Block deletion if card is currently a substitute in any box
    const inUse = await Box.findOne({
      "cards.card": item.card,
      "cards.isSubstitute": true,
    });
    if (inUse) {
      const boxName = inUse.name?.de ?? inUse.name?.en ?? "einer Box";
      return NextResponse.json(
        {
          error: `Diese Karte wird aktuell in "${boxName}" als Ersatz verwendet und kann nicht gelöscht werden.`,
        },
        { status: 409 }
      );
    }

    await item.deleteOne();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[inventory/[id] DELETE]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add app/api/inventory/route.ts "app/api/inventory/[id]/route.ts"
git commit -m "feat: shop inventory API — CRUD with deletion guard"
```

---

## Task 9: Admin Inventory API

**Files:**
- Create: `app/api/admin/inventory/route.ts`
- Create: `app/api/admin/inventory/[id]/route.ts`

- [ ] **Step 1: Create admin inventory list route**

```typescript
// app/api/admin/inventory/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import InventoryItem from "@/models/inventory-item";

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const shopId = searchParams.get("shop") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10));

  const query: Record<string, unknown> = {};
  if (shopId) query.shop = shopId;

  try {
    await connectDB();
    const [items, total] = await Promise.all([
      InventoryItem.find(query)
        .populate("card", "name game rarity image internalPrice")
        .populate("shop", "name email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      InventoryItem.countDocuments(query),
    ]);

    return NextResponse.json({
      items: items.map((i) => ({
        _id: i._id.toString(),
        card: i.card,
        shop: i.shop,
        stock: i.stock,
        ean: i.ean,
        sku: i.sku,
        notes: i.notes,
        pricePerUnit: i.pricePerUnit,
        createdAt: i.createdAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[admin/inventory GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create admin inventory override route**

```typescript
// app/api/admin/inventory/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import InventoryItem from "@/models/inventory-item";

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

  const { stock, notes } = body as { stock?: number; notes?: string | null };

  if (stock !== undefined && (stock < 0 || !Number.isInteger(stock))) {
    return NextResponse.json({ error: "stock must be a non-negative integer" }, { status: 400 });
  }

  try {
    await connectDB();
    const item = await InventoryItem.findById(id);
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (stock !== undefined) item.stock = stock;
    if (notes !== undefined) item.notes = notes;

    await item.save();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/inventory/[id] PATCH]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/inventory/route.ts "app/api/admin/inventory/[id]/route.ts"
git commit -m "feat: admin inventory API — list all and override stock"
```

---

## Task 10: Shop Apply UI (Settings Page)

**Files:**
- Create: `components/shop/shop-apply-form.tsx`
- Modify: `app/[lang]/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Create shop apply form component**

```tsx
// components/shop/shop-apply-form.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";

interface ShopProfile {
  status: "pending" | "approved" | "rejected";
  companyName: string;
  rejectReason: string | null;
  submittedAt: string;
}

export function ShopApplyForm({ lang }: { lang: string }) {
  const isDe = lang === "de";
  const [profile, setProfile] = useState<ShopProfile | null | undefined>(undefined);
  const [companyName, setCompanyName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/shop/profile")
      .then((r) => r.json())
      .then((d: { profile: ShopProfile | null }) => setProfile(d.profile))
      .catch(() => setProfile(null));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError(isDe ? "Bitte Gewerbenachweis hochladen" : "Please upload your business license");
      return;
    }
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.append("companyName", companyName);
    fd.append("file", file);
    try {
      const res = await fetch("/api/shop/apply", { method: "POST", body: fd });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Fehler");
      } else {
        setSuccess(true);
        setProfile({ status: "pending", companyName, rejectReason: null, submittedAt: new Date().toISOString() });
      }
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setLoading(false);
    }
  }

  if (profile === undefined) return null;

  if (profile?.status === "approved") {
    return (
      <p className="text-sm text-success">
        {isDe ? "Dein Shop wurde freigeschaltet." : "Your shop has been approved."}
      </p>
    );
  }

  if (profile?.status === "pending") {
    return (
      <p className="text-sm text-text-secondary">
        {isDe
          ? "Deine Bewerbung wird geprüft. Wir melden uns bei dir."
          : "Your application is under review. We'll get back to you."}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {profile?.status === "rejected" && (
        <div className="rounded-lg border border-error/20 bg-error/10 p-3 text-sm text-error">
          {isDe ? "Abgelehnt" : "Rejected"}: {profile.rejectReason}
        </div>
      )}
      {success && (
        <p className="text-sm text-success">
          {isDe ? "Bewerbung eingereicht!" : "Application submitted!"}
        </p>
      )}
      {error && <p className="text-sm text-error">{error}</p>}

      <div className="space-y-1">
        <label className="text-sm font-medium text-text-primary">
          {isDe ? "Firmenname" : "Company name"}
        </label>
        <input
          type="text"
          required
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder={isDe ? "Musterfirma GmbH" : "Acme Corp"}
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-text-primary">
          {isDe ? "Gewerbenachweis" : "Business license"}{" "}
          <span className="text-text-secondary font-normal">(PDF, PNG, JPG · max 5 MB)</span>
        </label>
        <input
          type="file"
          required
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-text-secondary file:mr-3 file:rounded file:border-0 file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-text-primary"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading
          ? isDe ? "Wird gesendet…" : "Submitting…"
          : isDe ? "Bewerbung einreichen" : "Submit application"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Add ShopApplyForm section to settings page**

In `app/[lang]/(dashboard)/settings/page.tsx`, add the import at the top after existing imports:
```typescript
import { ShopApplyForm } from "@/components/shop/shop-apply-form";
```

Then add the following Card section at the end of the returned JSX, before the closing `</div>`:
```tsx
      {/* Als Shop bewerben */}
      <Card variant="soft" className="p-4 md:p-6">
        <h3 className="text-base font-semibold text-text-primary mb-1">
          {lang === "de" ? "Als Shop bewerben" : "Apply as a shop"}
        </h3>
        <p className="text-sm text-text-secondary mb-4">
          {lang === "de"
            ? "Registriere dich als Partner-Shop und verwalte dein Karteninventar."
            : "Register as a partner shop and manage your card inventory."}
        </p>
        <ShopApplyForm lang={lang} />
      </Card>
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add components/shop/shop-apply-form.tsx "app/[lang]/(dashboard)/settings/page.tsx"
git commit -m "feat: shop apply form in account settings"
```

---

## Task 11: Shop Inventory Page

**Files:**
- Create: `app/[lang]/(dashboard)/shop/layout.tsx`
- Create: `components/shop/shop-inventory-table.tsx`
- Create: `app/[lang]/(dashboard)/shop/inventory/page.tsx`

- [ ] **Step 1: Create shop layout (auth guard)**

```tsx
// app/[lang]/(dashboard)/shop/layout.tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export default async function ShopLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (role !== "shop" && role !== "admin" && role !== "super_admin") {
    redirect(`/${lang}/dashboard`);
  }

  const [dashboardDict] = await Promise.all([
    getDictionary(lang as Locale, "dashboard"),
  ]);

  const userName = session!.user!.name ?? session!.user!.email ?? "User";
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <div className="flex min-h-[calc(100vh-64px)]">
      <Sidebar
        lang={lang}
        dict={{}}
        adminDict={{}}
        dashboardDict={dashboardDict}
        userRole={role}
        userName={userName}
        userInitial={userInitial}
        mode="dashboard"
      />
      <main className="flex-1 p-4 md:p-6 min-w-0">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Create shop inventory table component**

```tsx
// components/shop/shop-inventory-table.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";

interface CardDoc {
  _id: string;
  name: string;
  game: string;
  rarity: string;
  image: string | null;
  internalPrice: number | null;
}

interface InventoryItemRow {
  _id: string;
  card: CardDoc;
  stock: number;
  ean: string | null;
  sku: string | null;
  notes: string | null;
  pricePerUnit: number | null;
}

export function ShopInventoryTable({ lang }: { lang: string }) {
  const isDe = lang === "de";
  const [items, setItems] = useState<InventoryItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStock, setEditStock] = useState(0);
  const [editEan, setEditEan] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inventory");
      const data = (await res.json()) as { items: InventoryItemRow[] };
      setItems(data.items ?? []);
    } catch {
      setError("Ladefehler");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  function startEdit(item: InventoryItemRow) {
    setEditingId(item._id);
    setEditStock(item.stock);
    setEditEan(item.ean ?? "");
    setEditSku(item.sku ?? "");
    setEditNotes(item.notes ?? "");
    setEditPrice(item.pricePerUnit?.toString() ?? "");
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/inventory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stock: editStock,
          ean: editEan || null,
          sku: editSku || null,
          notes: editNotes || null,
          pricePerUnit: editPrice ? parseFloat(editPrice) : null,
        }),
      });
      if (res.ok) {
        setEditingId(null);
        await fetchItems();
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: string) {
    if (!confirm(isDe ? "Wirklich löschen?" : "Delete this item?")) return;
    const res = await fetch(`/api/inventory/${id}`, { method: "DELETE" });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      alert(data.error ?? "Fehler");
    } else {
      await fetchItems();
    }
  }

  if (loading) return <p className="text-sm text-text-secondary">{isDe ? "Lädt…" : "Loading…"}</p>;
  if (error) return <p className="text-sm text-error">{error}</p>;
  if (items.length === 0) {
    return (
      <p className="text-sm text-text-secondary">
        {isDe ? "Noch keine Artikel im Inventar." : "No inventory items yet."}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-text-secondary">
            <th className="py-2 pr-4">{isDe ? "Karte" : "Card"}</th>
            <th className="py-2 pr-4">{isDe ? "Bestand" : "Stock"}</th>
            <th className="py-2 pr-4">EAN</th>
            <th className="py-2 pr-4">SKU</th>
            <th className="py-2 pr-4">{isDe ? "EK-Preis" : "Buy price"}</th>
            <th className="py-2 pr-4">{isDe ? "Notiz" : "Notes"}</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) =>
            editingId === item._id ? (
              <tr key={item._id} className="border-b border-border">
                <td className="py-2 pr-4 font-medium text-text-primary">{item.card.name}</td>
                <td className="py-2 pr-4">
                  <input
                    type="number"
                    min={0}
                    value={editStock}
                    onChange={(e) => setEditStock(parseInt(e.target.value, 10) || 0)}
                    className="w-20 rounded border border-border bg-background px-2 py-1 text-sm"
                  />
                </td>
                <td className="py-2 pr-4">
                  <input
                    type="text"
                    value={editEan}
                    onChange={(e) => setEditEan(e.target.value)}
                    className="w-28 rounded border border-border bg-background px-2 py-1 text-sm"
                  />
                </td>
                <td className="py-2 pr-4">
                  <input
                    type="text"
                    value={editSku}
                    onChange={(e) => setEditSku(e.target.value)}
                    className="w-28 rounded border border-border bg-background px-2 py-1 text-sm"
                  />
                </td>
                <td className="py-2 pr-4">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-20 rounded border border-border bg-background px-2 py-1 text-sm"
                  />
                </td>
                <td className="py-2 pr-4">
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-40 rounded border border-border bg-background px-2 py-1 text-sm"
                  />
                </td>
                <td className="py-2 flex gap-2">
                  <button
                    onClick={() => void saveEdit(item._id)}
                    disabled={saving}
                    className="rounded bg-primary px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {isDe ? "Speichern" : "Save"}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded border border-border px-2 py-1 text-xs text-text-secondary"
                  >
                    {isDe ? "Abbrechen" : "Cancel"}
                  </button>
                </td>
              </tr>
            ) : (
              <tr key={item._id} className="border-b border-border hover:bg-surface/50">
                <td className="py-2 pr-4 font-medium text-text-primary">{item.card.name}</td>
                <td className="py-2 pr-4 text-text-secondary">{item.stock}</td>
                <td className="py-2 pr-4 text-text-secondary">{item.ean ?? "—"}</td>
                <td className="py-2 pr-4 text-text-secondary">{item.sku ?? "—"}</td>
                <td className="py-2 pr-4 text-text-secondary">
                  {item.pricePerUnit != null ? `${item.pricePerUnit.toFixed(2)} €` : "—"}
                </td>
                <td className="py-2 pr-4 text-text-secondary max-w-[160px] truncate">{item.notes ?? "—"}</td>
                <td className="py-2 flex gap-2">
                  <button
                    onClick={() => startEdit(item)}
                    className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
                  >
                    {isDe ? "Bearbeiten" : "Edit"}
                  </button>
                  <button
                    onClick={() => void deleteItem(item._id)}
                    className="rounded border border-error/40 px-2 py-1 text-xs text-error hover:bg-error/10"
                  >
                    {isDe ? "Löschen" : "Delete"}
                  </button>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Create shop inventory page**

```tsx
// app/[lang]/(dashboard)/shop/inventory/page.tsx
import { auth } from "@/lib/auth";
import { ShopInventoryTable } from "@/components/shop/shop-inventory-table";

export default async function ShopInventoryPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const isDe = lang === "de";

  await auth(); // layout already guards role

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {isDe ? "Mein Inventar" : "My Inventory"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {isDe
            ? "Verwalte deinen Kartenbestand. Verfügbare Karten werden automatisch als Ersatz in Boxen verwendet."
            : "Manage your card stock. Available cards are automatically used as substitutes in boxes."}
        </p>
      </div>
      <ShopInventoryTable lang={lang} />
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add "app/[lang]/(dashboard)/shop/layout.tsx" components/shop/shop-inventory-table.tsx "app/[lang]/(dashboard)/shop/inventory/page.tsx"
git commit -m "feat: shop inventory page with edit/delete table"
```

---

## Task 12: Admin Shops Page

**Files:**
- Create: `components/admin/shops-table.tsx`
- Create: `app/[lang]/(dashboard)/admin/shops/page.tsx`

- [ ] **Step 1: Create shops table component**

```tsx
// components/admin/shops-table.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";

interface ShopProfileRow {
  _id: string;
  companyName: string;
  status: "pending" | "approved" | "rejected";
  rejectReason: string | null;
  licenseFileName: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  user: { name: string; email: string };
  reviewedBy: { name: string } | null;
}

export function ShopsTable({ lang }: { lang: string }) {
  const isDe = lang === "de";
  const [profiles, setProfiles] = useState<ShopProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/shops?status=${statusFilter}&limit=50`);
      const data = (await res.json()) as { profiles: ShopProfileRow[] };
      setProfiles(data.profiles ?? []);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { void fetchProfiles(); }, [fetchProfiles]);

  async function handleAction(id: string, action: "approve" | "reject", reason?: string) {
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/shops/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rejectReason: reason }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setFeedback(data.error ?? "Fehler");
      } else {
        setRejectingId(null);
        setRejectReason("");
        await fetchProfiles();
      }
    } finally {
      setActionLoading(false);
    }
  }

  const statusLabels: Record<string, string> = {
    pending: isDe ? "Ausstehend" : "Pending",
    approved: isDe ? "Genehmigt" : "Approved",
    rejected: isDe ? "Abgelehnt" : "Rejected",
  };

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex gap-2">
        {["pending", "approved", "rejected"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === s
                ? "bg-primary text-white"
                : "border border-border text-text-secondary hover:text-text-primary"
            }`}
          >
            {statusLabels[s]}
          </button>
        ))}
      </div>

      {feedback && <p className="text-sm text-error">{feedback}</p>}

      {loading ? (
        <p className="text-sm text-text-secondary">{isDe ? "Lädt…" : "Loading…"}</p>
      ) : profiles.length === 0 ? (
        <p className="text-sm text-text-secondary">
          {isDe ? "Keine Einträge." : "No entries."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-secondary">
                <th className="py-2 pr-4">{isDe ? "Firma" : "Company"}</th>
                <th className="py-2 pr-4">{isDe ? "Bewerber" : "Applicant"}</th>
                <th className="py-2 pr-4">{isDe ? "Eingereicht" : "Submitted"}</th>
                <th className="py-2 pr-4">{isDe ? "Dokument" : "Document"}</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <React.Fragment key={p._id}>
                  <tr className="border-b border-border hover:bg-surface/50">
                    <td className="py-2 pr-4 font-medium text-text-primary">{p.companyName}</td>
                    <td className="py-2 pr-4 text-text-secondary">
                      {p.user.name}
                      <br />
                      <span className="text-xs">{p.user.email}</span>
                    </td>
                    <td className="py-2 pr-4 text-text-secondary">
                      {new Date(p.submittedAt).toLocaleDateString(isDe ? "de-DE" : "en-US")}
                    </td>
                    <td className="py-2 pr-4">
                      {p.licenseFileName ? (
                        <a
                          href={`/api/admin/shops/${p._id}/license`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline text-xs"
                        >
                          {isDe ? "Anzeigen" : "View"}
                        </a>
                      ) : (
                        <span className="text-text-secondary text-xs">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.status === "approved"
                            ? "bg-success/10 text-success"
                            : p.status === "rejected"
                            ? "bg-error/10 text-error"
                            : "bg-warning/10 text-warning"
                        }`}
                      >
                        {statusLabels[p.status]}
                      </span>
                    </td>
                    <td className="py-2">
                      {p.status === "pending" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => void handleAction(p._id, "approve")}
                            disabled={actionLoading}
                            className="rounded bg-success px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                          >
                            {isDe ? "Freischalten" : "Approve"}
                          </button>
                          <button
                            onClick={() => setRejectingId(p._id)}
                            disabled={actionLoading}
                            className="rounded border border-error/40 px-2 py-1 text-xs text-error hover:bg-error/10 disabled:opacity-50"
                          >
                            {isDe ? "Ablehnen" : "Reject"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {rejectingId === p._id && (
                    <tr className="border-b border-border bg-surface/30">
                      <td colSpan={6} className="py-3 px-2">
                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            placeholder={isDe ? "Ablehnungsgrund…" : "Rejection reason…"}
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="flex-1 rounded border border-border bg-background px-3 py-1.5 text-sm"
                          />
                          <button
                            onClick={() => void handleAction(p._id, "reject", rejectReason)}
                            disabled={actionLoading || !rejectReason.trim()}
                            className="rounded bg-error px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                          >
                            {isDe ? "Bestätigen" : "Confirm"}
                          </button>
                          <button
                            onClick={() => { setRejectingId(null); setRejectReason(""); }}
                            className="rounded border border-border px-2 py-1.5 text-xs text-text-secondary"
                          >
                            {isDe ? "Abbrechen" : "Cancel"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create admin shops page**

```tsx
// app/[lang]/(dashboard)/admin/shops/page.tsx
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { ShopsTable } from "@/components/admin/shops-table";

export default async function AdminShopsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  await getDictionary(lang as Locale, "admin");

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {lang === "de" ? "Shop-Bewerbungen" : "Shop Applications"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {lang === "de"
            ? "Prüfe und verwalte Shop-Bewerbungen."
            : "Review and manage shop applications."}
        </p>
      </div>
      <ShopsTable lang={lang} />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add components/admin/shops-table.tsx "app/[lang]/(dashboard)/admin/shops/page.tsx"
git commit -m "feat: admin shop applications page with approve/reject"
```

---

## Task 13: Admin Inventory Page

**Files:**
- Create: `components/admin/inventory-overview-table.tsx`
- Create: `app/[lang]/(dashboard)/admin/inventory/page.tsx`

- [ ] **Step 1: Create admin inventory table component**

```tsx
// components/admin/inventory-overview-table.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";

interface InventoryRow {
  _id: string;
  card: { _id: string; name: string; game: string; rarity: string; internalPrice: number | null };
  shop: { _id: string; name: string; email: string };
  stock: number;
  ean: string | null;
  sku: string | null;
  notes: string | null;
  pricePerUnit: number | null;
}

export function InventoryOverviewTable({ lang }: { lang: string }) {
  const isDe = lang === "de";
  const [items, setItems] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStock, setEditStock] = useState(0);
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/inventory?limit=100");
      const data = (await res.json()) as { items: InventoryRow[] };
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  async function saveOverride(id: string) {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/inventory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock: editStock, notes: editNotes || null }),
      });
      if (res.ok) {
        setEditingId(null);
        await fetchItems();
      } else {
        const d = (await res.json()) as { error?: string };
        setFeedback(d.error ?? "Fehler");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-text-secondary">{isDe ? "Lädt…" : "Loading…"}</p>;
  if (items.length === 0) {
    return (
      <p className="text-sm text-text-secondary">
        {isDe ? "Kein Inventar vorhanden." : "No inventory items."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {feedback && <p className="text-sm text-error">{feedback}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-text-secondary">
              <th className="py-2 pr-4">{isDe ? "Karte" : "Card"}</th>
              <th className="py-2 pr-4">Shop</th>
              <th className="py-2 pr-4">{isDe ? "Bestand" : "Stock"}</th>
              <th className="py-2 pr-4">EAN</th>
              <th className="py-2 pr-4">SKU</th>
              <th className="py-2 pr-4">{isDe ? "Notiz" : "Notes"}</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) =>
              editingId === item._id ? (
                <tr key={item._id} className="border-b border-border">
                  <td className="py-2 pr-4 font-medium text-text-primary">{item.card.name}</td>
                  <td className="py-2 pr-4 text-text-secondary">{item.shop.name}</td>
                  <td className="py-2 pr-4">
                    <input
                      type="number"
                      min={0}
                      value={editStock}
                      onChange={(e) => setEditStock(parseInt(e.target.value, 10) || 0)}
                      className="w-20 rounded border border-border bg-background px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="py-2 pr-4 text-text-secondary">{item.ean ?? "—"}</td>
                  <td className="py-2 pr-4 text-text-secondary">{item.sku ?? "—"}</td>
                  <td className="py-2 pr-4">
                    <input
                      type="text"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-40 rounded border border-border bg-background px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="py-2 flex gap-2">
                    <button
                      onClick={() => void saveOverride(item._id)}
                      disabled={saving}
                      className="rounded bg-primary px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                    >
                      {isDe ? "Speichern" : "Save"}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded border border-border px-2 py-1 text-xs text-text-secondary"
                    >
                      {isDe ? "Abbrechen" : "Cancel"}
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={item._id} className="border-b border-border hover:bg-surface/50">
                  <td className="py-2 pr-4">
                    <div className="font-medium text-text-primary">{item.card.name}</div>
                    <div className="text-xs text-text-secondary">{item.card.game} · {item.card.rarity}</div>
                  </td>
                  <td className="py-2 pr-4 text-text-secondary">{item.shop.name}</td>
                  <td className="py-2 pr-4 text-text-secondary">{item.stock}</td>
                  <td className="py-2 pr-4 text-text-secondary">{item.ean ?? "—"}</td>
                  <td className="py-2 pr-4 text-text-secondary">{item.sku ?? "—"}</td>
                  <td className="py-2 pr-4 text-text-secondary max-w-[160px] truncate">{item.notes ?? "—"}</td>
                  <td className="py-2">
                    <button
                      onClick={() => { setEditingId(item._id); setEditStock(item.stock); setEditNotes(item.notes ?? ""); }}
                      className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
                    >
                      {isDe ? "Override" : "Override"}
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create admin inventory page**

```tsx
// app/[lang]/(dashboard)/admin/inventory/page.tsx
import { InventoryOverviewTable } from "@/components/admin/inventory-overview-table";

export default async function AdminInventoryPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {lang === "de" ? "Globales Inventar" : "Global Inventory"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {lang === "de"
            ? "Übersicht aller Shop-Inventare. Bestand kann hier manuell überschrieben werden."
            : "Overview of all shop inventories. Stock can be overridden manually here."}
        </p>
      </div>
      <InventoryOverviewTable lang={lang} />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add components/admin/inventory-overview-table.tsx "app/[lang]/(dashboard)/admin/inventory/page.tsx"
git commit -m "feat: admin global inventory overview with stock override"
```

---

## Self-Review Checklist

After writing this plan, verified against the spec:

| Spec requirement | Task |
|---|---|
| InventoryItem model (card, shop, stock, ean, sku, notes, pricePerUnit) | Task 1 |
| ShopProfile model (user, companyName, status, rejectReason, licenseFileId, submittedAt, reviewedBy) | Task 2 |
| GridFS license upload/download | Task 2 |
| Box schema: isSubstitute, originalCard | Task 3 |
| Substitution logic: ±5 coins match, closest price wins | Task 4 |
| Substitution: min(inventoryStock, drawnCount) units taken | Task 4 |
| Substitution: InventoryItem stock decremented | Task 4 |
| Substitution: box card replaced in-place | Task 4 |
| No substitute → box paused + admin notification | Task 4 |
| Admin notification on substitution | Task 4 |
| Pack-open integration | Task 5 |
| shopApplySchema validation | Task 6 |
| Shop apply API (POST, reapply if rejected, block if pending/approved) | Task 6 |
| Shop profile API (GET) | Task 6 |
| Admin shops list API | Task 7 |
| Admin approve/reject + role update | Task 7 |
| License file streaming | Task 7 |
| Inventory CRUD (shop, own items only) | Task 8 |
| Deletion guard (in-use as substitute) | Task 8 |
| Admin inventory list + override | Task 9 |
| Shop apply form in Account Settings | Task 10 |
| Show pending/approved/rejected state | Task 10 |
| Shop layout (role guard) | Task 11 |
| Shop inventory table (edit/delete) | Task 11 |
| Admin shops page (approve/reject with reason) | Task 12 |
| Admin inventory overview (override) | Task 13 |
