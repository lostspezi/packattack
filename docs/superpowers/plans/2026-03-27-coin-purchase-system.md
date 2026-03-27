# Coin Purchase System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable users to purchase coins via Stripe Checkout with age verification, gamified animations, PDF invoices, and admin-managed packages.

**Architecture:** Stripe Checkout (redirect) for payments, Stripe Identity (document) for one-time 18+ verification, PDFKit for German invoices (Rechnung), CSS+SVG treasure chest animation. Webhook-only coin granting for security. MongoDB models follow existing Mongoose patterns.

**Tech Stack:** Next.js 16 App Router, Mongoose/MongoDB, Stripe SDK, PDFKit, Tailwind CSS v4, Zod validation, HTML5 Audio

**Spec:** `docs/superpowers/specs/2026-03-27-coin-purchase-system-design.md`

---

## File Structure

### New Files
```
lib/stripe.ts                                          — Stripe client singleton
lib/invoice-generator.ts                               — PDFKit invoice generator
lib/play-sound.ts                                      — Client-side sound utility
models/coin-package.ts                                 — CoinPackage Mongoose model
models/coin-purchase.ts                                — CoinPurchase Mongoose model
models/invoice-settings.ts                             — InvoiceSettings singleton model
app/api/coins/packages/route.ts                        — GET active packages
app/api/coins/checkout/route.ts                        — POST create Stripe Checkout session
app/api/coins/purchases/route.ts                       — GET user purchases
app/api/coins/purchases/[id]/invoice/route.ts          — GET PDF invoice download
app/api/coins/verify-identity/route.ts                 — POST create Stripe Identity session
app/api/coins/verify-identity/status/route.ts          — GET verification status
app/api/stripe/webhook/route.ts                        — Stripe webhook handler
app/api/admin/coin-packages/route.ts                   — GET/POST admin packages
app/api/admin/coin-packages/[id]/route.ts              — GET/PATCH/DELETE admin package
app/api/admin/invoice-settings/route.ts                — GET/PATCH invoice settings
app/api/admin/coin-purchases/route.ts                  — GET all purchases (admin)
app/[lang]/(dashboard)/balance/page.tsx                — Balance page server component
components/balance/balance-page.tsx                     — Balance page client component
components/balance/package-card.tsx                     — Coin package card
components/balance/purchase-history.tsx                 — Transaction history table
components/balance/identity-verification-banner.tsx    — Verification CTA banner
components/balance/checkout-confirmation-modal.tsx       — Widerrufsrecht consent before Stripe redirect
components/balance/coin-chest-animation.tsx             — Treasure chest animation overlay
components/admin/coin-package-manager.tsx               — Admin package list/CRUD
components/admin/coin-package-form.tsx                  — Admin package create/edit form
components/admin/invoice-settings-form.tsx              — Admin invoice settings form
app/[lang]/(dashboard)/admin/coin-packages/page.tsx    — Admin packages page
app/[lang]/(dashboard)/admin/invoice-settings/page.tsx — Admin invoice settings page
public/sounds/chest-open.mp3                           — Chest opening sound effect
public/sounds/coins-rain.mp3                           — Coin rain sound effect
```

### Modified Files
```
models/user.ts:14-42                    — Add Stripe/identity fields to IUser + schema
models/coin-transaction.ts:5-10         — Add coin_purchase type + relatedPurchaseId
components/layout/coin-balance.tsx:1-27  — Wrap in Link to /balance
components/layout/sidebar-nav.tsx:1-40   — Add balance + admin nav items
lib/validations.ts                       — Add Zod schemas for new endpoints
.env.example                             — Add STRIPE env vars
```

---

## Phase 1: Foundation

### Task 1: Install dependencies and configure environment

**Files:**
- Modify: `package.json`
- Modify: `.env.example`

- [ ] **Step 1: Install Stripe SDK and PDFKit**

```bash
npm install stripe pdfkit
npm install --save-dev @types/pdfkit
```

- [ ] **Step 2: Add Stripe environment variables to .env.example**

Add these lines at the end of `.env.example`:

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

- [ ] **Step 3: Add Stripe env vars to local .env.local**

Add the actual Stripe test keys from the Stripe Dashboard (already created sandbox):

```env
STRIPE_SECRET_KEY=sk_test_ACTUAL_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_ACTUAL_KEY_HERE
```

> **Note:** Get the webhook secret after setting up the webhook endpoint in Stripe Dashboard later. For now, add a placeholder.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore: add stripe and pdfkit dependencies"
```

---

### Task 2: Create Stripe client singleton

**Files:**
- Create: `lib/stripe.ts`

- [ ] **Step 1: Create the Stripe client**

Create `lib/stripe.ts`:

```typescript
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  typescript: true,
});

export default stripe;
```

- [ ] **Step 2: Verify import works**

```bash
npx tsx -e "import stripe from './lib/stripe'; console.log('Stripe client type:', typeof stripe)"
```

Expected: prints "Stripe client type: object" (or throws if no env var — that's fine in CI).

- [ ] **Step 3: Commit**

```bash
git add lib/stripe.ts
git commit -m "feat: add Stripe client singleton"
```

---

### Task 3: Create CoinPackage model

**Files:**
- Create: `models/coin-package.ts`

- [ ] **Step 1: Create the model**

Create `models/coin-package.ts`:

```typescript
import mongoose, { Schema, Document, Types } from "mongoose";

