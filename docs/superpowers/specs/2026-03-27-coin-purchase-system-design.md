# Coin Purchase System — Design Spec

## Context

Users currently receive coins only through admin grants. We need a self-service coin purchase flow so users can buy coins directly via Stripe. The system must feel rewarding (gamification), comply with German invoicing requirements (Rechnung), and enforce age verification (18+) via Stripe Identity before first purchase.

## Overview

- **Balance Page** at `/{lang}/balance` — coin display, package selection, transaction history
- **Stripe Checkout** (redirect) for payments — PCI-compliant, supports Karte/SEPA/Klarna
- **Stripe Identity** (document verification) for one-time 18+ age check
- **Treasure Chest Animation** with sound after successful purchase
- **PDF Invoices** (vollständige deutsche Rechnung) downloadable per transaction
- **Admin Panel** for package CRUD and invoice settings

## Data Models

### CoinPackage (NEW: `/models/coin-package.ts`)

| Field | Type | Description |
|-------|------|-------------|
| name | `{ de: string, en: string }` | Display name per language |
| slug | `string` | Auto-generated URL-safe identifier |
| baseCoins | `number` | Base coin amount (e.g. 100) |
| bonusCoins | `number` | Bonus coins (e.g. 15), default 0 |
| totalCoins | virtual | `baseCoins + bonusCoins` |
| priceEurCents | `number` | Price in cents (e.g. 10000 = 100€) |
| stripePriceId | `string \| null` | Synced Stripe Price ID |
| isActive | `boolean` | Admin toggle |
| sortOrder | `number` | Display ordering |
| icon | `string \| null` | Lucide icon name or emoji |
| highlightLabel | `{ de: string, en: string } \| null` | e.g. "Beliebt!" |
| createdBy | `ObjectId` | Admin who created |

**Validation:** `baseCoins` must be ≤ 1000. `priceEurCents` stored as integer to avoid float issues.

### CoinPurchase (NEW: `/models/coin-purchase.ts`)

| Field | Type | Description |
|-------|------|-------------|
| userId | `ObjectId` | Buyer |
| packageId | `ObjectId` | Ref to CoinPackage |
| packageSnapshot | `{ name: {de,en}, baseCoins, bonusCoins, priceEurCents }` | Frozen package details at purchase time |
| status | `pending \| completed \| failed \| refunded \| expired` | Purchase state |
| stripeSessionId | `string` | Unique — Stripe Checkout Session ID |
| stripePaymentIntentId | `string \| null` | Filled by webhook |
| invoiceNumber | `string \| null` | e.g. "PA-2026-000042" |
| coinsGranted | `number` | Total coins actually granted |
| withdrawalConsentAt | `Date` | Timestamp when user consented to waive Widerrufsrecht |

**Indexes:** `{ userId, createdAt: -1 }`, `{ stripeSessionId: 1 }` (unique), `{ invoiceNumber: 1 }` (unique sparse)

### InvoiceSettings (NEW: `/models/invoice-settings.ts`)

Singleton document (like PlatformSettings).

| Field | Type | Description |
|-------|------|-------------|
| companyName | `string` | e.g. "PackAttack GmbH" |
| companyAddress | `{ street, zip, city, country }` | Full address |
| taxId | `string` | USt-IdNr (e.g. DE123456789) |
| taxRate | `number` | VAT percentage (e.g. 19) |
| bankDetails | `{ iban, bic, bankName } \| null` | Optional bank info |
| email | `string` | Company contact email |
| logoUrl | `string \| null` | Company logo for invoices |
| invoicePrefix | `string` | e.g. "PA" |
| nextInvoiceSequence | `number` | Atomically incremented counter |
| footerText | `{ de: string, en: string } \| null` | Custom footer |

### User Model Extensions

Add to existing `/models/user.ts`:

```
stripeCustomerId: string | null
stripeIdentityVerificationId: string | null
identityVerified: boolean (default: false)
identityVerifiedAt: Date | null
```

### CoinTransaction Extension

Add to existing `/models/coin-transaction.ts`:
- New type value: `"coin_purchase"`
- New field: `relatedPurchaseId: ObjectId | null`

## API Endpoints

### User-Facing

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/coins/packages` | List active packages (sorted by sortOrder) |
| POST | `/api/coins/checkout` | Create Stripe Checkout Session |
| GET | `/api/coins/purchases` | User's purchase history (paginated) |
| GET | `/api/coins/purchases/[id]/invoice` | Download PDF invoice |
| POST | `/api/coins/verify-identity` | Create Stripe Identity session |
| GET | `/api/coins/verify-identity/status` | Check verification status |

### Webhook

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/stripe/webhook` | Stripe webhook handler (signature-verified, no auth) |

