# PackAttack.gg Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete foundation layer for PackAttack.gg — auth, profiles, admin panel, notifications, design system, i18n — so the team can build features on top of it.

**Architecture:** Next.js 16 App Router with `[lang]` i18n segment, NextAuth v5 for authentication, MongoDB (Mongoose) for data, Redis for caching, DB-driven translations. `proxy.ts` handles auth guards and locale redirects. Admin panel for user/platform/translation/notification/email management.

**Tech Stack:** Next.js 16.2.1, TypeScript, Tailwind CSS v4, NextAuth v5, MongoDB 8 (Mongoose), Redis (ioredis), Nodemailer, Zod, bcryptjs, Lucide React

**Spec:** `docs/superpowers/specs/2026-03-25-foundation-design.md`

**IMPORTANT — Next.js 16 Breaking Changes:**
- `middleware.ts` is DEPRECATED — use `proxy.ts` with exported `proxy()` function instead
- Read `node_modules/next/dist/docs/` before implementing any Next.js feature
- `PageProps<'/[lang]'>` and `LayoutProps` are globally available TypeScript helpers
- `params` must be awaited: `const { lang } = await params`

---

## File Structure

```
packattackgg/
├── app/
│   ├── [lang]/
│   │   ├── layout.tsx                         # Root layout (theme, fonts, providers)
│   │   ├── (auth)/
│   │   │   ├── layout.tsx                     # Auth layout (centered, no nav)
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   ├── verify-email/page.tsx
│   │   │   ├── accept-terms/page.tsx
│   │   │   └── error/page.tsx
│   │   └── (dashboard)/
│   │       ├── layout.tsx                     # Dashboard layout (sidebar + header)
│   │       ├── page.tsx                       # Dashboard home
│   │       ├── profile/page.tsx
│   │       ├── settings/page.tsx
│   │       ├── account/page.tsx
│   │       └── admin/
│   │           ├── layout.tsx                 # Admin role guard
│   │           ├── page.tsx                   # Admin dashboard
│   │           ├── users/page.tsx
│   │           ├── platform/page.tsx
│   │           ├── notifications/page.tsx
│   │           ├── email-templates/page.tsx
│   │           └── translations/page.tsx
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts        # NextAuth handler
│   │   ├── notifications/route.ts             # GET notifications, POST mark read
│   │   ├── notifications/send/route.ts        # POST send notification (admin)
│   │   ├── admin/users/route.ts               # GET users list (admin)
│   │   ├── admin/users/[id]/role/route.ts     # PATCH change role (admin)
│   │   ├── admin/platform/route.ts            # GET/PATCH platform settings
│   │   ├── admin/translations/route.ts        # GET/POST/PATCH translations
│   │   ├── admin/email-templates/route.ts     # GET email templates
│   │   ├── admin/email-templates/[slug]/route.ts # GET/PATCH single template
│   │   ├── profile/route.ts                   # GET/PATCH current user profile
│   │   ├── account/route.ts                   # PATCH email/password, DELETE account
│   │   ├── account/link/route.ts              # POST/DELETE provider linking
│   │   ├── auth/verify-email/route.ts         # POST verify token
│   │   ├── auth/resend-verification/route.ts  # POST resend email
│   │   ├── auth/forgot-password/route.ts      # POST request reset
│   │   └── auth/reset-password/route.ts       # POST set new password
│   └── favicon.ico
├── components/
│   ├── ui/                                    # Design system primitives
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── checkbox.tsx
│   │   ├── toast.tsx
│   │   ├── dropdown.tsx
│   │   ├── modal.tsx
│   │   ├── pagination.tsx
│   │   └── data-table.tsx
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   ├── sidebar-nav.tsx
│   │   ├── header.tsx
│   │   ├── language-switcher.tsx
│   │   └── notification-bell.tsx
│   ├── auth/
│   │   ├── login-form.tsx
│   │   ├── register-form.tsx
│   │   ├── oauth-buttons.tsx
│   │   ├── verify-email-form.tsx
│   │   ├── accept-terms-form.tsx
│   │   ├── forgot-password-form.tsx
│   │   └── reset-password-form.tsx
│   ├── profile/
│   │   └── profile-form.tsx
│   ├── settings/
│   │   └── settings-form.tsx
│   ├── account/
│   │   ├── change-email-form.tsx
│   │   ├── change-password-form.tsx
│   │   ├── linked-providers.tsx
│   │   └── delete-account.tsx
│   ├── admin/
│   │   ├── admin-stats.tsx
│   │   ├── user-table.tsx
│   │   ├── role-selector.tsx
│   │   ├── platform-settings-form.tsx
│   │   ├── notification-sender.tsx
│   │   ├── notification-history.tsx
│   │   ├── email-template-editor.tsx
│   │   ├── email-template-preview.tsx
│   │   ├── translation-namespace-list.tsx
│   │   └── translation-key-editor.tsx
│   └── notifications/
│       ├── notification-dropdown.tsx
│       └── notification-item.tsx
├── lib/
│   ├── db.ts                                  # MongoDB connection (Mongoose)
│   ├── redis.ts                               # Redis connection (ioredis)
│   ├── auth.ts                                # NextAuth config
│   ├── auth-adapter.ts                        # Custom MongoDB adapter extensions
│   ├── mail.ts                                # Nodemailer transport + send helpers
│   ├── i18n.ts                                # getDictionary(), locale detection
│   ├── seed.ts                                # Database seed logic
│   ├── tokens.ts                              # Token generation/verification
│   └── validations.ts                         # Zod schemas
├── models/
│   ├── user.ts
│   ├── account.ts
│   ├── session.ts
│   ├── verification-token.ts
│   ├── platform-settings.ts
│   ├── notification.ts
│   ├── email-template.ts
│   ├── translation.ts
│   └── consent-log.ts
├── seed/
│   ├── translations.ts                        # All initial translation key/values
│   └── email-templates.ts                     # All initial email template content
├── proxy.ts                                   # Auth guard + locale redirect
├── docker-compose.dev.yml
├── .env.example
└── .gitignore (update: add .superpowers/)
```

---

## Phase 1: Infrastructure & Config

### Task 1: Docker Dev Environment

**Files:**
- Create: `docker-compose.dev.yml`
- Modify: `.gitignore`

- [ ] **Step 1: Create docker-compose.dev.yml**

```yaml
services:
  mongo:
    image: mongo:8
    ports: ["27017:27017"]
    volumes: [mongo_data:/data/db]
    environment:
      MONGO_INITDB_DATABASE: packattackgg

  redis:
    image: redis:7.4-alpine
    ports: ["6379:6379"]

  maildev:
    image: maildev/maildev:2.2.1
    ports:
      - "1080:1080"
      - "1025:1025"

volumes:
  mongo_data:
```

- [ ] **Step 2: Update .gitignore**

Add `.superpowers/` to `.gitignore` (brainstorm mockups directory).

- [ ] **Step 3: Verify Docker containers start**

Run: `docker compose -f docker-compose.dev.yml up -d`
Expected: All 3 containers running. Verify:
- `docker compose -f docker-compose.dev.yml ps` shows mongo, redis, maildev healthy
- `http://localhost:1080` opens MailDev UI