export interface ICoinPackage extends Document {
  _id: Types.ObjectId;
  name: { de: string; en: string };
  slug: string;
  baseCoins: number;
  bonusCoins: number;
  priceEurCents: number;
  stripePriceId: string | null;
  stripeProductId: string | null;
  isActive: boolean;
  sortOrder: number;
  icon: string | null;
  highlightLabel: { de: string; en: string } | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CoinPackageSchema = new Schema<ICoinPackage>(
  {
    name: {
      de: { type: String, required: true },
      en: { type: String, required: true },
    },
    slug: { type: String, required: true, unique: true },
    baseCoins: { type: Number, required: true, min: 1, max: 1000 },
    bonusCoins: { type: Number, default: 0, min: 0 },
    priceEurCents: { type: Number, required: true, min: 100 },
    stripePriceId: { type: String, default: null },
    stripeProductId: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    icon: { type: String, default: null },
    highlightLabel: {
      type: {
        de: { type: String },
        en: { type: String },
      },
      default: null,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

CoinPackageSchema.virtual("totalCoins").get(function () {
  return this.baseCoins + this.bonusCoins;
});

CoinPackageSchema.set("toJSON", { virtuals: true });
CoinPackageSchema.set("toObject", { virtuals: true });

CoinPackageSchema.index({ isActive: 1, sortOrder: 1 });
CoinPackageSchema.index({ slug: 1 }, { unique: true });

const CoinPackage =
  mongoose.models.CoinPackage ||
  mongoose.model<ICoinPackage>("CoinPackage", CoinPackageSchema);

export default CoinPackage;
```

- [ ] **Step 2: Verify model compiles**

```bash
npx tsc --noEmit models/coin-package.ts 2>&1 | head -20
```

Expected: no errors (or only unrelated TS config warnings).

- [ ] **Step 3: Commit**

```bash
git add models/coin-package.ts
git commit -m "feat: add CoinPackage model"
```

---

### Task 4: Create CoinPurchase model

**Files:**
- Create: `models/coin-purchase.ts`

- [ ] **Step 1: Create the model**

Create `models/coin-purchase.ts`:

```typescript
import mongoose, { Schema, Document, Types } from "mongoose";

export type PurchaseStatus =
  | "pending"
  | "completed"
  | "failed"
  | "refunded"
  | "expired";

export interface ICoinPurchase extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  packageId: Types.ObjectId;
  packageSnapshot: {
    name: { de: string; en: string };
    baseCoins: number;
    bonusCoins: number;
    priceEurCents: number;
  };
  status: PurchaseStatus;
  stripeSessionId: string;
  stripePaymentIntentId: string | null;
  invoiceNumber: string | null;
  invoiceGeneratedAt: Date | null;
  coinsGranted: number;
  createdAt: Date;
  updatedAt: Date;
}

const CoinPurchaseSchema = new Schema<ICoinPurchase>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    packageId: {
      type: Schema.Types.ObjectId,
      ref: "CoinPackage",
      required: true,
    },
    packageSnapshot: {
      name: {
        de: { type: String, required: true },
        en: { type: String, required: true },
      },
      baseCoins: { type: Number, required: true },
      bonusCoins: { type: Number, required: true },
      priceEurCents: { type: Number, required: true },
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded", "expired"],
      default: "pending",
    },
    stripeSessionId: { type: String, required: true, unique: true },
    stripePaymentIntentId: { type: String, default: null },
    invoiceNumber: { type: String, default: null },
    invoiceGeneratedAt: { type: Date, default: null },
    coinsGranted: { type: Number, default: 0 },
    withdrawalConsentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

CoinPurchaseSchema.index({ userId: 1, createdAt: -1 });
CoinPurchaseSchema.index({ stripeSessionId: 1 }, { unique: true });
CoinPurchaseSchema.index(
  { invoiceNumber: 1 },
  { unique: true, sparse: true }
);
CoinPurchaseSchema.index({ status: 1 });

const CoinPurchase =
  mongoose.models.CoinPurchase ||
  mongoose.model<ICoinPurchase>("CoinPurchase", CoinPurchaseSchema);

export default CoinPurchase;
```

- [ ] **Step 2: Commit**

```bash
git add models/coin-purchase.ts
git commit -m "feat: add CoinPurchase model"
```

---

### Task 5: Create InvoiceSettings model

**Files:**
- Create: `models/invoice-settings.ts`

Reference pattern: `models/platform-settings.ts` (singleton document).

- [ ] **Step 1: Create the model**

Create `models/invoice-settings.ts`:

```typescript
import mongoose, { Schema, Document, Types } from "mongoose";

export interface IInvoiceSettings extends Document {
  companyName: string;
  companyAddress: {
    street: string;
    zip: string;
    city: string;
    country: string;
  };
  taxId: string;
  taxRate: number;
  bankDetails: {
    iban: string;
    bic: string;
    bankName: string;
  } | null;
  email: string;
  phone: string | null;
  website: string | null;
  logoUrl: string | null;
  invoicePrefix: string;
  nextInvoiceSequence: number;
  footerText: { de: string; en: string } | null;
  updatedBy: Types.ObjectId | null;
  updatedAt: Date;
}

const InvoiceSettingsSchema = new Schema<IInvoiceSettings>(
  {
    companyName: { type: String, default: "" },
    companyAddress: {
      street: { type: String, default: "" },
      zip: { type: String, default: "" },
      city: { type: String, default: "" },
      country: { type: String, default: "Deutschland" },
    },
    taxId: { type: String, default: "" },
    taxRate: { type: Number, default: 19 },
    bankDetails: {
      type: {
        iban: { type: String },
        bic: { type: String },
        bankName: { type: String },
      },
      default: null,
    },
    email: { type: String, default: "" },
    phone: { type: String, default: null },
    website: { type: String, default: null },
    logoUrl: { type: String, default: null },
    invoicePrefix: { type: String, default: "PA" },
    nextInvoiceSequence: { type: Number, default: 1 },
    footerText: {
      type: {
        de: { type: String },
        en: { type: String },
      },
      default: null,
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

const InvoiceSettings =
  mongoose.models.InvoiceSettings ||
  mongoose.model<IInvoiceSettings>("InvoiceSettings", InvoiceSettingsSchema);

export default InvoiceSettings;
```

- [ ] **Step 2: Commit**

```bash
git add models/invoice-settings.ts
git commit -m "feat: add InvoiceSettings singleton model"
```

---

### Task 6: Extend User model with Stripe fields

**Files:**
- Modify: `models/user.ts`

- [ ] **Step 1: Add fields to IUser interface**

In `models/user.ts`, add these fields to the `IUser` interface (after `coins: number;`):

```typescript
  stripeCustomerId: string | null;
  stripeIdentityVerificationId: string | null;
  identityVerified: boolean;
  identityVerifiedAt: Date | null;
```

- [ ] **Step 2: Add fields to UserSchema**

In `models/user.ts`, add these fields to the schema definition (after the `coins` field):

```typescript
    stripeCustomerId: { type: String, default: null },
    stripeIdentityVerificationId: { type: String, default: null },
    identityVerified: { type: Boolean, default: false },
    identityVerifiedAt: { type: Date, default: null },
```

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit models/user.ts 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add models/user.ts
git commit -m "feat: add Stripe and identity verification fields to User model"
```

---

### Task 7: Extend CoinTransaction model

**Files:**
- Modify: `models/coin-transaction.ts`

- [ ] **Step 1: Add `coin_purchase` to type enum and `relatedPurchaseId` field**

In `models/coin-transaction.ts`, update the `ICoinTransaction` interface — add to the type union:

```typescript
  type: "admin_grant" | "admin_deduct" | "pack_purchase" | "card_conversion" | "coin_purchase";
```

Add new field to the interface:

```typescript
  relatedPurchaseId: Types.ObjectId | null;
```

In the schema, update the `type` enum array to include `"coin_purchase"`:

```typescript
    type: {
      type: String,
      enum: ["admin_grant", "admin_deduct", "pack_purchase", "card_conversion", "coin_purchase"],
      required: true,
    },
```

Add the new field to the schema:

```typescript
    relatedPurchaseId: { type: Schema.Types.ObjectId, ref: "CoinPurchase", default: null },
```

- [ ] **Step 2: Commit**

```bash
git add models/coin-transaction.ts
git commit -m "feat: add coin_purchase type and relatedPurchaseId to CoinTransaction"
```

---

### Task 8: Add Zod validation schemas

**Files:**
- Modify: `lib/validations.ts`

- [ ] **Step 1: Add coin package and checkout validation schemas**

Add at the end of `lib/validations.ts`:

```typescript
// Coin Purchase System
export const coinPackageSchema = z.object({
  name: z.object({
    de: z.string().min(1).max(100),
    en: z.string().min(1).max(100),
  }),
  baseCoins: z.number().int().min(1).max(1000),
  bonusCoins: z.number().int().min(0).max(500).default(0),
  priceEurCents: z.number().int().min(100).max(100000),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  icon: z.string().max(50).nullable().default(null),
  highlightLabel: z
    .object({
      de: z.string().max(50),
      en: z.string().max(50),
    })
    .nullable()
    .default(null),
});

export const coinPackageUpdateSchema = coinPackageSchema.partial();

export const checkoutSchema = z.object({
  packageId: z.string().min(1),
  withdrawalConsent: z.literal(true, {
    errorMap: () => ({ message: "Withdrawal consent is required" }),
  }),
});

export const invoiceSettingsSchema = z.object({
  companyName: z.string().min(1).max(200),
  companyAddress: z.object({
    street: z.string().min(1).max(200),
    zip: z.string().min(1).max(20),
    city: z.string().min(1).max(100),
    country: z.string().min(1).max(100),
  }),
  taxId: z.string().min(1).max(50),
  taxRate: z.number().min(0).max(100),
  bankDetails: z
    .object({
      iban: z.string().min(1).max(50),
      bic: z.string().min(1).max(20),
      bankName: z.string().min(1).max(100),
    })
    .nullable()
    .default(null),
  email: z.string().email().max(200),
  phone: z.string().max(50).nullable().default(null),
  website: z.string().url().max(200).nullable().default(null),
  logoUrl: z.string().max(500).nullable().default(null),
  invoicePrefix: z.string().min(1).max(10),
  footerText: z
    .object({
      de: z.string().max(500),
      en: z.string().max(500),
    })
    .nullable()
    .default(null),
});
```

- [ ] **Step 2: Commit**

```bash
git add lib/validations.ts
git commit -m "feat: add Zod schemas for coin packages, checkout, and invoice settings"
```

---

## Phase 2: Admin API

### Task 9: Admin coin packages API (list + create)

**Files:**
- Create: `app/api/admin/coin-packages/route.ts`

Reference pattern: `app/api/admin/coins/grant/route.ts` for auth guard.

- [ ] **Step 1: Create the route**

Create `app/api/admin/coin-packages/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import CoinPackage from "@/models/coin-package";
import { coinPackageSchema } from "@/lib/validations";
import stripe from "@/lib/stripe";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  const packages = await CoinPackage.find()
    .sort({ sortOrder: 1, createdAt: -1 })
    .lean();

  return NextResponse.json(packages);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = coinPackageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  await connectDB();

  const data = parsed.data;
  const slug = data.name.en
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Create Stripe Product + Price
  const product = await stripe.products.create({
    name: data.name.en,
    metadata: { source: "packattack", type: "coin_package" },
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: data.priceEurCents,
    currency: "eur",
  });

  const coinPackage = await CoinPackage.create({
    ...data,
    slug,
    stripePriceId: price.id,
    stripeProductId: product.id,
    createdBy: userId,
  });

  return NextResponse.json(coinPackage, { status: 201 });
}
```

- [ ] **Step 2: Test manually**

Start the dev server and test with curl or browser:

```bash
# After starting dev server
curl -s http://localhost:3000/api/admin/coin-packages | head -20
```

Expected: 403 Forbidden (not authenticated) or empty array (if authenticated as admin).

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/coin-packages/route.ts
git commit -m "feat: add admin coin packages list and create API"
```

---

### Task 10: Admin coin packages API (get/update/delete single)

**Files:**
- Create: `app/api/admin/coin-packages/[id]/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/admin/coin-packages/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import CoinPackage from "@/models/coin-package";
import { coinPackageUpdateSchema } from "@/lib/validations";
import stripe from "@/lib/stripe";

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
  await connectDB();
  const pkg = await CoinPackage.findById(id).lean();
  if (!pkg) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(pkg);
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
  const body = await req.json();
  const parsed = coinPackageUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  await connectDB();
  const existing = await CoinPackage.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data = parsed.data;

  // If price changed, create new Stripe Price and archive old one
  if (data.priceEurCents && data.priceEurCents !== existing.priceEurCents) {
    if (existing.stripePriceId) {
      await stripe.prices.update(existing.stripePriceId, { active: false });
    }
    const newPrice = await stripe.prices.create({
      product: existing.stripeProductId!,
      unit_amount: data.priceEurCents,
      currency: "eur",
    });
    existing.stripePriceId = newPrice.id;
  }

  // If deactivated, archive Stripe Price
  if (data.isActive === false && existing.isActive && existing.stripePriceId) {
    await stripe.prices.update(existing.stripePriceId, { active: false });
  }

  Object.assign(existing, data);
  await existing.save();

  return NextResponse.json(existing);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await connectDB();
  const pkg = await CoinPackage.findById(id);
  if (!pkg) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Soft delete: deactivate instead of removing
  pkg.isActive = false;
  if (pkg.stripePriceId) {
    await stripe.prices.update(pkg.stripePriceId, { active: false });
  }
  await pkg.save();

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/coin-packages/[id]/route.ts
git commit -m "feat: add admin coin package get/update/delete API"
```

---

### Task 11: Admin invoice settings API

**Files:**
- Create: `app/api/admin/invoice-settings/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/admin/invoice-settings/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import InvoiceSettings from "@/models/invoice-settings";
import { invoiceSettingsSchema } from "@/lib/validations";

async function getOrCreateSettings() {
  let settings = await InvoiceSettings.findOne();
  if (!settings) {
    settings = await InvoiceSettings.create({});
  }
  return settings;
}

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  const settings = await getOrCreateSettings();
  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = invoiceSettingsSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  await connectDB();
  const settings = await getOrCreateSettings();
  Object.assign(settings, parsed.data, { updatedBy: userId });
  await settings.save();

  return NextResponse.json(settings);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/invoice-settings/route.ts
git commit -m "feat: add admin invoice settings API"
```

---

### Task 12: Admin coin purchases API (view all)

**Files:**
- Create: `app/api/admin/coin-purchases/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/admin/coin-purchases/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import CoinPurchase from "@/models/coin-purchase";

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const status = searchParams.get("status");
  const userId = searchParams.get("userId");

  await connectDB();

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (userId) filter.userId = userId;

  const [purchases, total] = await Promise.all([
    CoinPurchase.find(filter)
      .populate("userId", "name email username")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    CoinPurchase.countDocuments(filter),
  ]);

  return NextResponse.json({
    purchases,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/coin-purchases/route.ts
git commit -m "feat: add admin coin purchases list API"
```

---

## Phase 3: Stripe Integration (User-facing)

### Task 13: User-facing packages list API

**Files:**
- Create: `app/api/coins/packages/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/coins/packages/route.ts`:

```typescript
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import CoinPackage from "@/models/coin-package";

export async function GET() {
  await connectDB();
  const packages = await CoinPackage.find({ isActive: true })
    .select("name slug baseCoins bonusCoins priceEurCents icon highlightLabel sortOrder")
    .sort({ sortOrder: 1 })
    .lean();

  return NextResponse.json(packages);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/coins/packages/route.ts
git commit -m "feat: add public coin packages list API"
```

---

### Task 14: Stripe Identity verification endpoints

**Files:**
- Create: `app/api/coins/verify-identity/route.ts`
- Create: `app/api/coins/verify-identity/status/route.ts`

- [ ] **Step 1: Create verification session endpoint**

Create `app/api/coins/verify-identity/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import stripe from "@/lib/stripe";

export async function POST() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const user = await User.findById(userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.identityVerified) {
    return NextResponse.json({ error: "Already verified" }, { status: 400 });
  }

  const verificationSession = await stripe.identity.verificationSessions.create(
    {
      type: "document",
      metadata: { userId: userId },
      options: {
        document: {
          require_matching_selfie: true,
        },
      },
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/balance?verification=complete`,
    }
  );

  user.stripeIdentityVerificationId = verificationSession.id;
  await user.save();

  return NextResponse.json({ verificationUrl: verificationSession.url });
}
```

- [ ] **Step 2: Create verification status endpoint**

Create `app/api/coins/verify-identity/status/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const user = await User.findById(userId)
    .select("identityVerified identityVerifiedAt")
    .lean();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    identityVerified: user.identityVerified,
    identityVerifiedAt: user.identityVerifiedAt,
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/coins/verify-identity/route.ts app/api/coins/verify-identity/status/route.ts
git commit -m "feat: add Stripe Identity verification endpoints"
```

---

### Task 15: Checkout session endpoint

**Files:**
- Create: `app/api/coins/checkout/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/coins/checkout/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import CoinPackage from "@/models/coin-package";
import CoinPurchase from "@/models/coin-purchase";
import { checkoutSchema } from "@/lib/validations";
import stripe from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  await connectDB();

  const user = await User.findById(userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Enforce identity verification
  if (!user.identityVerified) {
    return NextResponse.json(
      { error: "Identity verification required" },
      { status: 403 }
    );
  }

  const coinPackage = await CoinPackage.findById(parsed.data.packageId);
  if (!coinPackage || !coinPackage.isActive) {
    return NextResponse.json(
      { error: "Package not found or inactive" },
      { status: 404 }
    );
  }

  if (!coinPackage.stripePriceId) {
    return NextResponse.json(
      { error: "Package not configured for payment" },
      { status: 500 }
    );
  }

  // Get or create Stripe Customer
  let stripeCustomerId = user.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name || user.username,
      metadata: { userId: userId },
    });
    stripeCustomerId = customer.id;
    user.stripeCustomerId = stripeCustomerId;
    await user.save();
  }

  // Determine language for Stripe Checkout
  const lang = (session.user as { language?: string }).language || "de";

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: stripeCustomerId,
    line_items: [{ price: coinPackage.stripePriceId, quantity: 1 }],
    metadata: {
      userId: userId,
      packageId: coinPackage._id.toString(),
      baseCoins: coinPackage.baseCoins.toString(),
      bonusCoins: coinPackage.bonusCoins.toString(),
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/${lang}/balance?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/${lang}/balance?canceled=true`,
    locale: lang === "de" ? "de" : "en",
  });

  // Create pending purchase record with withdrawal consent timestamp
  await CoinPurchase.create({
    userId: userId,
    packageId: coinPackage._id,
    packageSnapshot: {
      name: coinPackage.name,
      baseCoins: coinPackage.baseCoins,
      bonusCoins: coinPackage.bonusCoins,
      priceEurCents: coinPackage.priceEurCents,
    },
    status: "pending",
    stripeSessionId: checkoutSession.id,
    withdrawalConsentAt: new Date(),
  });

  return NextResponse.json({ checkoutUrl: checkoutSession.url });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/coins/checkout/route.ts
git commit -m "feat: add Stripe Checkout session creation endpoint"
```

---

### Task 16: User purchases list API

**Files:**
- Create: `app/api/coins/purchases/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/coins/purchases/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import CoinPurchase from "@/models/coin-purchase";

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
  const sessionId = searchParams.get("sessionId");

  await connectDB();

  // If sessionId provided, return that specific purchase (for polling after checkout)
  if (sessionId) {
    const purchase = await CoinPurchase.findOne({
      userId,
      stripeSessionId: sessionId,
    }).lean();
    return NextResponse.json({ purchase });
  }

  const [purchases, total] = await Promise.all([
    CoinPurchase.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    CoinPurchase.countDocuments({ userId }),
  ]);

  return NextResponse.json({
    purchases,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/coins/purchases/route.ts
git commit -m "feat: add user purchases list API with session polling"
```

---

### Task 17: Stripe webhook handler

**Files:**
- Create: `app/api/stripe/webhook/route.ts`

This is the most critical file — it handles payment confirmation and coin granting.

- [ ] **Step 1: Create the webhook handler**

Create `app/api/stripe/webhook/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import connectDB from "@/lib/db";
import stripe from "@/lib/stripe";
import User from "@/models/user";
import CoinPurchase from "@/models/coin-purchase";
import CoinTransaction from "@/models/coin-transaction";
import InvoiceSettings from "@/models/invoice-settings";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature or secret" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  await connectDB();

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case "checkout.session.expired":
      await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session);
      break;
    case "identity.verification_session.verified":
      await handleIdentityVerified(event.data.object);
      break;
    case "identity.verification_session.requires_input":
      await handleIdentityFailed(event.data.object);
      break;
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const { userId, packageId, baseCoins, bonusCoins } = session.metadata || {};
  if (!userId || !packageId || !baseCoins || !bonusCoins) {
    console.error("Webhook missing metadata:", session.id);
    return;
  }

  const purchase = await CoinPurchase.findOne({ stripeSessionId: session.id });
  if (!purchase) {
    console.error("Purchase not found for session:", session.id);
    return;
  }

  // Idempotency: skip if already completed
  if (purchase.status === "completed") {
    return;
  }

  const totalCoins = parseInt(baseCoins, 10) + parseInt(bonusCoins, 10);

  // Generate invoice number atomically
  const invoiceSettings = await InvoiceSettings.findOneAndUpdate(
    {},
    { $inc: { nextInvoiceSequence: 1 } },
    { new: false, upsert: true }
  );
  const seq = invoiceSettings?.nextInvoiceSequence || 1;
  const year = new Date().getFullYear();
  const prefix = invoiceSettings?.invoicePrefix || "PA";
  const invoiceNumber = `${prefix}-${year}-${String(seq).padStart(6, "0")}`;

  // Grant coins atomically
  await User.findByIdAndUpdate(userId, { $inc: { coins: totalCoins } });

  // Create transaction record
  await CoinTransaction.create({
    userId,
    amount: totalCoins,
    type: "coin_purchase",
    reason: `Package purchase: ${purchase.packageSnapshot.name.de}`,
    relatedPurchaseId: purchase._id,
  });

  // Update purchase
  purchase.status = "completed";
  purchase.stripePaymentIntentId = session.payment_intent as string;
  purchase.coinsGranted = totalCoins;
  purchase.invoiceNumber = invoiceNumber;
  purchase.invoiceGeneratedAt = new Date();
  await purchase.save();
}

async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
  await CoinPurchase.findOneAndUpdate(
    { stripeSessionId: session.id, status: "pending" },
    { status: "expired" }
  );
}

async function handleIdentityVerified(verificationSession: Stripe.Identity.VerificationSession) {
  const userId = verificationSession.metadata?.userId;
  if (!userId) return;

  // Extract DOB and check age
  const dob = verificationSession.verified_outputs?.dob;
  let dateOfBirth: Date | null = null;

  if (dob?.year && dob?.month && dob?.day) {
    dateOfBirth = new Date(dob.year, dob.month - 1, dob.day);
    const age = Math.floor(
      (Date.now() - dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    );

    if (age < 18) {
      console.warn(`User ${userId} is under 18 (age: ${age}). Verification rejected.`);
      return;
    }
  }

  const update: Record<string, unknown> = {
    identityVerified: true,
    identityVerifiedAt: new Date(),
  };
  if (dateOfBirth) {
    update.dateOfBirth = dateOfBirth;
  }

  await User.findByIdAndUpdate(userId, update);
}

async function handleIdentityFailed(verificationSession: Stripe.Identity.VerificationSession) {
  const userId = verificationSession.metadata?.userId;
  if (!userId) return;

  await User.findByIdAndUpdate(userId, {
    identityVerified: false,
    stripeIdentityVerificationId: null,
  });
}
```

- [ ] **Step 2: Verify the webhook route doesn't auto-parse JSON**

> **Important:** Next.js App Router does NOT auto-parse the body when you use `req.text()`. The `rawBody` is the untouched string, which is required for Stripe signature verification. No additional config needed.

- [ ] **Step 3: Commit**

```bash
git add app/api/stripe/webhook/route.ts
git commit -m "feat: add Stripe webhook handler for checkout and identity events"
```

---

## Phase 4: PDF Invoice Generation

### Task 18: Create PDF invoice generator

**Files:**
- Create: `lib/invoice-generator.ts`

- [ ] **Step 1: Create the generator**

Create `lib/invoice-generator.ts`:

```typescript
import PDFDocument from "pdfkit";
import { ICoinPurchase } from "@/models/coin-purchase";
import { IInvoiceSettings } from "@/models/invoice-settings";

interface PopulatedPurchase extends ICoinPurchase {
  userId: { name?: string; email: string; username?: string };
}

export async function generateInvoicePdf(
  purchase: PopulatedPurchase,
  settings: IInvoiceSettings,
  lang: "de" | "en" = "de"
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const t = translations[lang];
    const priceEur = purchase.packageSnapshot.priceEurCents / 100;
    const netAmount = priceEur / (1 + settings.taxRate / 100);
    const taxAmount = priceEur - netAmount;

    // Header
    doc.fontSize(20).font("Helvetica-Bold").text(settings.companyName, 50, 50);
    doc.fontSize(9).font("Helvetica").fillColor("#666666");
    doc.text(
      `${settings.companyAddress.street} • ${settings.companyAddress.zip} ${settings.companyAddress.city} • ${settings.companyAddress.country}`,
      50,
      75
    );
    if (settings.taxId) {
      doc.text(`${t.taxId}: ${settings.taxId}`, 50, 88);
    }

    // Invoice title
    doc
      .fillColor("#000000")
      .fontSize(24)
      .font("Helvetica-Bold")
      .text(t.invoice, 50, 140);

    // Invoice details
    const detailsY = 180;
    doc.fontSize(10).font("Helvetica");
    doc.text(`${t.invoiceNumber}:`, 50, detailsY);
    doc.font("Helvetica-Bold").text(purchase.invoiceNumber || "", 180, detailsY);
    doc.font("Helvetica").text(`${t.invoiceDate}:`, 50, detailsY + 18);
    doc
      .font("Helvetica-Bold")
      .text(formatDate(purchase.invoiceGeneratedAt || purchase.createdAt, lang), 180, detailsY + 18);

    // Customer details
    const customerY = detailsY + 60;
    doc.fontSize(10).font("Helvetica-Bold").text(t.billedTo, 50, customerY);
    doc.font("Helvetica").fontSize(10);
    const buyerName =
      purchase.userId.name || purchase.userId.username || "User";
    doc.text(buyerName, 50, customerY + 18);
    doc.text(purchase.userId.email, 50, customerY + 32);

    // Line items table
    const tableY = customerY + 70;
    // Header row
    doc
      .fillColor("#f5f5f5")
      .rect(50, tableY, 495, 24)
      .fill();
    doc.fillColor("#000000").fontSize(9).font("Helvetica-Bold");
    doc.text(t.description, 58, tableY + 7);
    doc.text(t.qty, 320, tableY + 7);
    doc.text(t.unitPrice, 370, tableY + 7);
    doc.text(t.total, 470, tableY + 7);

    // Line item
    const itemY = tableY + 30;
    doc.font("Helvetica").fontSize(10);
    const itemName = purchase.packageSnapshot.name[lang] || purchase.packageSnapshot.name.de;
    const totalCoins =
      purchase.packageSnapshot.baseCoins + purchase.packageSnapshot.bonusCoins;
    doc.text(`${itemName} (${totalCoins} ${t.coins})`, 58, itemY);
    doc.text("1", 328, itemY);
    doc.text(`${priceEur.toFixed(2)} €`, 370, itemY);
    doc.text(`${priceEur.toFixed(2)} €`, 470, itemY);

    // Separator
    doc
      .moveTo(50, itemY + 25)
      .lineTo(545, itemY + 25)
      .stroke("#dddddd");

    // Totals
    const totalsY = itemY + 40;
    doc.fontSize(10).font("Helvetica");
    doc.text(t.netAmount, 350, totalsY);
    doc.text(`${netAmount.toFixed(2)} €`, 470, totalsY);

    doc.text(`${t.vat} (${settings.taxRate}%)`, 350, totalsY + 18);
    doc.text(`${taxAmount.toFixed(2)} €`, 470, totalsY + 18);

    doc
      .moveTo(350, totalsY + 36)
      .lineTo(545, totalsY + 36)
      .stroke("#000000");

    doc.font("Helvetica-Bold").fontSize(12);
    doc.text(t.grossTotal, 350, totalsY + 44);
    doc.text(`${priceEur.toFixed(2)} €`, 466, totalsY + 44);

    // Payment note
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#666666")
      .text(t.paidViaStripe, 50, totalsY + 80);

    // Footer
    const footerY = 750;
    doc.fontSize(8).fillColor("#999999");
    if (settings.footerText?.[lang]) {
      doc.text(settings.footerText[lang], 50, footerY, { width: 495, align: "center" });
    }
    if (settings.email) {
      doc.text(settings.email, 50, footerY + 14, { width: 495, align: "center" });
    }

    doc.end();
  });
}

function formatDate(date: Date, lang: string): string {
  return new Date(date).toLocaleDateString(lang === "de" ? "de-DE" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const translations = {
  de: {
    invoice: "Rechnung",
    invoiceNumber: "Rechnungsnummer",
    invoiceDate: "Rechnungsdatum",
    billedTo: "Rechnungsempfänger",
    description: "Beschreibung",
    qty: "Menge",
    unitPrice: "Einzelpreis",
    total: "Gesamt",
    coins: "Münzen",
    netAmount: "Nettobetrag",
    vat: "USt.",
    grossTotal: "Bruttobetrag",
    paidViaStripe: "Bezahlt via Stripe • Vielen Dank für Ihren Einkauf!",
    taxId: "USt-IdNr",
  },
  en: {
    invoice: "Invoice",
    invoiceNumber: "Invoice Number",
    invoiceDate: "Invoice Date",
    billedTo: "Billed To",
    description: "Description",
    qty: "Qty",
    unitPrice: "Unit Price",
    total: "Total",
    coins: "Coins",
    netAmount: "Net Amount",
    vat: "VAT",
    grossTotal: "Gross Total",
    paidViaStripe: "Paid via Stripe • Thank you for your purchase!",
    taxId: "Tax ID",
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/invoice-generator.ts
git commit -m "feat: add PDFKit invoice generator for German Rechnung"
```

---

### Task 19: Invoice download endpoint

**Files:**
- Create: `app/api/coins/purchases/[id]/invoice/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/coins/purchases/[id]/invoice/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import CoinPurchase from "@/models/coin-purchase";
import InvoiceSettings from "@/models/invoice-settings";
import { generateInvoicePdf } from "@/lib/invoice-generator";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();

  const purchase = await CoinPurchase.findById(id)
    .populate("userId", "name email username")
    .lean();

  if (!purchase) {
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  }

  // Auth: user can only download own invoices, admins can download any
  const isOwner = purchase.userId._id?.toString() === userId;
  const isAdmin = role === "admin" || role === "super_admin";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (purchase.status !== "completed" || !purchase.invoiceNumber) {
    return NextResponse.json(
      { error: "Invoice not available" },
      { status: 404 }
    );
  }

  const settings = await InvoiceSettings.findOne().lean();
  if (!settings) {
    return NextResponse.json(
      { error: "Invoice settings not configured" },
      { status: 500 }
    );
  }

  const lang = (session.user as { language?: string }).language === "en" ? "en" : "de";
  const pdfBuffer = await generateInvoicePdf(purchase as any, settings as any, lang);

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Rechnung-${purchase.invoiceNumber}.pdf"`,
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/coins/purchases/[id]/invoice/route.ts
git commit -m "feat: add invoice PDF download endpoint"
```

---

## Phase 5: Frontend — Balance Page

### Task 20: Update header coin balance to be clickable

**Files:**
- Modify: `components/layout/coin-balance.tsx`

- [ ] **Step 1: Read current file and add Link**

The current `coin-balance.tsx` displays coins in a `<div>`. Wrap it in a `<Link>` to the balance page.

Replace the outer container `<div>` with a `<Link>`:

```typescript
import Link from "next/link";
```

Change the outer wrapper from a `<div>` to:

```tsx
<Link href="/balance" className="...existing classes... cursor-pointer hover:opacity-80 transition-opacity">
```

> **Important:** Check the exact current markup. The component fetches from `/api/profile` and displays `coins`. Keep all existing logic, just wrap the display in a `<Link>`.

- [ ] **Step 2: Commit**

```bash
git add components/layout/coin-balance.tsx
git commit -m "feat: make header coin balance clickable, links to /balance"
```

---

### Task 21: Add navigation items

**Files:**
- Modify: `components/layout/sidebar-nav.tsx`

- [ ] **Step 1: Add balance page to mainNavItems**

In `sidebar-nav.tsx`, add to the `mainNavItems` array:

```typescript
{ key: "balance", href: "/balance", icon: "Wallet" },
```

Add to `adminNavItems`:

```typescript
{ key: "coinPackages", href: "/admin/coin-packages", icon: "CreditCard" },
{ key: "invoiceSettings", href: "/admin/invoice-settings", icon: "FileText" },
```

- [ ] **Step 2: Commit**

```bash
git add components/layout/sidebar-nav.tsx
git commit -m "feat: add balance and admin coin pages to navigation"
```

---

### Task 22: Create identity verification banner component

**Files:**
- Create: `components/balance/identity-verification-banner.tsx`

- [ ] **Step 1: Create the component**

Create `components/balance/identity-verification-banner.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";

interface IdentityVerificationBannerProps {
  dict: Record<string, string>;
}

export function IdentityVerificationBanner({
  dict,
}: IdentityVerificationBannerProps) {
  const [loading, setLoading] = useState(false);

  async function handleVerify() {
    setLoading(true);
    try {
      const res = await fetch("/api/coins/verify-identity", {
        method: "POST",
      });
      const data = await res.json();
      if (data.verificationUrl) {
        window.location.href = data.verificationUrl;
      }
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="bg-gradient-to-r from-pa-lila to-[#3a0a5c] border border-pa-green rounded-xl p-4 flex items-center gap-4">
      <ShieldCheck className="h-8 w-8 text-pa-green flex-shrink-0" />
      <div className="flex-1">
        <p className="text-white font-semibold text-sm">
          {dict.verificationRequired || "Altersverifizierung erforderlich"}
        </p>
        <p className="text-text-secondary text-xs mt-0.5">
          {dict.verificationDescription ||
            "Einmalige Verifizierung via Stripe Identity, bevor du Münzen kaufen kannst."}
        </p>
      </div>
      <button
        onClick={handleVerify}
        disabled={loading}
        className="bg-pa-green text-bg font-bold text-sm px-5 py-2 rounded-lg hover:bg-pa-green-hover transition-colors disabled:opacity-50"
      >
        {loading
          ? dict.verifying || "Wird geladen..."
          : dict.verifyNow || "Jetzt verifizieren"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/balance/identity-verification-banner.tsx
git commit -m "feat: add identity verification banner component"
```

---

### Task 23: Create package card component

**Files:**
- Create: `components/balance/package-card.tsx`

- [ ] **Step 1: Create the component**

Create `components/balance/package-card.tsx`:

```tsx
"use client";

import { Coins } from "lucide-react";

interface PackageCardProps {
  pkg: {
    _id: string;
    name: { de: string; en: string };
    baseCoins: number;
    bonusCoins: number;
    priceEurCents: number;
    icon: string | null;
    highlightLabel: { de: string; en: string } | null;
  };
  lang: string;
  onSelect: (packageId: string) => void;
  disabled?: boolean;
}

export function PackageCard({
  pkg,
  lang,
  onSelect,
  disabled,
}: PackageCardProps) {
  const name = lang === "en" ? pkg.name.en : pkg.name.de;
  const highlight =
    pkg.highlightLabel &&
    (lang === "en" ? pkg.highlightLabel.en : pkg.highlightLabel.de);
  const priceEur = (pkg.priceEurCents / 100).toFixed(2).replace(".", ",");

  return (
    <button
      onClick={() => onSelect(pkg._id)}
      disabled={disabled}
      className={`
        relative bg-surface border rounded-xl p-5 text-center transition-all
        hover:border-pa-green hover:shadow-[0_0_20px_rgba(155,255,0,0.1)]
        disabled:opacity-50 disabled:cursor-not-allowed
        ${highlight ? "border-pa-green shadow-[0_0_20px_rgba(155,255,0,0.1)]" : "border-border"}
      `}
    >
      {highlight && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-pa-green text-bg text-[11px] font-extrabold px-3 py-0.5 rounded-full uppercase">
          {highlight}
        </span>
      )}

      <div className="text-3xl mb-2">{pkg.icon || "🪙"}</div>
      <div className="font-bold text-white text-[15px]">{name}</div>
      <div className="text-2xl font-extrabold text-pa-green my-2">
        {pkg.baseCoins}
        {pkg.bonusCoins > 0 && (
          <span className="text-sm text-pa-green-hover ml-1">
            +{pkg.bonusCoins}
          </span>
        )}
      </div>
      <div className="text-text-secondary text-xs flex items-center justify-center gap-1">
        <Coins className="h-3 w-3" />
        Münzen
      </div>
      <div className="bg-surface-elevated rounded-lg py-2 mt-3">
        <span className="font-bold text-white">{priceEur} €</span>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/balance/package-card.tsx
git commit -m "feat: add coin package card component"
```

---

### Task 24: Create purchase history component

**Files:**
- Create: `components/balance/purchase-history.tsx`

- [ ] **Step 1: Create the component**

Create `components/balance/purchase-history.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, ChevronLeft, ChevronRight } from "lucide-react";

interface Purchase {
  _id: string;
  packageSnapshot: {
    name: { de: string; en: string };
    baseCoins: number;
    bonusCoins: number;
    priceEurCents: number;
  };
  status: string;
  coinsGranted: number;
  invoiceNumber: string | null;
  createdAt: string;
}

interface PurchaseHistoryProps {
  lang: string;
  dict: Record<string, string>;
}

export function PurchaseHistory({ lang, dict }: PurchaseHistoryProps) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/coins/purchases?page=${page}&limit=10`);
      const data = await res.json();
      setPurchases(data.purchases || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch {
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  async function downloadInvoice(purchaseId: string, invoiceNumber: string) {
    const res = await fetch(`/api/coins/purchases/${purchaseId}/invoice`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Rechnung-${invoiceNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading && purchases.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-8 text-center text-text-secondary">
        {dict.loading || "Laden..."}
      </div>
    );
  }

  if (purchases.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-8 text-center text-text-secondary">
        {dict.noPurchases || "Noch keine Käufe."}
      </div>
    );
  }

  return (
    <div>
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {purchases.map((p, i) => {
          const name =
            lang === "en"
              ? p.packageSnapshot.name.en
              : p.packageSnapshot.name.de;
          const total = p.coinsGranted || p.packageSnapshot.baseCoins + p.packageSnapshot.bonusCoins;
          const date = new Date(p.createdAt).toLocaleDateString(
            lang === "de" ? "de-DE" : "en-US",
            { day: "numeric", month: "long", year: "numeric" }
          );

          return (
            <div
              key={p._id}
              className={`flex items-center px-4 py-3 ${
                i < purchases.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-semibold truncate">
                  {name}
                </div>
                <div className="text-text-muted text-xs mt-0.5">
                  {date} • {p.status === "completed" ? "Stripe" : p.status}
                </div>
              </div>
              <div
                className={`font-bold text-sm mr-4 ${
                  p.status === "completed"
                    ? "text-pa-green"
                    : "text-text-secondary"
                }`}
              >
                {p.status === "completed" ? `+${total} 🪙` : "—"}
              </div>
              {p.invoiceNumber && p.status === "completed" && (
                <button
                  onClick={() => downloadInvoice(p._id, p.invoiceNumber!)}
                  className="bg-surface-elevated px-3 py-1 rounded-md text-xs text-text-secondary hover:text-white transition-colors flex items-center gap-1"
                >
                  <FileText className="h-3 w-3" />
                  {dict.invoice || "Rechnung"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-text-secondary hover:text-white disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-text-secondary text-sm">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="text-text-secondary hover:text-white disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/balance/purchase-history.tsx
git commit -m "feat: add purchase history component with invoice download"
```

---

### Task 25: Create treasure chest animation

**Files:**
- Create: `components/balance/coin-chest-animation.tsx`

- [ ] **Step 1: Create the animation component**

Create `components/balance/coin-chest-animation.tsx`:

```tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";

interface CoinChestAnimationProps {
  coinsGranted: number;
  onClose: () => void;
}

export function CoinChestAnimation({
  coinsGranted,
  onClose,
}: CoinChestAnimationProps) {
  const [phase, setPhase] = useState(0); // 0=enter, 1=open, 2=rain, 3=result
  const [count, setCount] = useState(0);

  // Generate random coin trajectories
  const coins = useMemo(() => {
    return Array.from({ length: 18 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 300,
      y: -(Math.random() * 200 + 100),
      rotation: Math.random() * 720 - 360,
      delay: Math.random() * 0.4,
      size: 16 + Math.random() * 16,
    }));
  }, []);

  // Phase progression
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 3000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // Sound effects
  useEffect(() => {
    if (phase === 1) {
      playSound("/sounds/chest-open.mp3", 0.5);
    }
    if (phase === 2) {
      playSound("/sounds/coins-rain.mp3", 0.4);
    }
  }, [phase]);

  // Count-up animation
  useEffect(() => {
    if (phase < 2) return;
    const duration = 1500;
    const start = performance.now();
    let raf: number;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCount(Math.round(eased * coinsGranted));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, coinsGranted]);

  // Auto-dismiss after 8s
  useEffect(() => {
    const timer = setTimeout(onClose, 8000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer"
      onClick={onClose}
      style={{
        backgroundColor: `rgba(0, 0, 0, ${phase >= 1 ? 0.85 : 0})`,
        transition: "background-color 0.5s ease",
      }}
    >
      <div className="relative flex flex-col items-center">
        {/* Glow */}
        {phase >= 1 && (
          <div
            className="absolute rounded-full"
            style={{
              width: phase >= 2 ? 300 : 100,
              height: phase >= 2 ? 300 : 100,
              background: "radial-gradient(circle, rgba(155,255,0,0.25) 0%, transparent 70%)",
              transition: "all 1s ease-out",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          />
        )}

        {/* Chest */}
        <div
          className="relative"
          style={{
            transform: phase >= 0 ? "scale(1)" : "scale(0.3)",
            opacity: phase >= 0 ? 1 : 0,
            transition: "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s",
          }}
        >
          {/* Chest SVG */}
          <svg width="120" height="100" viewBox="0 0 120 100">
            {/* Chest base */}
            <rect
              x="10"
              y="45"
              width="100"
              height="55"
              rx="6"
              fill="#8B5E3C"
              stroke="#6B4226"
              strokeWidth="2"
            />
            <rect x="10" y="45" width="100" height="15" rx="3" fill="#A0724A" />
            {/* Lock */}
            <rect x="52" y="55" width="16" height="20" rx="3" fill="#FFD700" />
            <circle cx="60" cy="67" r="3" fill="#8B5E3C" />
            {/* Chest lid */}
            <g
              style={{
                transformOrigin: "60px 45px",
                transform: `rotateX(${phase >= 1 ? -110 : 0}deg)`,
                transition: "transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            >
              <path
                d="M10,45 Q60,10 110,45 L110,45 L10,45 Z"
                fill="#A0724A"
                stroke="#6B4226"
                strokeWidth="2"
              />
              <rect
                x="10"
                y="35"
                width="100"
                height="15"
                rx="4"
                fill="#8B5E3C"
                stroke="#6B4226"
                strokeWidth="2"
              />
            </g>
          </svg>
        </div>

        {/* Coin particles */}
        {phase >= 2 &&
          coins.map((coin) => (
            <div
              key={coin.id}
              className="absolute"
              style={{
                left: "50%",
                top: "30%",
                width: coin.size,
                height: coin.size,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #FFD700, #FFA500)",
                boxShadow: "0 0 8px rgba(255, 215, 0, 0.5)",
                animation: `coinFly 1.2s ${coin.delay}s ease-out forwards`,
                "--coin-x": `${coin.x}px`,
                "--coin-y": `${coin.y}px`,
                "--coin-rotate": `${coin.rotation}deg`,
                opacity: 0,
              } as React.CSSProperties}
            />
          ))}

        {/* Count display */}
        {phase >= 2 && (
          <div
            className="mt-6 text-center"
            style={{
              opacity: phase >= 2 ? 1 : 0,
              transform: phase >= 3 ? "scale(1.1)" : "scale(1)",
              transition: "all 0.5s ease",
            }}
          >
            <div className="text-5xl font-black text-pa-green tabular-nums">
              +{count}
            </div>
            <div className="text-white text-lg font-semibold mt-1">
              Münzen gutgeschrieben!
            </div>
            {phase >= 3 && (
              <div className="text-text-secondary text-sm mt-3 animate-pulse">
                Klicke zum Schließen
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes coinFly {
          0% {
            opacity: 1;
            transform: translate(0, 0) rotate(0deg);
          }
          80% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(var(--coin-x), var(--coin-y))
              rotate(var(--coin-rotate));
          }
        }
      `}</style>
    </div>
  );
}

function playSound(src: string, volume = 0.5) {
  try {
    const audio = new Audio(src);
    audio.volume = volume;
    audio.play().catch(() => {});
  } catch {
    // Silently fail if audio not available
  }
}
```

- [ ] **Step 2: Add placeholder sound files**

Create empty/placeholder MP3 files. Source actual royalty-free sounds from freesound.org (< 50KB each) and place them at:
- `public/sounds/chest-open.mp3`
- `public/sounds/coins-rain.mp3`

> **Note:** For now, create minimal placeholder files. Replace with real sounds before release.

```bash
# Create sounds directory
mkdir -p public/sounds
# Create minimal placeholder files (will be replaced with real sounds)
echo "" > public/sounds/chest-open.mp3
echo "" > public/sounds/coins-rain.mp3
```

- [ ] **Step 3: Commit**

```bash
git add components/balance/coin-chest-animation.tsx public/sounds/
git commit -m "feat: add treasure chest animation with coin particle effects"
```

---

### Task 25b: Create checkout confirmation modal (Widerrufsrecht)

**Files:**
- Create: `components/balance/checkout-confirmation-modal.tsx`

This modal is shown BEFORE redirecting to Stripe Checkout. Required by German law (§ 356 Abs. 5 BGB) — the user must explicitly consent to waive their right of withdrawal for digital content delivered immediately.

- [ ] **Step 1: Create the modal component**

Create `components/balance/checkout-confirmation-modal.tsx`:

```tsx
"use client";

import { useState } from "react";
import { X, ExternalLink } from "lucide-react";

interface CheckoutConfirmationModalProps {
  pkg: {
    name: { de: string; en: string };
    baseCoins: number;
    bonusCoins: number;
    priceEurCents: number;
    icon: string | null;
  };
  lang: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CheckoutConfirmationModal({
  pkg,
  lang,
  loading,
  onConfirm,
  onCancel,
}: CheckoutConfirmationModalProps) {
  const [consentChecked, setConsentChecked] = useState(false);
  const name = lang === "en" ? pkg.name.en : pkg.name.de;
  const totalCoins = pkg.baseCoins + pkg.bonusCoins;
  const priceEur = (pkg.priceEurCents / 100).toFixed(2).replace(".", ",");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-surface border border-border rounded-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-lg">
            {lang === "en" ? "Confirm Purchase" : "Kauf bestätigen"}
          </h3>
          <button
            onClick={onCancel}
            className="text-text-secondary hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Package summary */}
        <div className="bg-surface-elevated rounded-lg p-4 mb-4 text-center">
          <div className="text-2xl mb-1">{pkg.icon || "🪙"}</div>
          <div className="text-white font-bold">{name}</div>
          <div className="text-pa-green font-extrabold text-xl mt-1">
            {totalCoins} {lang === "en" ? "Coins" : "Münzen"}
          </div>
          <div className="text-text-secondary text-sm mt-1">{priceEur} €</div>
        </div>

        {/* Widerrufsrecht consent checkbox */}
        <label className="flex gap-3 cursor-pointer mb-4">
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
            className="accent-pa-green mt-1 flex-shrink-0"
          />
          <span className="text-text-secondary text-xs leading-relaxed">
            {lang === "en"
              ? "I expressly agree that PackAttack.gg begins delivery of the digital content (Coins) immediately. I acknowledge that I lose my right of withdrawal upon complete delivery of the digital content. I have read the "
              : "Ich stimme ausdrücklich zu, dass PackAttack.gg sofort mit der Bereitstellung der digitalen Inhalte (Coins) beginnt. Mir ist bekannt, dass ich dadurch mein Widerrufsrecht mit vollständiger Bereitstellung der digitalen Inhalte verliere. Ich habe die "}
            <a
              href={`/${lang}/widerrufsbelehrung`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-pa-green hover:underline inline-flex items-center gap-0.5"
            >
              {lang === "en" ? "cancellation policy" : "Widerrufsbelehrung"}
              <ExternalLink className="h-3 w-3" />
            </a>
            {lang === "en" ? " ." : " zur Kenntnis genommen."}
          </span>
        </label>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm text-text-secondary border border-border rounded-lg hover:text-white hover:border-text-secondary transition-colors"
          >
            {lang === "en" ? "Cancel" : "Abbrechen"}
          </button>
          <button
            onClick={onConfirm}
            disabled={!consentChecked || loading}
            className="flex-1 bg-pa-green text-bg font-bold text-sm px-4 py-2.5 rounded-lg hover:bg-pa-green-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading
              ? lang === "en"
                ? "Redirecting..."
                : "Weiterleitung..."
              : lang === "en"
                ? "Proceed to Payment"
                : "Weiter zur Zahlung"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/balance/checkout-confirmation-modal.tsx
git commit -m "feat: add checkout confirmation modal with Widerrufsrecht consent"
```

---

### Task 26: Create main balance page

**Files:**
- Create: `components/balance/balance-page.tsx`
- Create: `app/[lang]/(dashboard)/balance/page.tsx`

- [ ] **Step 1: Create the client component**

Create `components/balance/balance-page.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Coins, Zap } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { IdentityVerificationBanner } from "./identity-verification-banner";
import { PackageCard } from "./package-card";
import { PurchaseHistory } from "./purchase-history";
import { CoinChestAnimation } from "./coin-chest-animation";
import { CheckoutConfirmationModal } from "./checkout-confirmation-modal";
import { useToast } from "@/components/ui/toast-context";

interface CoinPackageData {
  _id: string;
  name: { de: string; en: string };
  baseCoins: number;
  bonusCoins: number;
  priceEurCents: number;
  icon: string | null;
  highlightLabel: { de: string; en: string } | null;
}

interface BalancePageProps {
  lang: string;
  dict: Record<string, string>;
}

export function BalancePage({ lang, dict }: BalancePageProps) {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [packages, setPackages] = useState<CoinPackageData[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [identityVerified, setIdentityVerified] = useState<boolean | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<CoinPackageData | null>(null);
  const [showAnimation, setShowAnimation] = useState(false);
  const [animationCoins, setAnimationCoins] = useState(0);

  // Fetch initial data
  useEffect(() => {
    Promise.all([
      fetch("/api/coins/packages").then((r) => r.json()),
      fetch("/api/profile").then((r) => r.json()),
      fetch("/api/coins/verify-identity/status").then((r) => r.json()),
    ]).then(([pkgs, profile, identity]) => {
      setPackages(pkgs || []);
      setBalance(profile?.coins || 0);
      setIdentityVerified(identity?.identityVerified ?? false);
    });
  }, []);

  // Handle success return from Stripe Checkout
  useEffect(() => {
    const success = searchParams.get("success");
    const sessionId = searchParams.get("session_id");
    const canceled = searchParams.get("canceled");

    if (canceled) {
      toast({ type: "info", title: dict.paymentCanceled || "Zahlung abgebrochen" });
      return;
    }

    if (success && sessionId) {
      pollPurchaseStatus(sessionId);
    }
  }, [searchParams]);

  const pollPurchaseStatus = useCallback(
    async (sessionId: string) => {
      const maxAttempts = 10;
      for (let i = 0; i < maxAttempts; i++) {
        const res = await fetch(
          `/api/coins/purchases?sessionId=${sessionId}`
        );
        const data = await res.json();
        if (data.purchase?.status === "completed") {
          setAnimationCoins(data.purchase.coinsGranted);
          setShowAnimation(true);
          // Refresh balance after animation
          const profileRes = await fetch("/api/profile");
          const profile = await profileRes.json();
          setBalance(profile?.coins || 0);
          // Dispatch event for header coin balance refresh
          window.dispatchEvent(new CustomEvent("coin-balance-refresh"));
          return;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      toast({
        type: "info",
        title: dict.paymentProcessing || "Zahlung wird verarbeitet...",
        message:
          dict.paymentProcessingDesc ||
          "Deine Münzen werden in Kürze gutgeschrieben.",
      });
    },
    [toast, dict]
  );

  function handleSelectPackage(packageId: string) {
    if (!identityVerified) {
      toast({
        type: "warning",
        title: dict.verificationNeeded || "Verifizierung erforderlich",
        message:
          dict.verificationNeededDesc ||
          "Bitte verifiziere zuerst dein Alter.",
      });
      return;
    }

    // Show confirmation modal with Widerrufsrecht consent
    const pkg = packages.find((p) => p._id === packageId);
    if (pkg) setSelectedPackage(pkg);
  }

  async function handleConfirmCheckout() {
    if (!selectedPackage) return;
    setCheckoutLoading(selectedPackage._id);
    try {
      const res = await fetch("/api/coins/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId: selectedPackage._id,
          withdrawalConsent: true,
        }),
      });
      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast({
          type: "error",
          title: dict.checkoutError || "Fehler",
          message: data.error || "Checkout konnte nicht erstellt werden.",
        });
      }
    } catch {
      toast({
        type: "error",
        title: dict.checkoutError || "Fehler",
        message: "Ein unerwarteter Fehler ist aufgetreten.",
      });
    } finally {
      setCheckoutLoading(null);
      setSelectedPackage(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Animation overlay */}
      {showAnimation && (
        <CoinChestAnimation
          coinsGranted={animationCoins}
          onClose={() => setShowAnimation(false)}
        />
      )}

      {/* Checkout confirmation modal (Widerrufsrecht consent) */}
      {selectedPackage && (
        <CheckoutConfirmationModal
          pkg={selectedPackage}
          lang={lang}
          loading={checkoutLoading === selectedPackage._id}
          onConfirm={handleConfirmCheckout}
          onCancel={() => setSelectedPackage(null)}
        />
      )}

      {/* Identity verification banner */}
      {identityVerified === false && (
        <IdentityVerificationBanner dict={dict} />
      )}

      {/* Balance display */}
      <div className="text-center py-4">
        <div className="text-text-secondary text-xs uppercase tracking-widest">
          {dict.yourBalance || "Dein Guthaben"}
        </div>
        <div className="text-5xl font-extrabold text-pa-green my-2 tabular-nums flex items-center justify-center gap-3">
          <Coins className="h-10 w-10" />
          {balance.toLocaleString("de-DE")}
        </div>
        <div className="text-text-muted text-sm">
          {dict.coins || "Münzen"} •{" "}
          {dict.equivalent || "entspricht"}{" "}
          {balance.toLocaleString("de-DE", {
            minimumFractionDigits: 2,
          })}{" "}
          €
        </div>
      </div>

      {/* Packages grid */}
      <div>
        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
          <Zap className="h-5 w-5 text-pa-green" />
          {dict.topUp || "Münzen aufladen"}
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {packages.map((pkg) => (
            <PackageCard
              key={pkg._id}
              pkg={pkg}
              lang={lang}
              onSelect={handleSelectPackage}
              disabled={checkoutLoading === pkg._id}
            />
          ))}
        </div>
      </div>

      {/* Transaction history */}
      <div>
        <h3 className="text-lg font-bold text-white mb-4">
          {dict.transactionHistory || "Transaktionshistorie"}
        </h3>
        <PurchaseHistory lang={lang} dict={dict} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the server page component**

Create `app/[lang]/(dashboard)/balance/page.tsx`:

```tsx
import { getDictionary, Locale } from "@/lib/i18n";
import { BalancePage } from "@/components/balance/balance-page";

export default async function BalancePageRoute({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale, "balance");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {dict.pageTitle || "Guthaben"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {dict.pageSubtitle ||
            "Verwalte dein Guthaben und lade Münzen auf."}
        </p>
      </div>
      <BalancePage lang={lang} dict={dict} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/balance/balance-page.tsx app/[lang]/(dashboard)/balance/page.tsx
git commit -m "feat: add balance page with package grid, history, and animation trigger"
```

---

## Phase 6: Admin Frontend

### Task 27: Admin coin package manager

**Files:**
- Create: `app/[lang]/(dashboard)/admin/coin-packages/page.tsx`
- Create: `components/admin/coin-package-manager.tsx`

- [ ] **Step 1: Create the admin page**

Create `app/[lang]/(dashboard)/admin/coin-packages/page.tsx`:

```tsx
import { getDictionary, Locale } from "@/lib/i18n";
import { CoinPackageManager } from "@/components/admin/coin-package-manager";

export default async function CoinPackagesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale, "admin");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {dict.coinPackagesTitle || "Münzpakete"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {dict.coinPackagesSubtitle ||
            "Erstelle und verwalte Münzpakete für den Shop."}
        </p>
      </div>
      <CoinPackageManager lang={lang} dict={dict} />
    </div>
  );
}
```

- [ ] **Step 2: Create the manager component**

Create `components/admin/coin-package-manager.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Trash2, ArrowUpDown } from "lucide-react";
import { CoinPackageForm } from "./coin-package-form";
import { useToast } from "@/components/ui/toast-context";

interface CoinPackageData {
  _id: string;
  name: { de: string; en: string };
  baseCoins: number;
  bonusCoins: number;
  priceEurCents: number;
  isActive: boolean;
  sortOrder: number;
  icon: string | null;
  highlightLabel: { de: string; en: string } | null;
  stripePriceId: string | null;
}

interface CoinPackageManagerProps {
  lang: string;
  dict: Record<string, string>;
}

export function CoinPackageManager({ lang, dict }: CoinPackageManagerProps) {
  const { toast } = useToast();
  const [packages, setPackages] = useState<CoinPackageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPackage, setEditingPackage] = useState<CoinPackageData | null>(
    null
  );

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/coin-packages");
      const data = await res.json();
      setPackages(Array.isArray(data) ? data : []);
    } catch {
      setPackages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  async function handleDelete(id: string) {
    if (!confirm(dict.confirmDeactivate || "Paket wirklich deaktivieren?"))
      return;

    const res = await fetch(`/api/admin/coin-packages/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast({
        type: "success",
        title: dict.packageDeactivated || "Paket deaktiviert",
      });
      fetchPackages();
    }
  }

  function handleEdit(pkg: CoinPackageData) {
    setEditingPackage(pkg);
    setShowForm(true);
  }

  function handleFormClose() {
    setShowForm(false);
    setEditingPackage(null);
    fetchPackages();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => {
            setEditingPackage(null);
            setShowForm(true);
          }}
          className="bg-pa-green text-bg font-bold text-sm px-4 py-2 rounded-lg hover:bg-pa-green-hover transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          {dict.newPackage || "Neues Paket"}
        </button>
      </div>

      {showForm && (
        <CoinPackageForm
          lang={lang}
          dict={dict}
          editData={editingPackage}
          onClose={handleFormClose}
        />
      )}

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-text-secondary text-xs uppercase">
              <th className="text-left p-3">
                <div className="flex items-center gap-1">
                  <ArrowUpDown className="h-3 w-3" /> {dict.order || "#"}
                </div>
              </th>
              <th className="text-left p-3">{dict.name || "Name"}</th>
              <th className="text-right p-3">{dict.coins || "Münzen"}</th>
              <th className="text-right p-3">{dict.bonus || "Bonus"}</th>
              <th className="text-right p-3">{dict.price || "Preis"}</th>
              <th className="text-center p-3">{dict.status || "Status"}</th>
              <th className="text-center p-3">{dict.stripe || "Stripe"}</th>
              <th className="text-right p-3">{dict.actions || "Aktionen"}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-text-secondary">
                  {dict.loading || "Laden..."}
                </td>
              </tr>
            ) : packages.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-text-secondary">
                  {dict.noPackages || "Keine Pakete vorhanden."}
                </td>
              </tr>
            ) : (
              packages.map((pkg) => (
                <tr key={pkg._id} className="border-b border-border last:border-0">
                  <td className="p-3 text-text-secondary">{pkg.sortOrder}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span>{pkg.icon || "🪙"}</span>
                      <span className="text-white font-medium">
                        {lang === "en" ? pkg.name.en : pkg.name.de}
                      </span>
                    </div>
                  </td>
                  <td className="p-3 text-right text-white font-mono">
                    {pkg.baseCoins}
                  </td>
                  <td className="p-3 text-right text-pa-green font-mono">
                    {pkg.bonusCoins > 0 ? `+${pkg.bonusCoins}` : "—"}
                  </td>
                  <td className="p-3 text-right text-white font-mono">
                    {(pkg.priceEurCents / 100).toFixed(2)} €
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        pkg.isActive
                          ? "bg-pa-green/10 text-pa-green"
                          : "bg-error/10 text-error"
                      }`}
                    >
                      {pkg.isActive
                        ? dict.active || "Aktiv"
                        : dict.inactive || "Inaktiv"}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`text-xs ${
                        pkg.stripePriceId ? "text-pa-green" : "text-warning"
                      }`}
                    >
                      {pkg.stripePriceId ? "✓" : "⚠"}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(pkg)}
                        className="text-text-secondary hover:text-white transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {pkg.isActive && (
                        <button
                          onClick={() => handleDelete(pkg._id)}
                          className="text-text-secondary hover:text-error transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/[lang]/(dashboard)/admin/coin-packages/page.tsx components/admin/coin-package-manager.tsx
git commit -m "feat: add admin coin package manager page"
```

---

### Task 28: Admin coin package form

**Files:**
- Create: `components/admin/coin-package-form.tsx`

- [ ] **Step 1: Create the form component**

Create `components/admin/coin-package-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useToast } from "@/components/ui/toast-context";

interface CoinPackageFormProps {
  lang: string;
  dict: Record<string, string>;
  editData: {
    _id: string;
    name: { de: string; en: string };
    baseCoins: number;
    bonusCoins: number;
    priceEurCents: number;
    isActive: boolean;
    sortOrder: number;
    icon: string | null;
    highlightLabel: { de: string; en: string } | null;
  } | null;
  onClose: () => void;
}

export function CoinPackageForm({
  dict,
  editData,
  onClose,
}: CoinPackageFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nameDe: editData?.name.de || "",
    nameEn: editData?.name.en || "",
    baseCoins: editData?.baseCoins || 10,
    bonusCoins: editData?.bonusCoins || 0,
    priceEurCents: editData?.priceEurCents || 1000,
    isActive: editData?.isActive ?? true,
    sortOrder: editData?.sortOrder || 0,
    icon: editData?.icon || "",
    highlightDe: editData?.highlightLabel?.de || "",
    highlightEn: editData?.highlightLabel?.en || "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const payload = {
      name: { de: form.nameDe, en: form.nameEn },
      baseCoins: form.baseCoins,
      bonusCoins: form.bonusCoins,
      priceEurCents: form.priceEurCents,
      isActive: form.isActive,
      sortOrder: form.sortOrder,
      icon: form.icon || null,
      highlightLabel:
        form.highlightDe || form.highlightEn
          ? { de: form.highlightDe, en: form.highlightEn }
          : null,
    };

    try {
      const url = editData
        ? `/api/admin/coin-packages/${editData._id}`
        : "/api/admin/coin-packages";
      const method = editData ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast({
          type: "success",
          title: editData
            ? dict.packageUpdated || "Paket aktualisiert"
            : dict.packageCreated || "Paket erstellt",
        });
        onClose();
      } else {
        const data = await res.json();
        toast({
          type: "error",
          title: dict.error || "Fehler",
          message: data.error || "Unbekannter Fehler",
        });
      }
    } catch {
      toast({ type: "error", title: "Fehler" });
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-pa-green focus:outline-none";

  return (
    <div className="bg-surface border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold">
          {editData
            ? dict.editPackage || "Paket bearbeiten"
            : dict.createPackage || "Neues Paket erstellen"}
        </h3>
        <button
          onClick={onClose}
          className="text-text-secondary hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-text-secondary text-xs mb-1 block">
              Name (DE)
            </label>
            <input
              className={inputClass}
              value={form.nameDe}
              onChange={(e) => setForm({ ...form, nameDe: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-text-secondary text-xs mb-1 block">
              Name (EN)
            </label>
            <input
              className={inputClass}
              value={form.nameEn}
              onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-text-secondary text-xs mb-1 block">
              {dict.baseCoins || "Basis-Münzen"} (max 1000)
            </label>
            <input
              type="number"
              className={inputClass}
              value={form.baseCoins}
              onChange={(e) =>
                setForm({ ...form, baseCoins: parseInt(e.target.value) || 0 })
              }
              min={1}
              max={1000}
              required
            />
          </div>
          <div>
            <label className="text-text-secondary text-xs mb-1 block">
              {dict.bonusCoins || "Bonus-Münzen"}
            </label>
            <input
              type="number"
              className={inputClass}
              value={form.bonusCoins}
              onChange={(e) =>
                setForm({ ...form, bonusCoins: parseInt(e.target.value) || 0 })
              }
              min={0}
            />
          </div>
          <div>
            <label className="text-text-secondary text-xs mb-1 block">
              {dict.priceCents || "Preis (Cent)"}
            </label>
            <input
              type="number"
              className={inputClass}
              value={form.priceEurCents}
              onChange={(e) =>
                setForm({
                  ...form,
                  priceEurCents: parseInt(e.target.value) || 0,
                })
              }
              min={100}
              required
            />
            <span className="text-text-muted text-xs mt-0.5 block">
              = {(form.priceEurCents / 100).toFixed(2)} €
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-text-secondary text-xs mb-1 block">
              {dict.icon || "Icon"} (Emoji)
            </label>
            <input
              className={inputClass}
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              placeholder="🥇"
            />
          </div>
          <div>
            <label className="text-text-secondary text-xs mb-1 block">
              {dict.sortOrder || "Reihenfolge"}
            </label>
            <input
              type="number"
              className={inputClass}
              value={form.sortOrder}
              onChange={(e) =>
                setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })
              }
              min={0}
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm({ ...form, isActive: e.target.checked })
                }
                className="accent-pa-green"
              />
              <span className="text-text-secondary text-sm">
                {dict.active || "Aktiv"}
              </span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-text-secondary text-xs mb-1 block">
              Highlight (DE)
            </label>
            <input
              className={inputClass}
              value={form.highlightDe}
              onChange={(e) =>
                setForm({ ...form, highlightDe: e.target.value })
              }
              placeholder="Beliebt!"
            />
          </div>
          <div>
            <label className="text-text-secondary text-xs mb-1 block">
              Highlight (EN)
            </label>
            <input
              className={inputClass}
              value={form.highlightEn}
              onChange={(e) =>
                setForm({ ...form, highlightEn: e.target.value })
              }
              placeholder="Popular!"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-secondary hover:text-white"
          >
            {dict.cancel || "Abbrechen"}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="bg-pa-green text-bg font-bold text-sm px-6 py-2 rounded-lg hover:bg-pa-green-hover transition-colors disabled:opacity-50"
          >
            {loading
              ? dict.saving || "Speichern..."
              : editData
                ? dict.save || "Speichern"
                : dict.create || "Erstellen"}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/coin-package-form.tsx
git commit -m "feat: add admin coin package create/edit form"
```

---

### Task 29: Admin invoice settings page

**Files:**
- Create: `app/[lang]/(dashboard)/admin/invoice-settings/page.tsx`
- Create: `components/admin/invoice-settings-form.tsx`

- [ ] **Step 1: Create the admin page**

Create `app/[lang]/(dashboard)/admin/invoice-settings/page.tsx`:

```tsx
import { getDictionary, Locale } from "@/lib/i18n";
import { InvoiceSettingsForm } from "@/components/admin/invoice-settings-form";

export default async function InvoiceSettingsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale, "admin");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {dict.invoiceSettingsTitle || "Rechnungseinstellungen"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {dict.invoiceSettingsSubtitle ||
            "Firmendaten und Rechnungskonfiguration für PDF-Rechnungen."}
        </p>
      </div>
      <InvoiceSettingsForm dict={dict} />
    </div>
  );
}
```

- [ ] **Step 2: Create the form component**

Create `components/admin/invoice-settings-form.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/toast-context";

interface InvoiceSettingsFormProps {
  dict: Record<string, string>;
}

export function InvoiceSettingsForm({ dict }: InvoiceSettingsFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    street: "",
    zip: "",
    city: "",
    country: "Deutschland",
    taxId: "",
    taxRate: 19,
    email: "",
    phone: "",
    website: "",
    invoicePrefix: "PA",
    footerDe: "",
    footerEn: "",
    iban: "",
    bic: "",
    bankName: "",
  });

  useEffect(() => {
    fetch("/api/admin/invoice-settings")
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) {
          setForm({
            companyName: data.companyName || "",
            street: data.companyAddress?.street || "",
            zip: data.companyAddress?.zip || "",
            city: data.companyAddress?.city || "",
            country: data.companyAddress?.country || "Deutschland",
            taxId: data.taxId || "",
            taxRate: data.taxRate ?? 19,
            email: data.email || "",
            phone: data.phone || "",
            website: data.website || "",
            invoicePrefix: data.invoicePrefix || "PA",
            footerDe: data.footerText?.de || "",
            footerEn: data.footerText?.en || "",
            iban: data.bankDetails?.iban || "",
            bic: data.bankDetails?.bic || "",
            bankName: data.bankDetails?.bankName || "",
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const payload = {
      companyName: form.companyName,
      companyAddress: {
        street: form.street,
        zip: form.zip,
        city: form.city,
        country: form.country,
      },
      taxId: form.taxId,
      taxRate: form.taxRate,
      email: form.email,
      phone: form.phone || null,
      website: form.website || null,
      invoicePrefix: form.invoicePrefix,
      footerText:
        form.footerDe || form.footerEn
          ? { de: form.footerDe, en: form.footerEn }
          : null,
      bankDetails:
        form.iban
          ? { iban: form.iban, bic: form.bic, bankName: form.bankName }
          : null,
    };

    try {
      const res = await fetch("/api/admin/invoice-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast({
          type: "success",
          title: dict.settingsSaved || "Einstellungen gespeichert",
        });
      } else {
        const data = await res.json();
        toast({
          type: "error",
          title: dict.error || "Fehler",
          message: data.error,
        });
      }
    } catch {
      toast({ type: "error", title: "Fehler" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="text-text-secondary text-center py-8">
        {dict.loading || "Laden..."}
      </div>
    );
  }

  const inputClass =
    "w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-pa-green focus:outline-none";
  const labelClass = "text-text-secondary text-xs mb-1 block";

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Company Info */}
      <section className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <h3 className="text-white font-bold text-sm">
          {dict.companyInfo || "Firmendaten"}
        </h3>
        <div>
          <label className={labelClass}>
            {dict.companyName || "Firmenname"}
          </label>
          <input
            className={inputClass}
            value={form.companyName}
            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            required
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className={labelClass}>{dict.street || "Straße"}</label>
            <input
              className={inputClass}
              value={form.street}
              onChange={(e) => setForm({ ...form, street: e.target.value })}
              required
            />
          </div>
          <div>
            <label className={labelClass}>{dict.zip || "PLZ"}</label>
            <input
              className={inputClass}
              value={form.zip}
              onChange={(e) => setForm({ ...form, zip: e.target.value })}
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>{dict.city || "Stadt"}</label>
            <input
              className={inputClass}
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              required
            />
          </div>
          <div>
            <label className={labelClass}>{dict.country || "Land"}</label>
            <input
              className={inputClass}
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>USt-IdNr</label>
            <input
              className={inputClass}
              value={form.taxId}
              onChange={(e) => setForm({ ...form, taxId: e.target.value })}
              placeholder="DE123456789"
              required
            />
          </div>
          <div>
            <label className={labelClass}>
              {dict.taxRate || "Steuersatz"} (%)
            </label>
            <input
              type="number"
              className={inputClass}
              value={form.taxRate}
              onChange={(e) =>
                setForm({ ...form, taxRate: parseFloat(e.target.value) || 0 })
              }
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>E-Mail</label>
            <input
              type="email"
              className={inputClass}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className={labelClass}>{dict.phone || "Telefon"}</label>
            <input
              className={inputClass}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
        </div>
      </section>

      {/* Bank Details */}
      <section className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <h3 className="text-white font-bold text-sm">
          {dict.bankDetails || "Bankdaten"} ({dict.optional || "optional"})
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>IBAN</label>
            <input
              className={inputClass}
              value={form.iban}
              onChange={(e) => setForm({ ...form, iban: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass}>BIC</label>
            <input
              className={inputClass}
              value={form.bic}
              onChange={(e) => setForm({ ...form, bic: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass}>{dict.bankName || "Bank"}</label>
            <input
              className={inputClass}
              value={form.bankName}
              onChange={(e) => setForm({ ...form, bankName: e.target.value })}
            />
          </div>
        </div>
      </section>

      {/* Invoice Config */}
      <section className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <h3 className="text-white font-bold text-sm">
          {dict.invoiceConfig || "Rechnungskonfiguration"}
        </h3>
        <div>
          <label className={labelClass}>
            {dict.invoicePrefix || "Rechnungspräfix"}
          </label>
          <input
            className={inputClass}
            value={form.invoicePrefix}
            onChange={(e) =>
              setForm({ ...form, invoicePrefix: e.target.value })
            }
            maxLength={10}
            required
          />
          <span className="text-text-muted text-xs mt-0.5 block">
            z.B. "PA" → PA-2026-000001
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Footer (DE)</label>
            <textarea
              className={inputClass}
              value={form.footerDe}
              onChange={(e) => setForm({ ...form, footerDe: e.target.value })}
              rows={2}
            />
          </div>
          <div>
            <label className={labelClass}>Footer (EN)</label>
            <textarea
              className={inputClass}
              value={form.footerEn}
              onChange={(e) => setForm({ ...form, footerEn: e.target.value })}
              rows={2}
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="bg-pa-green text-bg font-bold text-sm px-6 py-2 rounded-lg hover:bg-pa-green-hover transition-colors disabled:opacity-50"
        >
          {saving
            ? dict.saving || "Speichern..."
            : dict.save || "Speichern"}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/[lang]/(dashboard)/admin/invoice-settings/page.tsx components/admin/invoice-settings-form.tsx
git commit -m "feat: add admin invoice settings page and form"
```

---

## Phase 7: Final Integration

### Task 30: Add i18n translation keys

- [ ] **Step 1: Add translation keys for the balance namespace**

Add translation keys via the admin translations UI or directly in the database. The key translations needed for the `balance` namespace:

```
pageTitle → "Guthaben" / "Balance"
pageSubtitle → "Verwalte dein Guthaben und lade Münzen auf." / "Manage your balance and top up coins."
yourBalance → "Dein Guthaben" / "Your Balance"
coins → "Münzen" / "Coins"
equivalent → "entspricht" / "equivalent to"
topUp → "Münzen aufladen" / "Top Up Coins"
transactionHistory → "Transaktionshistorie" / "Transaction History"
verificationRequired → "Altersverifizierung erforderlich" / "Age Verification Required"
verificationDescription → "Einmalige Verifizierung via Stripe Identity, bevor du Münzen kaufen kannst." / "One-time verification via Stripe Identity before you can buy coins."
verifyNow → "Jetzt verifizieren" / "Verify Now"
verifying → "Wird geladen..." / "Loading..."
paymentCanceled → "Zahlung abgebrochen" / "Payment Canceled"
paymentProcessing → "Zahlung wird verarbeitet..." / "Payment Processing..."
paymentProcessingDesc → "Deine Münzen werden in Kürze gutgeschrieben." / "Your coins will be credited shortly."
verificationNeeded → "Verifizierung erforderlich" / "Verification Required"
verificationNeededDesc → "Bitte verifiziere zuerst dein Alter." / "Please verify your age first."
checkoutError → "Fehler" / "Error"
invoice → "Rechnung" / "Invoice"
noPurchases → "Noch keine Käufe." / "No purchases yet."
loading → "Laden..." / "Loading..."
```

> **Note:** Since i18n is database-driven, these can be added via the admin translations page or a seed script. The components already have fallback German strings for all keys.

- [ ] **Step 2: Commit (if seed script is added)**

```bash
git commit -m "feat: add balance page translation keys"
```

---

### Task 31: Set up Stripe webhook in Dashboard

- [ ] **Step 1: Configure Stripe webhook endpoint**

In the Stripe Dashboard (test mode):
1. Go to Developers → Webhooks
2. Add endpoint: `https://YOUR_DOMAIN/api/stripe/webhook`
   - For local dev: use Stripe CLI (`stripe listen --forward-to localhost:3000/api/stripe/webhook`)
3. Select events:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `identity.verification_session.verified`
   - `identity.verification_session.requires_input`
4. Copy the webhook signing secret to `.env.local` as `STRIPE_WEBHOOK_SECRET`

- [ ] **Step 2: Install Stripe CLI for local testing**

```bash
# For local webhook testing
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

This prints the webhook signing secret — update `.env.local` with it.

---

### Task 32: End-to-end verification

- [ ] **Step 1: Start dev server and Stripe CLI**

```bash
npm run dev
# In another terminal:
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

- [ ] **Step 2: Create a test coin package via admin**

Navigate to `/de/admin/coin-packages`, create a package:
- Name: "Starter" / "Starter"
- Base Coins: 10, Bonus: 0, Price: 1000 (= 10€)
- Active: true

- [ ] **Step 3: Configure invoice settings**

Navigate to `/de/admin/invoice-settings`, fill in test company data.

- [ ] **Step 4: Test identity verification flow**

Navigate to `/de/balance`, click "Jetzt verifizieren", complete Stripe Identity test flow.

- [ ] **Step 5: Test checkout flow**

Select a package, complete Stripe test checkout (card: 4242 4242 4242 4242), verify:
- Treasure chest animation plays
- Coins are credited
- Transaction appears in history
- Invoice PDF downloads correctly

- [ ] **Step 6: Test idempotency**

Trigger the webhook event again via Stripe CLI — verify no double-granting.

- [ ] **Step 7: Test auth guards**

Verify unverified user cannot checkout (403 response).

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat: complete coin purchase system with Stripe integration"
```