**Handled events:**
- `checkout.session.completed` → Grant coins, update purchase, generate invoice number
- `checkout.session.expired` → Mark purchase as expired
- `identity.verification_session.verified` → Extract DOB, check ≥ 18, set `identityVerified = true`
- `identity.verification_session.requires_input` → Set `identityVerified = false`, show user a "Verifizierung fehlgeschlagen" banner with retry CTA

### Admin

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/admin/coin-packages` | List all / Create package |
| GET/PATCH/DELETE | `/api/admin/coin-packages/[id]` | Get / Update / Soft-delete |
| GET/PATCH | `/api/admin/invoice-settings` | Get / Update company & invoice settings |
| GET | `/api/admin/coin-purchases` | All purchases (filterable, paginated) |

## Stripe Integration

### Dependencies

```
npm install stripe
```

No client-side Stripe SDK needed (Checkout redirect flow).

### Environment Variables

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=https://packattack.gg
```

### Stripe Client (`/lib/stripe.ts`)

Singleton Stripe instance with latest API version.

### Widerrufsrecht (Right of Withdrawal) Compliance

German law (§ 356 Abs. 5 BGB) requires explicit consent before delivering digital content immediately. Since Stripe Checkout (redirect) does not support custom checkboxes, a **confirmation step** is needed before redirecting to Stripe:

**Confirmation Modal/Page** (shown after user selects a package, before Stripe redirect):
- Package summary (name, coins, price)
- Link to full Widerrufsbelehrung
- **Unticked checkbox** (mandatory opt-in):
  > "Ich stimme ausdrücklich zu, dass PackAttack.gg sofort mit der Bereitstellung der digitalen Inhalte (Coins) beginnt. Mir ist bekannt, dass ich dadurch mein Widerrufsrecht mit vollständiger Bereitstellung der digitalen Inhalte verliere. Ich habe die Widerrufsbelehrung zur Kenntnis genommen."
- "Weiter zur Zahlung" button (disabled until checkbox is ticked)
- Consent timestamp stored on CoinPurchase record

**Additional requirements:**
- Full Widerrufsbelehrung page accessible from the checkout flow and footer
- Muster-Widerrufsformular (withdrawal form template) must be provided
- Confirmation email after purchase must include the withdrawal waiver acknowledgment
- Coins must NOT be cashable/exchangeable to real money (would trigger BaFin/ZAG e-money requirements)

**Note:** Have a German e-commerce lawyer review all legal texts before launch.

### Checkout Flow

1. User selects package → Confirmation modal with Widerrufsrecht checkbox
2. User consents → `POST /api/coins/checkout { packageId, withdrawalConsent: true }`
3. Server validates: package exists, isActive, user is identityVerified, withdrawalConsent is true
4. Get or create Stripe Customer (store `stripeCustomerId` on User)
5. Create Checkout Session with `mode: "payment"`, `line_items: [{ price: stripePriceId, quantity: 1 }]`
6. Metadata: `{ userId, packageId, baseCoins, bonusCoins }`
7. Create CoinPurchase with `status: "pending"`, `withdrawalConsentAt: timestamp`
8. Return `{ checkoutUrl }` → Frontend redirects
9. After payment → Webhook grants coins (see below)

### Webhook Coin Granting (`checkout.session.completed`)

1. Extract metadata `{ userId, packageId, baseCoins, bonusCoins }`
2. Find CoinPurchase by `stripeSessionId`
3. **Idempotency guard:** if `status === "completed"`, return
4. Atomically `$inc User.coins` by `(baseCoins + bonusCoins)`
5. Create CoinTransaction `{ type: "coin_purchase", relatedPurchaseId }`
6. Atomically `$inc InvoiceSettings.nextInvoiceSequence` → generate invoice number
7. Update CoinPurchase: `status: "completed"`, `coinsGranted`, `invoiceNumber`

### Stripe Product/Price Sync

When admin creates/updates a CoinPackage:
- Create Stripe Product + Price on first save
- On price change: archive old Price, create new one
- On deactivation: archive Stripe Price

### Identity Verification Flow