- [ ] **Step 4: Commit**

```bash
git add docker-compose.dev.yml .gitignore
git commit -m "feat: add Docker dev environment (mongo, redis, maildev)"
```

---

### Task 2: Install Dependencies & Environment Config

**Files:**
- Modify: `package.json`
- Create: `.env.example`
- Create: `.env.local` (not committed)

- [ ] **Step 1: Install production dependencies**

```bash
npm install next-auth@beta @auth/mongodb-adapter mongodb mongoose bcryptjs nodemailer ioredis zod negotiator @formatjs/intl-localematcher lucide-react
```

- [ ] **Step 2: Install dev dependencies**

```bash
npm install -D @types/bcryptjs @types/nodemailer @types/negotiator
```

- [ ] **Step 3: Create .env.example**

```env
# Database
MONGODB_URI=mongodb://localhost:27017/packattackgg

# Redis
REDIS_URL=redis://localhost:6379

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here

# OAuth Providers
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Email (MailDev in dev)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=noreply@packattack.gg

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 4: Create .env.local from example**

Copy `.env.example` to `.env.local`, set `NEXTAUTH_SECRET` to a generated value:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

- [ ] **Step 5: Verify Next.js dev server starts**

Run: `npm run dev`
Expected: Server starts on http://localhost:3000 without errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "feat: install dependencies and add env config"
```

---

### Task 3: Tailwind Design System Config

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Read current globals.css to understand Tailwind v4 setup**

Read: `app/globals.css`
Note: Tailwind v4 uses `@theme` directive for custom values, not `tailwind.config.ts`.

- [ ] **Step 2: Replace globals.css with design system theme**

Replace the entire file. Tailwind v4 uses CSS-based configuration with `@theme`:

```css
@import "tailwindcss";

@theme {
  /* Background */
  --color-bg: #12111A;
  --color-surface: #1A1924;
  --color-surface-elevated: #222131;
  --color-border: #2D2C3D;

  /* Brand */
  --color-pa-green: #9BFF00;
  --color-pa-green-hover: #85DD00;
  --color-pa-lila: #24043A;

  /* Text */
  --color-text-primary: #C8C8D0;
  --color-text-secondary: #8A8A96;
  --color-text-muted: #6B6B78;
  --color-text-disabled: #4A4A56;

  /* Semantic */
  --color-error: #EF4444;
  --color-error-light: #F87171;
  --color-success: #9BFF00;
  --color-warning: #F59E0B;
}

body {
  background-color: var(--color-bg);
  color: var(--color-text-primary);
}
```

- [ ] **Step 3: Verify Tailwind picks up custom colors**

Run: `npm run dev`
Verify the page background is `#12111A` (warm dark, not default white/black).

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat: configure Tailwind v4 design system theme"
```

---

## Phase 2: Database & Core Libraries

### Task 4: MongoDB Connection & Mongoose Models

**Files:**
- Create: `lib/db.ts`
- Create: `models/user.ts`
- Create: `models/account.ts`
- Create: `models/session.ts`
- Create: `models/verification-token.ts`
- Create: `models/platform-settings.ts`
- Create: `models/notification.ts`
- Create: `models/email-template.ts`
- Create: `models/translation.ts`
- Create: `models/consent-log.ts`

- [ ] **Step 1: Create MongoDB connection singleton**

Create `lib/db.ts`:

```typescript
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI environment variable is not defined");
}

let cached = global as typeof globalThis & {
  mongoose: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
};

if (!cached.mongoose) {
  cached.mongoose = { conn: null, promise: null };
}

export async function connectDB() {
  if (cached.mongoose.conn) return cached.mongoose.conn;

  if (!cached.mongoose.promise) {
    cached.mongoose.promise = mongoose.connect(MONGODB_URI);
  }

  cached.mongoose.conn = await cached.mongoose.promise;
  return cached.mongoose.conn;
}
```

- [ ] **Step 2: Create User model**

Create `models/user.ts`:

```typescript
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
  name: string;
  username: string;
  email: string;
  emailVerified: Date | null;
  password: string | null;
  image: string | null;
  role: "user" | "shop" | "moderator" | "admin" | "super_admin";
  bio: string | null;
  socialLinks: {
    discord?: string;
    twitch?: string;
    twitter?: string;
    youtube?: string;
  };
  preferences: {
    language: "de" | "en";
    theme: "dark" | "light";
    notifications: {
      email: boolean;
      browser: boolean;
    };
  };
  publicProfile: boolean;
  consents: {
    tos: { accepted: boolean; version: string; acceptedAt: Date };
    privacy: { accepted: boolean; version: string; acceptedAt: Date };
  };
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    emailVerified: { type: Date, default: null },
    password: { type: String, default: null },
    image: { type: String, default: null },
    role: {
      type: String,
      enum: ["user", "shop", "moderator", "admin", "super_admin"],
      default: "user",
    },
    bio: { type: String, default: null },
    socialLinks: {
      discord: String,
      twitch: String,
      twitter: String,
      youtube: String,
    },
    preferences: {
      language: { type: String, enum: ["de", "en"], default: "en" },
      theme: { type: String, enum: ["dark", "light"], default: "dark" },
      notifications: {
        email: { type: Boolean, default: true },
        browser: { type: Boolean, default: true },
      },
    },
    publicProfile: { type: Boolean, default: false },
    consents: {
      tos: {
        accepted: { type: Boolean, default: false },
        version: { type: String, default: "" },
        acceptedAt: { type: Date },
      },
      privacy: {
        accepted: { type: Boolean, default: false },
        version: { type: String, default: "" },
        acceptedAt: { type: Date },
      },
    },
  },
  { timestamps: true }
);

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", userSchema);
```

- [ ] **Step 3: Create remaining models**

Create each model following the same pattern. Keep them focused — one model per file:

**`models/account.ts`** and **`models/session.ts`** — These are NextAuth-managed via the `@auth/mongodb-adapter` using the native MongoDB driver. Only create Mongoose models if you need to query them directly in application code (e.g. for account linking display). Otherwise, skip and let the adapter handle them.

**`models/platform-settings.ts`** — `tosVersion`, `privacyVersion`, `updatedAt`, `updatedBy`. Singleton pattern (always query first doc).

**`models/notification.ts`** — `userId`, `title`, `message`, `type` (enum), `cta` (label + url, optional), `read` (boolean). Compound index on `userId` + `read`.

**`models/email-template.ts`** — `slug` (unique), `name`, `subject` ({de, en}), `body` ({de, en}), `variables` (string array), `updatedAt`, `updatedBy`.

**`models/translation.ts`** — `namespace`, `key`, `values` ({de, en}), `updatedAt`, `updatedBy`. Compound unique index on `namespace` + `key`.

**`models/consent-log.ts`** — `userId`, `type` (enum: tos/privacy), `version`, `action` (enum: accepted/revoked), `ip`, `userAgent`, `createdAt`. Index on `userId`.

**`models/verification-token.ts`** — `userId`, `token` (hashed), `type` (enum: email_verify/pwd_reset), `expires`. TTL index on `expires`.

- [ ] **Step 4: Verify models compile**

Run: `npx tsc --noEmit`
Expected: No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add lib/db.ts models/
git commit -m "feat: add MongoDB connection and all Mongoose models"
```