1. User clicks "Jetzt verifizieren" → `POST /api/coins/verify-identity`
2. Create Stripe VerificationSession `{ type: "document" }` with selfie matching
3. Store `verificationSessionId` on User
4. Return `{ verificationUrl }` → Frontend redirects to Stripe-hosted UI
5. User uploads document + selfie
6. Webhook `identity.verification_session.verified`:
   - Extract `verified_outputs.dob`
   - Calculate age, check ≥ 18
   - Set `identityVerified = true`, `identityVerifiedAt = now`
   - Update `dateOfBirth` on User

**Sandbox:** Stripe Identity works in test mode with test documents. Document verification works globally (180+ countries).

## PDF Invoice Generation

### Library: PDFKit

Pure Node.js, no binary dependencies, serverless-compatible, fine-grained control for German invoice layout.

### Invoice Requirements (vollständige deutsche Rechnung)

- Rechnungsnummer (sequential: `PA-2026-000042`)
- Rechnungsdatum
- Seller: company name, address, USt-IdNr
- Buyer: user name, email
- Line items: quantity, unit price, total
- Nettobetrag, USt. (19%), Bruttobetrag
- Payment method note ("Bezahlt via Stripe")

### Generator (`/lib/invoice-generator.ts`)

Takes `CoinPurchase` (populated) + `InvoiceSettings` → returns `Buffer` (PDF).

Template-ready: all layout coordinates and text come from InvoiceSettings, making it easy to add custom template upload later.

### Download Endpoint (`GET /api/coins/purchases/[id]/invoice`)

- Auth: user can only download own invoices (or admin)
- Purchase must be `status: "completed"` with `invoiceNumber`
- PDF generated on-the-fly (deterministic from data, no storage needed)
- Headers: `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="Rechnung-PA-2026-000042.pdf"`

## Frontend

### Balance Page (`/app/[lang]/(dashboard)/balance/page.tsx`)

Server component → client component pattern (same as all other pages).

**Sections:**
1. **Identity Verification Banner** — shown if `identityVerified === false`, green-bordered CTA
2. **Balance Display** — large centered coin count with EUR equivalent
3. **Package Grid** — responsive grid (2 cols mobile, 3 cols desktop), cards with icon, name, coin count, bonus badge, price, highlight label
4. **Transaction History** — paginated list with type badges, amounts (green +, red -), invoice download buttons

### Header Link

Modify `/components/layout/coin-balance.tsx`: wrap in `<Link href="/{lang}/balance">` instead of plain `<div>`.

### Navigation

Add to `sidebar-nav.ts`:
- `mainNavItems`: `{ key: "balance", href: "/balance", icon: "Wallet" }`
- `adminNavItems`: `{ key: "coinPackages", href: "/admin/coin-packages", icon: "CreditCard" }` and `{ key: "invoiceSettings", href: "/admin/invoice-settings", icon: "FileText" }`

### Success Flow (after Stripe Checkout return)

1. User returns to `/{lang}/balance?success=true&session_id=X`
2. Poll `GET /api/coins/purchases?sessionId=X` (webhook may not have fired yet)
3. Once `status: "completed"` → trigger treasure chest animation
4. If not confirmed after 5s → show "Zahlung wird verarbeitet..." message
5. After animation → refresh CoinBalance in header (custom event `coin-balance-refresh`)

## Gamification: Treasure Chest Animation

### Component: `/components/balance/coin-chest-animation.tsx`

Fullscreen overlay modal with 4 phases:

| Phase | Time | What Happens |
|-------|------|-------------|
| 1 — Erscheinen | 0–0.5s | Chest bounces in, dark overlay fades in |
| 2 — Öffnen | 0.5–1.5s | Lid opens (CSS rotateX), golden glow, particle burst. 🔊 chest-open.mp3 |
| 3 — Münzregen | 1.5–3s | 15-20 coin SVGs fly out with random trajectories. Counter animates 0 → total. 🔊 coins-rain.mp3 |
| 4 — Ergebnis | 3s+ | "+{totalCoins} Münzen gutgeschrieben!" — click or 5s auto-dismiss |

### Technical Approach

- **Chest:** Custom SVG (2 parts: base + lid). Lid opens via `transform: rotateX(-110deg)` with `transform-origin: top center`
- **Coin particles:** 15-20 absolutely positioned SVG coins with randomized CSS `@keyframes` trajectories (inline styles via `useMemo`)
- **Glow:** Animated `box-shadow` with `rgba(155, 255, 0, 0.3)` expanding spread
- **Count-up:** `requestAnimationFrame` loop with easing over 1.5s
- **Sound:** HTML5 Audio API (`new Audio(src)`), graceful fallback if autoplay blocked
- **Sound files:** `/public/sounds/chest-open.mp3` and `/public/sounds/coins-rain.mp3` — source royalty-free from freesound.org or similar, keep files < 50KB each

No external animation libraries (no Lottie, no Framer Motion). Pure CSS + SVG + vanilla JS for zero dependency overhead.

## Admin Pages

### Coin Package Manager (`/app/[lang]/(dashboard)/admin/coin-packages/`)

- DataTable with columns: name, baseCoins, bonusCoins, price, status (active/inactive), sortOrder
- Create/Edit form: all CoinPackage fields, preview card
- Stripe sync indicator (shows if Price is synced)
- Follows existing admin CRUD pattern (same as BoxTable, UserTable)

### Invoice Settings (`/app/[lang]/(dashboard)/admin/invoice-settings/`)

- Single form with all InvoiceSettings fields
- Company logo upload (GridFS)
- Preview section showing sample invoice layout
- Follows PlatformSettingsForm pattern

## Security

- **Price tampering prevention:** Checkout uses server-side `stripePriceId`, client only sends `packageId`
- **Webhook signature verification:** `stripe.webhooks.constructEvent()` with raw body (`req.text()`)
- **Idempotency:** Unique index on `stripeSessionId` prevents double coin granting
- **Identity server-side check:** `identityVerified` flag set only by webhook, checked server-side on checkout
- **Invoice authorization:** Users can only download own invoices; admins can download any
- **Sequential invoice numbers:** Atomic `$inc` on counter prevents gaps/duplicates
- **Input validation:** All endpoints use Zod schemas
- **Max coins enforcement:** Server-side validation `baseCoins ≤ 1000`

## File Structure

### New Files

```
lib/stripe.ts                                          — Stripe client singleton
lib/invoice-generator.ts                               — PDFKit invoice generator
models/coin-package.ts                                 — CoinPackage model
models/coin-purchase.ts                                — CoinPurchase model
models/invoice-settings.ts                             — InvoiceSettings model
app/api/stripe/webhook/route.ts                        — Webhook handler
app/api/coins/packages/route.ts                        — GET active packages
app/api/coins/checkout/route.ts                        — POST create checkout
app/api/coins/purchases/route.ts                       — GET user purchases
app/api/coins/purchases/[id]/invoice/route.ts          — GET PDF invoice
app/api/coins/verify-identity/route.ts                 — POST create verification
app/api/coins/verify-identity/status/route.ts          — GET verification status
app/api/admin/coin-packages/route.ts                   — GET/POST packages (admin)
app/api/admin/coin-packages/[id]/route.ts              — GET/PATCH/DELETE (admin)
app/api/admin/invoice-settings/route.ts                — GET/PATCH settings
app/api/admin/coin-purchases/route.ts                  — GET all purchases (admin)
app/[lang]/(dashboard)/balance/page.tsx                — Balance page (server)
components/balance/balance-page.tsx                     — Main client component
components/balance/package-card.tsx                     — Package display card
components/balance/purchase-history.tsx                 — Transaction history
components/balance/identity-verification-banner.tsx    — Verification CTA
components/balance/coin-chest-animation.tsx             — Treasure chest animation
components/admin/coin-package-manager.tsx               — Package CRUD
components/admin/coin-package-form.tsx                  — Package form
components/admin/invoice-settings-form.tsx              — Invoice settings form
app/[lang]/(dashboard)/admin/coin-packages/page.tsx    — Admin packages page
app/[lang]/(dashboard)/admin/invoice-settings/page.tsx — Admin invoice settings
public/sounds/chest-open.mp3                           — Sound effect
public/sounds/coins-rain.mp3                           — Sound effect
```

### Modified Files

```
models/user.ts                          — Add Stripe/identity fields
models/coin-transaction.ts              — Add coin_purchase type + relatedPurchaseId
components/layout/coin-balance.tsx       — Make clickable Link to /balance
components/layout/sidebar-nav.ts        — Add balance + admin nav items
```

## Verification

1. **Stripe Identity (Sandbox):** Create test verification → confirm webhook sets `identityVerified = true`
2. **Checkout Flow:** Select package → complete test payment → confirm coins granted via webhook
3. **Idempotency:** Send duplicate webhook → confirm no double-granting
4. **Invoice PDF:** Download invoice → verify all German Rechnung fields present
5. **Animation:** Complete purchase → confirm treasure chest plays with sound
6. **Admin Packages:** Create/edit/deactivate packages → verify Stripe Price sync
7. **Max Coins:** Attempt package > 1000 coins → verify rejection
8. **Auth Guards:** Unauthenticated/unverified user → verify cannot reach checkout