---

### Task 5: Redis Connection

**Files:**
- Create: `lib/redis.ts`

- [ ] **Step 1: Create Redis connection singleton**

```typescript
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let cached = global as typeof globalThis & {
  redis: Redis | null;
};

if (!cached.redis) {
  cached.redis = null;
}

export function getRedis(): Redis {
  if (!cached.redis) {
    cached.redis = new Redis(REDIS_URL);
  }
  return cached.redis;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/redis.ts
git commit -m "feat: add Redis connection singleton"
```

---

### Task 6: Email Service

**Files:**
- Create: `lib/mail.ts`

- [ ] **Step 1: Create Nodemailer transport and send helper**

```typescript
import nodemailer from "nodemailer";
import { connectDB } from "./db";
import { EmailTemplate } from "@/models/email-template";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
});

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || "");
}

export async function sendTemplateEmail(
  to: string,
  slug: string,
  lang: "de" | "en",
  variables: Record<string, string>
) {
  await connectDB();
  const template = await EmailTemplate.findOne({ slug });
  if (!template) throw new Error(`Email template "${slug}" not found`);

  const subject = interpolate(template.subject[lang], variables);
  const html = interpolate(template.body[lang], variables);

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/mail.ts
git commit -m "feat: add email service with template interpolation"
```

---

### Task 7: Token Utilities

**Files:**
- Create: `lib/tokens.ts`

- [ ] **Step 1: Create token generation and verification helpers**

```typescript
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { connectDB } from "./db";
import { VerificationToken } from "@/models/verification-token";

export async function generateVerificationToken(
  userId: string,
  type: "email_verify" | "pwd_reset"
) {
  await connectDB();
  const raw = crypto.randomBytes(32).toString("hex");
  const hashed = await bcrypt.hash(raw, 10);
  const expires = new Date(Date.now() + (type === "email_verify" ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000));

  // Remove any existing tokens of this type for this user
  await VerificationToken.deleteMany({ userId, type });

  await VerificationToken.create({ userId, token: hashed, type, expires });

  return raw;
}

export async function verifyToken(
  raw: string,
  type: "email_verify" | "pwd_reset"
) {
  await connectDB();
  const tokens = await VerificationToken.find({ type, expires: { $gt: new Date() } });

  for (const t of tokens) {
    if (await bcrypt.compare(raw, t.token)) {
      await VerificationToken.deleteOne({ _id: t._id });
      return t.userId.toString();
    }
  }

  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/tokens.ts
git commit -m "feat: add token generation and verification utilities"
```

---

### Task 8: Zod Validation Schemas

**Files:**
- Create: `lib/validations.ts`

- [ ] **Step 1: Create all validation schemas**

```typescript
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  name: z.string().min(2).max(50),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  acceptTos: z.literal(true),
  acceptPrivacy: z.literal(true),
});

export const profileSchema = z.object({
  name: z.string().min(2).max(50),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/),
  bio: z.string().max(500).nullable(),
  socialLinks: z.object({
    discord: z.string().max(100).optional(),
    twitch: z.string().max(100).optional(),
    twitter: z.string().max(100).optional(),
    youtube: z.string().max(200).optional(),
  }),
  publicProfile: z.boolean(),
});

export const settingsSchema = z.object({
  language: z.enum(["de", "en"]),
  theme: z.enum(["dark", "light"]),
  notifications: z.object({
    email: z.boolean(),
    browser: z.boolean(),
  }),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

export const changeEmailSchema = z.object({
  newEmail: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(100),
});
```

- [ ] **Step 2: Commit**

```bash
git add lib/validations.ts
git commit -m "feat: add Zod validation schemas"
```

---

### Task 9: i18n Library

**Files:**
- Create: `lib/i18n.ts`

- [ ] **Step 1: Create dictionary loader and locale detection**

```typescript
import { connectDB } from "./db";
import { Translation } from "@/models/translation";
import { getRedis } from "./redis";
import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";

export const locales = ["de", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export async function getDictionary(
  lang: Locale,
  namespace: string
): Promise<Record<string, string>> {
  const redis = getRedis();
  const cacheKey = `i18n:${lang}:${namespace}`;

  // Try Redis cache first
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // Fetch from DB
  await connectDB();
  const translations = await Translation.find({ namespace });

  const dict: Record<string, string> = {};
  for (const t of translations) {
    dict[t.key] = t.values[lang] || t.values[defaultLocale] || t.key;
  }

  // Cache for 5 minutes
  await redis.set(cacheKey, JSON.stringify(dict), "EX", 300);

  return dict;
}

export async function invalidateTranslationCache(namespace: string) {
  const redis = getRedis();
  for (const lang of locales) {
    await redis.del(`i18n:${lang}:${namespace}`);
  }
}

export function getLocaleFromHeaders(headers: Record<string, string | undefined>): Locale {
  try {
    const negotiator = new Negotiator({ headers });
    const languages = negotiator.languages();
    return match(languages, locales, defaultLocale) as Locale;
  } catch {
    return defaultLocale;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/i18n.ts
git commit -m "feat: add i18n library with DB-driven translations and Redis cache"
```

---

### Task 10: Database Seed

**Files:**
- Create: `lib/seed.ts`
- Create: `seed/translations.ts`
- Create: `seed/email-templates.ts`

- [ ] **Step 1: Create translation seed data**

Create `seed/translations.ts` with all initial translation key/value pairs, organized by namespace. This is a large file. Include namespaces:
- `auth.login` — title, email, password, submit, noAccount, register, forgotPassword, rememberMe, orContinueWith, withDiscord, withTwitch, withGoogle
- `auth.register` — title, name, username, email, password, submit, hasAccount, login, acceptTos, acceptPrivacy
- `auth.verifyEmail` — title, description, resend, resent
- `auth.acceptTerms` — title, description, acceptTos, acceptPrivacy, submit
- `auth.forgotPassword` — title, description, submit, backToLogin
- `auth.resetPassword` — title, newPassword, submit
- `dashboard` — title, welcome, comingSoon
- `profile` — title, name, username, bio, socialLinks, publicProfile, save
- `settings` — title, language, theme, notifications, emailNotifications, browserNotifications, save
- `account` — title, changeEmail, changePassword, linkedProviders, deleteAccount, dangerZone
- `admin` — dashboard, users, platform, notifications, emailTemplates, translations
- `common` — save, cancel, delete, loading, error, success, confirm, back, search, noResults, actions
- `notifications` — title, markAllRead, noNotifications, timeAgo

Each key has `de` and `en` values.

- [ ] **Step 2: Create email template seed data**

Create `seed/email-templates.ts` with the 4 initial templates (welcome, verify-email, password-reset, consent-update). Each has slug, name, subject (de/en), body as HTML (de/en), and variables array.

- [ ] **Step 3: Create seed runner**

Create `lib/seed.ts`:

```typescript
import { connectDB } from "./db";
import { User } from "@/models/user";
import { PlatformSettings } from "@/models/platform-settings";
import { Translation } from "@/models/translation";
import { EmailTemplate } from "@/models/email-template";
import bcrypt from "bcryptjs";
import { translationSeedData } from "@/seed/translations";
import { emailTemplateSeedData } from "@/seed/email-templates";

export async function runSeed() {
  await connectDB();

  const userCount = await User.countDocuments();
  if (userCount > 0) return; // Already seeded

  console.log("[seed] First start detected — seeding database...");

  // 1. Create super admin
  const hashedPassword = await bcrypt.hash("admin123", 12);
  await User.create({
    name: "Super Admin",
    username: "admin",
    email: "admin@packattack.gg",
    emailVerified: new Date(),
    password: hashedPassword,
    role: "super_admin",
    preferences: { language: "en", theme: "dark", notifications: { email: true, browser: true } },
    publicProfile: false,
    consents: {
      tos: { accepted: true, version: "1.0", acceptedAt: new Date() },
      privacy: { accepted: true, version: "1.0", acceptedAt: new Date() },
    },
  });

  // 2. Create platform settings
  await PlatformSettings.create({
    tosVersion: "1.0",
    privacyVersion: "1.0",
    updatedAt: new Date(),
  });

  // 3. Seed translations
  await Translation.insertMany(translationSeedData);

  // 4. Seed email templates
  await EmailTemplate.insertMany(emailTemplateSeedData);

  console.log("[seed] Database seeded successfully.");
}
```

- [ ] **Step 4: Integrate seed into DB connection**

Modify `lib/db.ts` — after connection is established, call `runSeed()`:

```typescript
import { runSeed } from "./seed";

// Add after the connection logic:
let seeded = false;
// Inside connectDB(), after connection:
if (!seeded) {
  seeded = true;
  runSeed().catch(console.error);
}
```

- [ ] **Step 5: Verify seed works**

Start Docker containers, run `npm run dev`, check MongoDB for seeded data:
```bash
docker exec -it $(docker ps -q -f ancestor=mongo:8) mongosh packattackgg --eval "db.users.find().pretty()"
```
Expected: One super_admin user, platform_settings, translations, email_templates populated.

- [ ] **Step 6: Commit**

```bash
git add lib/seed.ts lib/db.ts seed/
git commit -m "feat: add database seed (admin user, platform settings, translations, email templates)"
```

---

## Phase 3: Authentication

### Task 11: NextAuth Configuration

**Files:**
- Create: `lib/auth.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Read Next.js 16 auth docs**

Read: `node_modules/next/dist/docs/01-app/02-guides/authentication.md`
Note any breaking changes from the standard NextAuth setup.

- [ ] **Step 2: Create NextAuth config**

Create `lib/auth.ts` with:
- MongoDB adapter (`@auth/mongodb-adapter` — note: this needs the native `mongodb` client, not Mongoose)
- Credentials provider (email + password, bcrypt compare)
- Discord, Twitch, Google OAuth providers
- Session callback: inject `role`, `id`, `emailVerified`, `consents` into session
- JWT callback: inject same fields into JWT token
- signIn callback: handle auto-linking (same email = same account), handle first OAuth login (create user with defaults)
- Pages config: custom pages for signIn (`/[lang]/login`), error (`/[lang]/error`)

Key implementation detail: The `@auth/mongodb-adapter` uses the native `mongodb` client, not Mongoose. Create a separate MongoDB client instance in the auth config using the `mongodb` package directly. The Mongoose connection is used for application models.

- [ ] **Step 3: Create NextAuth API route handler**

Create `app/api/auth/[...nextauth]/route.ts`:

```typescript
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth";

const handler = NextAuth(authConfig);
export { handler as GET, handler as POST };
```

- [ ] **Step 4: Verify auth config compiles**

Run: `npx tsc --noEmit`
Expected: No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts app/api/auth/
git commit -m "feat: configure NextAuth v5 with Credentials + OAuth providers"
```

---

### Task 12: Proxy (Auth Guard + Locale Redirect)

**Files:**
- Create: `proxy.ts` (project root)

- [ ] **Step 1: Re-read proxy.ts docs for Next.js 16**

Read: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`
Key: exported function is `proxy()`, not `middleware()`.

- [ ] **Step 2: Implement proxy.ts**

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { locales, defaultLocale, getLocaleFromHeaders } from "@/lib/i18n";

const authRoutes = ["/login", "/register", "/verify-email", "/accept-terms", "/error", "/forgot-password", "/reset-password"];

function getLocaleFromPath(pathname: string): string | null {
  const segment = pathname.split("/")[1];
  return locales.includes(segment as any) ? segment : null;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes, static files, Next.js internals
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 1. Locale detection & redirect
  const locale = getLocaleFromPath(pathname);
  if (!locale) {
    // Detect from token preference or Accept-Language header
    const token = await getToken({ req: request });
    const preferredLang = token?.language as string | undefined;
    const detectedLocale = preferredLang || getLocaleFromHeaders({
      "accept-language": request.headers.get("accept-language") || "",
    });
    const url = request.nextUrl.clone();
    url.pathname = `/${detectedLocale}${pathname}`;
    return NextResponse.redirect(url);
  }

  // Path without locale prefix
  const pathWithoutLocale = pathname.replace(`/${locale}`, "") || "/";

  // 2. Auth routes — allow through
  if (authRoutes.some((route) => pathWithoutLocale.startsWith(route))) {
    return NextResponse.next();
  }

  // 3. Auth check
  const token = await getToken({ req: request });

  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    return NextResponse.redirect(url);
  }

  // 4. Email verification check
  if (!token.emailVerified) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/verify-email`;
    return NextResponse.redirect(url);
  }

  // 5. Consent check
  // JWT contains: userTosVersion, userPrivacyVersion, currentTosVersion, currentPrivacyVersion
  // These are set in the NextAuth jwt/session callbacks (lib/auth.ts)
  if (
    token.userTosVersion !== token.currentTosVersion ||
    token.userPrivacyVersion !== token.currentPrivacyVersion
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/accept-terms`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

Note for implementer: The consent check uses JWT tokens. In `lib/auth.ts`, the `jwt` callback must:
1. On sign-in: read user's `consents.tos.version` and `consents.privacy.version` -> store as `userTosVersion` / `userPrivacyVersion`
2. On every JWT refresh: fetch `platform_settings.tosVersion` / `privacyVersion` -> store as `currentTosVersion` / `currentPrivacyVersion`

When an admin updates the platform version, existing JWTs will have stale `currentTosVersion` until the next session refresh. This is acceptable since consent re-acceptance is not time-critical.

- [ ] **Step 3: Verify proxy works**

Run: `npm run dev`
- Navigate to `http://localhost:3000` -> should redirect to `/en/login` (or `/de/login` based on browser)
- Navigate to `http://localhost:3000/en/dashboard` -> should redirect to `/en/login` (not logged in)

- [ ] **Step 4: Commit**

```bash
git add proxy.ts
git commit -m "feat: add proxy.ts with auth guard and locale redirect"
```

---

## Phase 4: UI Components (Design System)

### Task 13: Core UI Components

**Files:**
- Create: `components/ui/button.tsx`
- Create: `components/ui/input.tsx`
- Create: `components/ui/card.tsx`
- Create: `components/ui/badge.tsx`
- Create: `components/ui/checkbox.tsx`
- Create: `components/ui/toast.tsx`
- Create: `components/ui/dropdown.tsx`
- Create: `components/ui/modal.tsx`
- Create: `components/ui/pagination.tsx`
- Create: `components/ui/data-table.tsx`

- [ ] **Step 1: Create Button component**

`components/ui/button.tsx` — Variants: primary, accent, secondary, danger, ghost. Props: variant, size, disabled, loading, className, children. Uses Tailwind classes from design system (PA-Green gradient for primary, etc.).

- [ ] **Step 2: Create Input component**

`components/ui/input.tsx` — Props: label, error, className, plus all standard input props. Focus state: PA-Green border + glow. Error state: red border + glow.

- [ ] **Step 3: Create Card component**

`components/ui/card.tsx` — Variants: soft, accent, topline, cut. Each applies different bg/border styles per design system.

- [ ] **Step 4: Create Badge component**

`components/ui/badge.tsx` — Role-specific variants: user, shop, moderator, admin, super_admin, online, verified, banned. Plus generic variants: success, warning, error, info.

- [ ] **Step 5: Create remaining UI components**

Create Checkbox, Toast, Dropdown, Modal, Pagination, DataTable components. Keep them minimal but styled per design system. DataTable takes columns config + data array, handles sorting/pagination.

- [ ] **Step 6: Verify all components compile**

Run: `npx tsc --noEmit`
Expected: No TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add components/ui/
git commit -m "feat: add design system UI components"
```

---

## Phase 5: Layouts & Auth Pages

### Task 14: Root & Auth Layouts

**Files:**
- Modify: `app/[lang]/layout.tsx`
- Create: `app/[lang]/(auth)/layout.tsx`

- [ ] **Step 1: Read Next.js 16 layout docs**

Read: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md`
Note: `LayoutProps` helper is globally available. `params` must be awaited.

- [ ] **Step 2: Create root layout**

Modify `app/[lang]/layout.tsx`:
- Accept `lang` from params (await it)
- Set `<html lang={lang}>` dynamically
- Apply Geist fonts (keep existing font setup)
- Apply `bg-bg text-text-primary` to body
- Wrap children in NextAuth SessionProvider

- [ ] **Step 3: Create auth layout**

Create `app/[lang]/(auth)/layout.tsx`:
- Centered layout: flex, items-center, justify-center, min-h-screen
- No sidebar, no header — just a centered container with max-width
- Logo at top (PACK in PA-Green, ATTACK in PA-Grey)

- [ ] **Step 4: Remove default page.tsx boilerplate**

Delete the default Next.js boilerplate from `app/[lang]/page.tsx` (or the root page) — replace with a redirect to `/[lang]/login` or `/[lang]/dashboard`.

- [ ] **Step 5: Verify layouts render**

Run: `npm run dev`
Navigate to `/en/login` — should see centered layout with dark background.

- [ ] **Step 6: Commit**

```bash
git add app/[lang]/layout.tsx app/[lang]/(auth)/
git commit -m "feat: add root layout and centered auth layout"
```

---

### Task 15: Login Page

**Files:**
- Create: `app/[lang]/(auth)/login/page.tsx`
- Create: `components/auth/login-form.tsx`
- Create: `components/auth/oauth-buttons.tsx`

- [ ] **Step 1: Create OAuth buttons component**

`components/auth/oauth-buttons.tsx` — Client component. Three buttons: Discord (indigo tint), Twitch (purple tint), Google (white tint). Each calls `signIn("discord")` etc. from `next-auth/react`. Discord is full-width, Twitch and Google are side-by-side below it. Styled per design system v4.

- [ ] **Step 2: Create login form component**

`components/auth/login-form.tsx` — Client component. Email + password inputs, "Remember me" checkbox, "Forgot password?" link, submit button. Uses `signIn("credentials")` from next-auth. Shows error messages. Includes "Register" link at bottom. Uses translations dict passed as prop.

- [ ] **Step 3: Create login page**

`app/[lang]/(auth)/login/page.tsx` — Server component. Loads `auth.login` dictionary. Renders LoginForm + OAuthButtons with divider ("oder" / "or"). Styled as a card centered on page.

- [ ] **Step 4: Verify login page renders**

Run: `npm run dev`
Navigate to `/en/login` — should see the login form matching design system v4 mockup.

- [ ] **Step 5: Commit**

```bash
git add app/[lang]/(auth)/login/ components/auth/login-form.tsx components/auth/oauth-buttons.tsx
git commit -m "feat: add login page with credentials and OAuth"
```

---

### Task 16: Register Page

**Files:**
- Create: `app/[lang]/(auth)/register/page.tsx`
- Create: `components/auth/register-form.tsx`

- [ ] **Step 1: Create register form component**

`components/auth/register-form.tsx` — Client component. Fields: Name, Username, Email, Password. Checkboxes: Accept TOS, Accept Privacy (with links). Submit button. Server Action: validate with `registerSchema`, hash password, create user, log consent, generate verification token, send verification email. Shows validation errors per field.

- [ ] **Step 2: Create register page**

`app/[lang]/(auth)/register/page.tsx` — Server component. Loads dictionaries. OAuth buttons at top (for OAuth registration), divider, then register form.

- [ ] **Step 3: Create register API/Server Action**

The register form submits to a Server Action in `app/[lang]/(auth)/register/actions.ts`:
- Validate input with Zod
- Check email and username uniqueness
- Hash password
- Create user with `role: "user"`, `emailVerified: null`
- Log consent to `consent_log`
- Generate verification token
- Send verification email using `verify-email` template
- Return success or error

- [ ] **Step 4: Verify registration flow**

Run: `npm run dev` + Docker containers
Register a new user -> should redirect to `/verify-email`. Check MailDev at `http://localhost:1080` for verification email.

- [ ] **Step 5: Commit**

```bash
git add app/[lang]/(auth)/register/ components/auth/register-form.tsx
git commit -m "feat: add register page with email verification"
```

---

### Task 17: Email Verification & Accept Terms Pages

**Files:**
- Create: `app/[lang]/(auth)/verify-email/page.tsx`
- Create: `components/auth/verify-email-form.tsx`
- Create: `app/api/auth/verify-email/route.ts`
- Create: `app/api/auth/resend-verification/route.ts`
- Create: `app/[lang]/(auth)/accept-terms/page.tsx`
- Create: `components/auth/accept-terms-form.tsx`

- [ ] **Step 1: Create verify-email API route**

`app/api/auth/verify-email/route.ts` — POST handler. Receives `{ token }`. Calls `verifyToken()`. If valid, update user's `emailVerified` to `Date.now()`. Return success/error JSON.

- [ ] **Step 2: Create resend-verification API route**

`app/api/auth/resend-verification/route.ts` — POST handler. Requires session. Generates new token for current user, sends verification email. Rate-limit: max 1 per minute (check last token creation time).

- [ ] **Step 3: Create verify-email page**

Shows "Check your email" message. If URL has `?token=xxx`, automatically submits verification. Has "Resend email" button. On success, redirects to dashboard (or accept-terms if consent missing).

- [ ] **Step 4: Create accept-terms page**

Shows current TOS and Privacy version numbers. Two checkboxes: Accept TOS, Accept Privacy. Submit button. Server Action: update `users.consents`, log to `consent_log` with IP and User-Agent. Redirect to dashboard.

- [ ] **Step 5: Verify the flows**

Test: Register -> verify email -> accept terms -> arrive at dashboard.

- [ ] **Step 6: Commit**

```bash
git add app/[lang]/(auth)/verify-email/ app/[lang]/(auth)/accept-terms/ app/api/auth/verify-email/ app/api/auth/resend-verification/ components/auth/
git commit -m "feat: add email verification and consent acceptance pages"
```

---

### Task 18: Forgot/Reset Password Pages

**Files:**
- Create: `app/[lang]/(auth)/forgot-password/page.tsx`
- Create: `app/[lang]/(auth)/reset-password/page.tsx`
- Create: `components/auth/forgot-password-form.tsx`
- Create: `components/auth/reset-password-form.tsx`
- Create: `app/api/auth/forgot-password/route.ts`
- Create: `app/api/auth/reset-password/route.ts`

- [ ] **Step 1: Create forgot-password API route**

POST handler. Receives `{ email }`. Finds user by email. If found and has password (credentials user), generates pwd_reset token, sends email. Always returns success (don't leak whether email exists).

- [ ] **Step 2: Create reset-password API route**

POST handler. Receives `{ token, password }`. Verifies token, hashes new password, updates user. Returns success/error.

- [ ] **Step 3: Create forgot-password form and page**

Simple form: email input + submit. Shows success message after submission. Link back to login.

- [ ] **Step 4: Create reset-password form and page**

Accessible via link in email (with token in URL). New password + confirm password inputs. Submit updates password and redirects to login.

- [ ] **Step 5: Verify flow**

Click "Forgot password" on login -> enter email -> check MailDev -> click link -> set new password -> login with new password.

- [ ] **Step 6: Commit**

```bash
git add app/[lang]/(auth)/ app/api/auth/ components/auth/
git commit -m "feat: add forgot/reset password flow"
```

---

### Task 19: Auth Error Page

**Files:**
- Create: `app/[lang]/(auth)/error/page.tsx`

- [ ] **Step 1: Create error page**

Shows error message based on `?error=` URL parameter. Common errors: OAuthSignin, OAuthCallback, OAuthAccountNotLinked, EmailSignin, CredentialsSignin. Displays user-friendly message per error type using translations. "Back to login" link.

- [ ] **Step 2: Commit**

```bash
git add app/[lang]/(auth)/error/
git commit -m "feat: add auth error page"
```

---

## Phase 6: Dashboard

### Task 20: Dashboard Layout (Sidebar + Header)

**Files:**
- Create: `app/[lang]/(dashboard)/layout.tsx`
- Create: `components/layout/sidebar.tsx`
- Create: `components/layout/sidebar-nav.tsx`
- Create: `components/layout/header.tsx`
- Create: `components/layout/language-switcher.tsx`
- Create: `components/layout/notification-bell.tsx`

- [ ] **Step 1: Create sidebar navigation config**

`components/layout/sidebar-nav.tsx` — Define navigation items as data: icon (from Lucide), label (translation key), href, optional `adminOnly` flag, optional `soon` flag. Main items: Dashboard, Profile, Settings, Account. Admin section: Admin Dashboard, Users, Platform, Notifications, Email Templates, Translations. "Soon" items: Packs, Marketplace.

- [ ] **Step 2: Create sidebar component**

`components/layout/sidebar.tsx` — Renders logo at top, main nav items, admin section (conditionally based on user role), "Coming soon" section, user info card at bottom (avatar, username, level). Styled per design system v4 sidebar mockup. Uses translations dict for labels.

- [ ] **Step 3: Create header component**

`components/layout/header.tsx` — Contains: page title (dynamic), language switcher (right side), notification bell (right side), user avatar dropdown.

- [ ] **Step 4: Create language switcher**

`components/layout/language-switcher.tsx` — Client component. Dropdown with DE/EN options. On change: update URL locale segment, save preference via API call if logged in.

- [ ] **Step 5: Create notification bell (placeholder)**

`components/layout/notification-bell.tsx` — Client component. Bell icon with unread count badge. Click opens notification dropdown (implemented in Task 24). For now, render bell icon with placeholder count.

- [ ] **Step 6: Create dashboard layout**

`app/[lang]/(dashboard)/layout.tsx` — Server component. Requires auth session (redirect if not logged in). Renders sidebar on left, header + main content on right. Loads relevant dictionaries. Passes session/dict to child components.

- [ ] **Step 7: Verify layout renders**

Login as admin -> should see full dashboard layout with sidebar, header, and empty main area.

- [ ] **Step 8: Commit**

```bash
git add app/[lang]/(dashboard)/layout.tsx components/layout/
git commit -m "feat: add dashboard layout with sidebar and header"
```

---

### Task 21: Dashboard Home Page

**Files:**
- Create: `app/[lang]/(dashboard)/page.tsx`

- [ ] **Step 1: Create dashboard home page**

Server component. Shows:
- Welcome message: "Welcome back, {username}"
- Stat cards (WIP placeholders): "Packs Opened" (0), "Collection Score" (0), "Collector Level" (LVL 1) — using topline, accent, and cut card variants
- "Coming Soon" teaser section with cards for Packs and Marketplace
- All text from translations

- [ ] **Step 2: Verify page renders**

Login -> should land on `/en/dashboard` with welcome message and placeholder stats.

- [ ] **Step 3: Commit**

```bash
git add app/[lang]/(dashboard)/page.tsx
git commit -m "feat: add WIP dashboard home page"
```

---

### Task 22: Profile Page

**Files:**
- Create: `app/[lang]/(dashboard)/profile/page.tsx`
- Create: `components/profile/profile-form.tsx`
- Create: `app/api/profile/route.ts`

- [ ] **Step 1: Create profile API route**

`app/api/profile/route.ts`:
- GET: Return current user profile data
- PATCH: Validate with `profileSchema`, update user, return updated data. Check username uniqueness if changed.

- [ ] **Step 2: Create profile form component**

`components/profile/profile-form.tsx` — Client component. Editable fields: Name, Username, Bio, Social Links (Discord, Twitch, Twitter, YouTube), Public Profile toggle. Shows role badge (read-only). Save button. Uses translations dict.

- [ ] **Step 3: Create profile page**

Server component. Loads profile data and dictionaries. Renders profile form in a card.

- [ ] **Step 4: Verify profile editing**

Edit profile fields -> save -> refresh -> changes persisted.

- [ ] **Step 5: Commit**

```bash
git add app/[lang]/(dashboard)/profile/ components/profile/ app/api/profile/
git commit -m "feat: add profile page with edit functionality"
```

---

### Task 23: Settings & Account Pages

**Files:**
- Create: `app/[lang]/(dashboard)/settings/page.tsx`
- Create: `components/settings/settings-form.tsx`
- Create: `app/[lang]/(dashboard)/account/page.tsx`
- Create: `components/account/change-email-form.tsx`
- Create: `components/account/change-password-form.tsx`
- Create: `components/account/linked-providers.tsx`
- Create: `components/account/delete-account.tsx`
- Create: `app/api/account/route.ts`
- Create: `app/api/account/link/route.ts`

- [ ] **Step 1: Create settings page**

Settings form with: Language selector (DE/EN), Theme selector (Dark/Light), Notification toggles (email, browser). Save button. Server action: validate with `settingsSchema`, update user preferences. Language change also redirects to new locale URL.

- [ ] **Step 2: Create account API routes**

`app/api/account/route.ts`:
- PATCH `{ type: "email", newEmail, password }` — verify current password, update email, set `emailVerified: null`, send verification
- PATCH `{ type: "password", currentPassword, newPassword }` — verify current password, hash new, update
- DELETE — confirm via request body `{ confirmText: "DELETE" }`, delete user and all related data (accounts, sessions, notifications). Keep consent_log (audit trail).

`app/api/account/link/route.ts`:
- POST — link new OAuth provider (handled by NextAuth)
- DELETE `{ provider }` — unlink provider, ensure at least one login method remains

- [ ] **Step 3: Create account page components**

- `change-email-form.tsx` — Current email (read-only), new email input, password confirmation
- `change-password-form.tsx` — Current password, new password, confirm new password. Only shown if user has a password (credentials user).
- `linked-providers.tsx` — Shows linked providers (Discord, Twitch, Google) with link/unlink buttons
- `delete-account.tsx` — Danger zone card. Type "DELETE" to confirm. Danger button.

- [ ] **Step 4: Create account page**

Server component. Sections: Change Email, Change Password (conditional), Linked Providers, Danger Zone. Each in its own card.

- [ ] **Step 5: Verify all settings/account functionality**

Test: change language, change theme, change password, link/unlink provider.

- [ ] **Step 6: Commit**

```bash
git add app/[lang]/(dashboard)/settings/ app/[lang]/(dashboard)/account/ components/settings/ components/account/ app/api/account/
git commit -m "feat: add settings and account management pages"
```

---

## Phase 7: Notification System

### Task 24: In-App Notifications

**Files:**
- Create: `app/api/notifications/route.ts`
- Create: `components/notifications/notification-dropdown.tsx`
- Create: `components/notifications/notification-item.tsx`
- Modify: `components/layout/notification-bell.tsx`

- [ ] **Step 1: Create notifications API route**

`app/api/notifications/route.ts`:
- GET `?page=1&limit=20` — Fetch user's notifications, newest first. Return with unread count.
- POST `{ action: "markRead", id }` — Mark single notification as read
- POST `{ action: "markAllRead" }` — Mark all user's notifications as read
- Invalidate Redis unread count cache on mutations.

- [ ] **Step 2: Create notification item component**

`components/notifications/notification-item.tsx` — Shows: type icon (color-coded), title, message, time ago, CTA button if present. Unread: subtle PA-Green left border. Click CTA navigates to `cta.url`.

- [ ] **Step 3: Create notification dropdown**

`components/notifications/notification-dropdown.tsx` — Client component. Fetches notifications on open. Shows list of NotificationItems. "Mark all as read" button at top. Empty state: "No notifications". Scrollable with max height.

- [ ] **Step 4: Update notification bell**

Update `components/layout/notification-bell.tsx` — Fetch unread count from API (or Redis-cached endpoint). Show count badge. Click toggles dropdown.

- [ ] **Step 5: Verify notifications display**

Manually insert a notification via mongosh, refresh dashboard, should appear in bell dropdown.

- [ ] **Step 6: Commit**

```bash
git add app/api/notifications/ components/notifications/ components/layout/notification-bell.tsx
git commit -m "feat: add in-app notification system with bell and dropdown"
```

---

## Phase 8: Admin Panel

### Task 25: Admin Layout & Dashboard

**Files:**
- Create: `app/[lang]/(dashboard)/admin/layout.tsx`
- Create: `app/[lang]/(dashboard)/admin/page.tsx`
- Create: `components/admin/admin-stats.tsx`

- [ ] **Step 1: Create admin layout with role guard**

`app/[lang]/(dashboard)/admin/layout.tsx` — Server component. Check session role: if not `admin` or `super_admin`, redirect to `/[lang]/dashboard`. Otherwise, render children.

- [ ] **Step 2: Create admin stats component**

`components/admin/admin-stats.tsx` — Server component. Queries: total users, new users (7 days), users by role, current TOS/Privacy versions. Renders as stat cards.

- [ ] **Step 3: Create admin dashboard page**

`app/[lang]/(dashboard)/admin/page.tsx` — Renders AdminStats + prepared slots for future metrics.

- [ ] **Step 4: Verify admin access**

Login as admin -> admin nav items visible in sidebar -> click Admin Dashboard -> see stats. Login as regular user -> admin nav items not visible, direct URL access redirects.

- [ ] **Step 5: Commit**

```bash
git add app/[lang]/(dashboard)/admin/layout.tsx app/[lang]/(dashboard)/admin/page.tsx components/admin/admin-stats.tsx
git commit -m "feat: add admin layout with role guard and dashboard"
```

---

### Task 26: User Management

**Files:**
- Create: `app/[lang]/(dashboard)/admin/users/page.tsx`
- Create: `components/admin/user-table.tsx`
- Create: `components/admin/role-selector.tsx`
- Create: `app/api/admin/users/route.ts`
- Create: `app/api/admin/users/[id]/role/route.ts`

- [ ] **Step 1: Create admin users API routes**

`app/api/admin/users/route.ts`:
- GET `?page=1&limit=20&search=&role=&verified=` — Paginated user list with filters. Requires admin role.

`app/api/admin/users/[id]/role/route.ts`:
- PATCH `{ role }` — Change user role. Requires admin role. Restrictions: only super_admin can promote to admin/super_admin. Cannot demote yourself.

- [ ] **Step 2: Create role selector component**

`components/admin/role-selector.tsx` — Dropdown showing all roles. Disabled options based on current user's role (non-super_admin can't select admin/super_admin). Calls API on change.

- [ ] **Step 3: Create user table component**

`components/admin/user-table.tsx` — Client component. Uses DataTable. Columns: Avatar, Username, Email, Role (with RoleSelector), Verified (badge), Registered (date). Search bar. Role/verified filters. Pagination.

- [ ] **Step 4: Create users admin page**

Server component. Renders UserTable.

- [ ] **Step 5: Verify user management**

As super_admin: search users, change roles, verify filters work.

- [ ] **Step 6: Commit**

```bash
git add app/[lang]/(dashboard)/admin/users/ components/admin/user-table.tsx components/admin/role-selector.tsx app/api/admin/users/
git commit -m "feat: add admin user management with role assignment"
```

---

### Task 27: Platform Settings

**Files:**
- Create: `app/[lang]/(dashboard)/admin/platform/page.tsx`
- Create: `components/admin/platform-settings-form.tsx`
- Create: `app/api/admin/platform/route.ts`

- [ ] **Step 1: Create platform settings API route**

`app/api/admin/platform/route.ts`:
- GET — Return current platform settings
- PATCH `{ tosVersion?, privacyVersion? }` — Update versions, set `updatedBy` to current user. Requires admin role.

- [ ] **Step 2: Create platform settings form**

Shows current TOS version, input for new version. Same for Privacy. Submit updates both. Shows consent acceptance stats (aggregate from consent_log: how many users on which version).

- [ ] **Step 3: Create platform page**

Server component. Renders PlatformSettingsForm.

- [ ] **Step 4: Verify**

Update TOS version -> login as regular user -> should be redirected to accept-terms.

- [ ] **Step 5: Commit**

```bash
git add app/[lang]/(dashboard)/admin/platform/ components/admin/platform-settings-form.tsx app/api/admin/platform/
git commit -m "feat: add admin platform settings (TOS/Privacy versions)"
```

---

### Task 28: Translation Management

**Files:**
- Create: `app/[lang]/(dashboard)/admin/translations/page.tsx`
- Create: `components/admin/translation-namespace-list.tsx`
- Create: `components/admin/translation-key-editor.tsx`
- Create: `app/api/admin/translations/route.ts`

- [ ] **Step 1: Create translations API route**

`app/api/admin/translations/route.ts`:
- GET `?namespace=` — Return all keys for a namespace. Without namespace: return all namespaces with key counts.
- POST `{ namespace, key, values: { de, en } }` — Create new translation key
- PATCH `{ namespace, key, values: { de, en } }` — Update existing key. Invalidate Redis cache for that namespace.

- [ ] **Step 2: Create namespace list component**

`components/admin/translation-namespace-list.tsx` — Left panel. Lists all namespaces with key counts. Click to select. "Add namespace" button. Search field that searches across all namespaces.

- [ ] **Step 3: Create key editor component**

`components/admin/translation-key-editor.tsx` — Right panel. Shows all keys for selected namespace. Each key: DE input + EN input side by side. Inline save per key. Highlight rows where DE or EN is empty. "Add key" button at bottom.

- [ ] **Step 4: Create translations page**

Two-column layout: namespace list (left, narrow) + key editor (right, wide).

- [ ] **Step 5: Verify**

Edit a translation key -> refresh page in other language -> should show updated text.

- [ ] **Step 6: Commit**

```bash
git add app/[lang]/(dashboard)/admin/translations/ components/admin/translation-namespace-list.tsx components/admin/translation-key-editor.tsx app/api/admin/translations/
git commit -m "feat: add admin translation management"
```

---

### Task 29: Notification Management

**Files:**
- Create: `app/[lang]/(dashboard)/admin/notifications/page.tsx`
- Create: `components/admin/notification-sender.tsx`
- Create: `components/admin/notification-history.tsx`
- Create: `app/api/notifications/send/route.ts`

- [ ] **Step 1: Create send notification API route**

`app/api/notifications/send/route.ts`:
- POST `{ recipient: { type: "user" | "role" | "all", value?: string }, title, message, type, cta? }` — Create notification(s). For "user": find by username/email. For "role": find all users with role. For "all": all users. Requires admin role. Returns created count.

- [ ] **Step 2: Create notification sender form**

`components/admin/notification-sender.tsx` — Form: Recipient type selector (single user, by role, all users), user search input (shown for single user), title, message, type dropdown, optional CTA (label + URL). Submit button.

- [ ] **Step 3: Create notification history**

`components/admin/notification-history.tsx` — List of recently sent notifications (last 50, distinct by title+createdAt). Shows: title, type, recipient count, timestamp.

- [ ] **Step 4: Create notifications admin page**

Two sections: Send Notification form (top), Sent History (bottom).

- [ ] **Step 5: Verify**

Send notification to all users -> check notification bell as regular user.

- [ ] **Step 6: Commit**

```bash
git add app/[lang]/(dashboard)/admin/notifications/ components/admin/notification-sender.tsx components/admin/notification-history.tsx app/api/notifications/send/
git commit -m "feat: add admin notification management"
```

---

### Task 30: Email Template Management

**Files:**
- Create: `app/[lang]/(dashboard)/admin/email-templates/page.tsx`
- Create: `components/admin/email-template-editor.tsx`
- Create: `components/admin/email-template-preview.tsx`
- Create: `app/api/admin/email-templates/route.ts`
- Create: `app/api/admin/email-templates/[slug]/route.ts`

- [ ] **Step 1: Create email template API routes**

`app/api/admin/email-templates/route.ts`:
- GET — Return all templates (slug, name, updatedAt)

`app/api/admin/email-templates/[slug]/route.ts`:
- GET — Return full template by slug
- PATCH `{ subject?, body?, name? }` — Update template. Requires admin role.

- [ ] **Step 2: Create email template editor**

`components/admin/email-template-editor.tsx` — Select template from list. Edit: name, subject (DE + EN inputs), body (DE + EN textareas for HTML). Show available variables as reference chips. Save button.

- [ ] **Step 3: Create email template preview**

`components/admin/email-template-preview.tsx` — Renders template HTML in an iframe with sample data. Toggle between DE/EN. Sample data uses dummy values for each variable.

- [ ] **Step 4: Create email templates admin page**

Template list on left, editor + preview on right.

- [ ] **Step 5: Verify**

Edit a template subject -> trigger that email (e.g. register) -> check MailDev -> should show updated subject.

- [ ] **Step 6: Commit**

```bash
git add app/[lang]/(dashboard)/admin/email-templates/ components/admin/email-template-editor.tsx components/admin/email-template-preview.tsx app/api/admin/email-templates/
git commit -m "feat: add admin email template management"
```

---

## Phase 9: Final Integration & Cleanup

### Task 31: End-to-End Verification

- [ ] **Step 1: Clean start test**

Stop Docker, delete volumes, restart:
```bash
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d
npm run dev
```
Verify seed creates admin user + platform settings + translations + email templates.

- [ ] **Step 2: Full auth flow test**

1. Go to `http://localhost:3000` -> redirects to `/en/login`
2. Click "Register" -> fill form -> submit -> redirected to verify-email
3. Check MailDev at `http://localhost:1080` -> click verification link
4. Redirected to accept-terms -> accept both -> arrive at dashboard
5. Logout -> login with credentials -> arrive at dashboard
6. Login with OAuth (if providers configured) -> verify auto-link

- [ ] **Step 3: Dashboard functionality test**

1. Edit profile -> save -> verify changes persist
2. Change language DE<->EN -> verify all text updates
3. Change settings -> save -> verify
4. Change password -> logout -> login with new password

- [ ] **Step 4: Admin panel test**

1. Login as admin (admin@packattack.gg / admin123)
2. Admin dashboard shows correct stats
3. User management: search, change role
4. Platform settings: update TOS version -> login as regular user -> prompted to re-accept
5. Translations: edit a key -> verify change appears in UI
6. Notifications: send notification -> verify it appears in bell
7. Email templates: edit template -> trigger email -> verify in MailDev

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes from end-to-end testing"
```

---

### Task 32: Documentation & .env.example Update

- [ ] **Step 1: Verify .env.example is complete**

Ensure all environment variables used in the code are documented in `.env.example`.

- [ ] **Step 2: Final commit**

```bash
git add .env.example
git commit -m "docs: finalize env configuration"
```
