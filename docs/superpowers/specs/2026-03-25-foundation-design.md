# PackAttack.gg — Foundation Design Spec

**Date:** 2026-03-25
**Status:** Draft
**Scope:** Auth system, user profiles, admin panel, design system, i18n, dev environment

## Overview

PackAttack.gg is a Pack-Opening / Collectible platform. This spec covers the foundational layer that all future features will build upon: authentication, authorization, user profiles, design system, internationalization, and local development infrastructure.

The goal is a working dev environment where users can register, log in, verify email, manage their profile, and navigate a WIP dashboard — ready for the team to build features on top of.

## Tech Stack

### Core
- **Next.js 16.2.1** — App Router, TypeScript, Tailwind CSS v4
- **MongoDB 8** — Primary database via Mongoose 8.13.1
- **NextAuth v5** (5.0.0-beta.25) — Authentication with MongoDB Adapter
- **Redis 7.4** — Caching via ioredis 5.6.0
- **MailDev 2.2.1** — Email testing in development
- **Nodemailer 6.10.0** — Email delivery

### Supporting
- **Zod 3.24.2** — Schema validation
- **bcryptjs 3.0.2** — Password hashing
- **Lucide React** — Icons
- **negotiator 1.0.0 + @formatjs/intl-localematcher 0.6.1** — Locale detection

### Explicitly Not Included
- No Prisma (Mongoose sufficient for MongoDB)
- No next-intl / react-i18next (DB-driven translations, no i18n framework needed)
- No shadcn/ui (Custom design system for gaming aesthetic)
- No zustand/redux (Server Components + Props sufficient)

## Project Structure

```
app/
├── [lang]/
│   ├── layout.tsx              # Root Layout (Dark Theme, Fonts, Providers)
│   ├── (auth)/
│   │   ├── layout.tsx          # Auth Layout (centered, minimal, no nav)
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── verify-email/page.tsx
│   │   ├── accept-terms/page.tsx
│   │   └── error/page.tsx
│   └── (dashboard)/
│       ├── layout.tsx          # Dashboard Layout (Sidebar + Header)
│       ├── page.tsx            # Dashboard Home / WIP
│       ├── profile/page.tsx
│       ├── settings/page.tsx
│       ├── account/page.tsx
│       └── admin/
│           ├── layout.tsx      # Admin Layout (role guard: admin, super_admin)
│           ├── page.tsx        # Admin Dashboard Overview
│           ├── users/page.tsx  # User list + role management
│           ├── platform/page.tsx # TOS/Privacy version management
│           ├── notifications/page.tsx # Send notifications to users
│           ├── email-templates/page.tsx # Manage email templates
│           └── translations/page.tsx # Manage i18n translations
├── api/
│   └── auth/[...nextauth]/route.ts
proxy.ts                        # Auth Guard + Locale Redirect
```

### Key Structural Decisions
- **Route Groups** `(auth)` and `(dashboard)` for separate layouts without URL impact
- **`[lang]`** as first URL segment for i18n (`/de/dashboard`, `/en/dashboard`)
- **API routes** outside `[lang]` — auth endpoints don't need locale
- **`proxy.ts`** (Next.js 16 convention, replaces deprecated `middleware.ts`)

## Data Models (MongoDB)

### users
```
_id: ObjectId
name: string
username: string (unique)
email: string (unique)
emailVerified: Date | null
password: string | null (hashed, null for OAuth-only users)
image: string | null (avatar URL)
role: "user" | "shop" | "moderator" | "admin" | "super_admin"
bio: string | null
socialLinks: {
  discord?: string
  twitch?: string
  twitter?: string
  youtube?: string
}
preferences: {
  language: "de" | "en"
  theme: "dark" | "light"
  notifications: {
    email: boolean
    browser: boolean
  }
}
publicProfile: boolean
consents: {
  tos: { accepted: boolean, version: string, acceptedAt: Date }
  privacy: { accepted: boolean, version: string, acceptedAt: Date }
}
createdAt: Date
updatedAt: Date
```
Indexes: `email` (unique), `username` (unique)

### accounts (NextAuth managed)
```
_id: ObjectId
userId: ObjectId -> users
type: "oauth" | "credentials"
provider: string
providerAccountId: string
access_token, refresh_token, etc.
```

### sessions (NextAuth managed)
```
_id: ObjectId
sessionToken: string
userId: ObjectId -> users
expires: Date
```

### verification_tokens
```
_id: ObjectId
userId: ObjectId -> users
token: string (hashed)
type: "email_verify" | "pwd_reset"
expires: Date
```

### platform_settings (Singleton document)
```
_id: ObjectId
tosVersion: string (e.g. "1.0")
privacyVersion: string (e.g. "1.0")
updatedAt: Date
updatedBy: ObjectId -> users
```
Only one document exists. Managed via Admin Panel instead of env vars.

### notifications
```
_id: ObjectId
userId: ObjectId -> users
title: string
message: string
type: "info" | "success" | "warning" | "error"
cta: {
  label: string (e.g. "Zum Event", "Profil ansehen")
  url: string (internal route, e.g. "/dashboard", "/profile/username")
} | null
read: boolean
createdAt: Date
```
Indexes: `userId` + `read` (compound), `createdAt` (for sorting/cleanup)

### email_templates
```
_id: ObjectId
slug: string (unique, e.g. "welcome", "verify-email", "password-reset", "consent-update")
name: string (display name for Admin Panel)
subject: { de: string, en: string }
body: { de: string, en: string }
variables: string[] (e.g. ["username", "verifyUrl", "appName"])
updatedAt: Date
updatedBy: ObjectId -> users
```
Indexes: `slug` (unique)

Templates use simple variable interpolation: `{{username}}`, `{{verifyUrl}}`, etc. Body is stored as HTML. Admin Panel provides a preview with sample data.

### translations
```
_id: ObjectId
namespace: string (e.g. "auth.login", "dashboard", "common")
key: string (e.g. "title", "submit", "save")
values: {
  de: string
  en: string
}
updatedAt: Date
updatedBy: ObjectId -> users | null (null = seeded)
```
Indexes: `namespace` + `key` (compound unique), `namespace` (for bulk loading)

Each document is one translation key. `getDictionary(lang, namespace)` loads all keys for a namespace and returns a flat object `{ key: value }`.

### consent_log (Append-only audit trail)
```
_id: ObjectId
userId: ObjectId -> users
type: "tos" | "privacy"
version: string (e.g. "1.0", "1.1")
action: "accepted" | "revoked"
ip: string
userAgent: string
createdAt: Date
```

## Authentication Flows

### Proxy Logic (`proxy.ts`)

Order of checks for every request:

1. Is it an API route or static asset? -> Pass through
2. Does the URL have a locale segment (`/de/`, `/en/`)? If not -> detect locale (user preference > Accept-Language header > fallback `en`) -> redirect
3. Is it an auth route (`/login`, `/register`, `/verify-email`, `/accept-terms`, `/error`)? -> Pass through
4. Is the user not logged in? -> Redirect to `/[lang]/login`
5. Is the user's email not verified (`emailVerified === null`)? -> Redirect to `/[lang]/verify-email`
6. Is the user's consent outdated (TOS or Privacy version mismatch)? -> Redirect to `/[lang]/accept-terms`
7. Pass through to dashboard

### Registration (Credentials)

1. User fills form: Email, Username, Password, TOS + Privacy checkboxes
2. Server Action: Validate with Zod, hash password (bcryptjs), create user with `role: "user"`, `emailVerified: null`, log consent to `consent_log`
3. Generate verification token, send email via Nodemailer (-> MailDev in dev)
4. Redirect to `/verify-email` — "Check your inbox"
5. User clicks link -> validate token -> set `emailVerified: Date` -> redirect to `/dashboard`

### Registration (OAuth — Discord/Twitch/Google)

1. User clicks "Login with Discord"
2. NextAuth OAuth flow -> provider returns email + profile data
3. `signIn` callback checks: Does a user with this email exist?
   - **No:** Create new user, accept `emailVerified` from provider if marked as verified
   - **Yes, same email:** Auto-link — account is linked to existing user
4. If provider email is verified -> pass through
5. If not verified -> trigger own email verification -> `/verify-email`
6. **Consent check:** First login -> redirect to `/accept-terms` (TOS + Privacy must be accepted)
7. Then -> `/dashboard`

### Login (Credentials)

1. Enter email + password
2. NextAuth `authorize` callback: user lookup, bcrypt compare
3. Check `emailVerified` -> if null -> `/verify-email`
4. Check consent version -> if outdated -> `/accept-terms`
5. Create session -> `/dashboard`

### Login (OAuth)

1. Provider flow -> account lookup
2. If account exists -> create session
3. If new email -> auto-link or new account (see above)
4. Same checks: email verified? Consent current? -> then dashboard

### Account Linking (Manual)

- In `/account` section, user can link additional providers
- Click "Link Discord" -> OAuth flow -> account linked to existing user
- Can also remove providers (as long as at least one login method remains)

### Password Reset

1. "Forgot password" on login page
2. Enter email -> generate token -> send mail
3. Click link -> set new password -> redirect to `/login`

## Consent Tracking

### How It Works
- Current TOS and Privacy versions stored in `platform_settings` collection (managed via Admin Panel)
- On registration: user must accept both (checkboxes), stored in `users.consents`, logged to `consent_log`
- On version change (admin updates version in Admin Panel): `proxy.ts` compares `users.consents.tos.version` with current `platform_settings.tosVersion` — mismatch -> redirect to `/accept-terms`
- Re-acceptance: user confirms new version, `users.consents` updated, new entry in `consent_log`
- `consent_log` is append-only, never deleted/modified — complete audit trail

## Role System

### Roles (Ordered by privilege)
1. **user** — Default role, standard platform access
2. **shop** — Can manage inventory (future feature)
3. **moderator** — Content moderation capabilities (future feature)
4. **admin** — Platform administration (future feature)
5. **super_admin** — Full system access (future feature)

### Assignment
- Default: `user` on registration
- Promotion: via admin panel or direct DB update (admin panel is a future feature)
- Role is stored on the user document and included in the NextAuth session via callback

## Internationalization (i18n)

### Approach
DB-driven translations. All translation strings stored in MongoDB, editable via Admin Panel. No static JSON files. Seed populates initial translations on first start.

### Data Model

See `translations` collection in Data Models section.

### Dictionary Format
Translations are organized by namespace (flat key within namespace):
```
namespace: "auth.login"
keys: {
  "title":    { de: "Willkommen zurück", en: "Welcome back" },
  "email":    { de: "Email", en: "Email" },
  "password": { de: "Passwort", en: "Password" },
  "submit":   { de: "Einloggen", en: "Log in" },
  ...
}
```

Namespaces group related keys: `auth.login`, `auth.register`, `auth.verifyEmail`, `auth.acceptTerms`, `dashboard`, `profile`, `settings`, `account`, `admin`, `common`, `notifications`.

### Loading
- `getDictionary(lang, namespace)` fetches from MongoDB
- Redis caches translations per language+namespace (invalidated when admin edits a key)
- Server Components call `getDictionary()`, pass result to Client Components as props

### Locale Detection (in `proxy.ts`)
1. URL already has `/de/` or `/en/`? -> Pass through
2. User logged in + `preferences.language` set? -> Redirect to saved language
3. Otherwise -> evaluate `Accept-Language` header -> fallback `en`

### Language Switcher
- Dropdown in dashboard header (DE/EN)
- Changes URL segment (`/de/dashboard` <-> `/en/dashboard`)
- Logged-in users: saves choice to `preferences.language`

### Usage in Components
Server Components receive `lang` via `params`, load dictionary from DB, pass to Client Components as props. No global state or context provider needed.

## Design System

### Color Palette — Warm Dark Theme

| Token | Hex | Usage |
|-------|-----|-------|
| Background | `#12111A` | Page background — warm dark with subtle purple undertone |
| Surface | `#1A1924` | Cards, sidebar, panels |
| Surface Elevated | `#222131` | Hover states, inputs, dropdowns |
| Border | `#2D2C3D` | Dividers, card borders |
| PA-Green (Primary) | `#9BFF00` | Buttons, links, accents, highlights |
| PA-Grey (Text Primary) | `#C8C8D0` | Headings, body text |
| Text Secondary | `#8A8A96` | Labels, descriptions |
| Text Muted | `#6B6B78` | Timestamps, captions |
| Text Disabled | `#4A4A56` | Disabled states |
| Lila Dunkel (Accent) | `#24043A` | Accent cards, gradient backgrounds, badges |
| Error / Danger | `#EF4444` / `#F87171` | Error states, destructive actions |
| PA-Green Muted | `#9BFF00` @ 6-15% opacity | Badge backgrounds, subtle highlights |

### Design Principles
- **No animations** — Static, calm, clean. Relaxed atmosphere that doesn't overwhelm.
- **Gaming aesthetic through structure** — Subtle cut-corner cards (clip-path), gradient XP bars, top-line accents, role badges
- **Warm darkness** — Purple-tinted darks instead of pure black. Inviting, not harsh.
- **Soft text colors** — `#C8C8D0` instead of pure white, softer on the eyes

### Card Variants
- **Soft Card** — `rgba(255,255,255,0.03)` bg, subtle border, rounded 14px
- **Accent Card** — Purple gradient tint, green border accent
- **Topline Card** — Soft card with 2px green top border
- **Cut Card** — Clip-path with cut corners (16px), gaming/sci-fi feel

### Button Variants
- **Primary** — PA-Green gradient, dark text, bold
- **Accent** — Lila gradient with green border hint
- **Secondary** — Transparent, subtle border
- **Danger** — Red-tinted background, red text/border
- **Ghost** — Text-only, PA-Green color

### Form Elements
- Inputs: Dark transparent bg, subtle border, 10px radius
- Focus state: PA-Green border + soft green outer glow (3px, 6% opacity)
- Error state: Red border + soft red outer glow
- Checkboxes: Green border/fill when checked

### Badges
- Role-specific styling (green for admin, purple for moderator, gradient for super admin)
- Status badges (Online, Verified, Banned)
- Level tags

### Notifications/Toasts
- Soft cards with colored left border (green for success, red for error)
- Icon + title + description layout

### Typography
- Font: Geist (already configured)
- Logo text: "PACK" in PA-Green, "ATTACK" in PA-Grey

## Docker Dev Environment

```yaml
# docker-compose.dev.yml
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
      - "1080:1080"   # Web UI
      - "1025:1025"   # SMTP

volumes:
  mongo_data:
```

### Access Points
- **MongoDB:** `mongodb://localhost:27017/packattackgg`
- **Redis:** `redis://localhost:6379`
- **MailDev Web UI:** `http://localhost:1080`
- **MailDev SMTP:** `smtp://localhost:1025`

### Dev Workflow
- `docker compose -f docker-compose.dev.yml up -d` starts infrastructure
- `npm run dev` runs Next.js locally (not containerized)
- All emails in development are caught by MailDev and viewable in browser

## Environment Variables (.env.local)

```
# Database
MONGODB_URI=mongodb://localhost:27017/packattackgg

# Redis
REDIS_URL=redis://localhost:6379

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<random-secret>

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

## Database Seed (First Start)

On first application start (when no users exist in the database), automatically create:

**Super Admin User:**
- email: `admin@packattack.gg`
- username: `admin`
- password: `admin123` (hashed with bcryptjs)
- role: `super_admin`
- emailVerified: `Date.now()` (pre-verified)
- consents: pre-accepted with current versions

**Platform Settings:**
- tosVersion: `"1.0"`
- privacyVersion: `"1.0"`

**Translations:**
All initial translation keys for both languages (DE/EN), organized by namespace:
- `auth.login`, `auth.register`, `auth.verifyEmail`, `auth.acceptTerms`
- `dashboard`, `profile`, `settings`, `account`
- `admin` (admin panel labels)
- `common` (shared: save, cancel, delete, loading, error, etc.)
- `notifications` (notification-related labels)

**Email Templates:**
- `welcome` — Welcome email (subject + body in DE/EN, variables: `username`, `loginUrl`)
- `verify-email` — Verification link (variables: `username`, `verifyUrl`)
- `password-reset` — Reset link (variables: `username`, `resetUrl`)
- `consent-update` — TOS/Privacy updated (variables: `username`, `acceptUrl`, `type`)

The seed runs as part of the DB connection initialization — checks if the `users` collection is empty, seeds if so. Only runs once.

## Admin Panel

### Access Control
- Route group: `/[lang]/admin/`
- Protected by `admin/layout.tsx` — checks session role, only `admin` and `super_admin` can access
- Non-admin users get redirected to `/dashboard`
- Admin nav items only visible in sidebar for users with admin/super_admin role

### Navigation (Sidebar Extension)
The admin panel extends the existing dashboard sidebar with an "Administration" section (only visible for admins). Designed to be easily extensible with new admin pages:

```
Sidebar:
  ── Hauptmenü ──
  Dashboard
  Profil
  Einstellungen
  Account
  ── Administration ──     (only for admin/super_admin)
  Admin Dashboard
  Benutzer
  Plattform
  Benachrichtigungen
  Email Templates
  Übersetzungen
  [future admin pages easily added here]
```

### Admin Dashboard (`/[lang]/admin`)
- Overview page with key metrics
- Total users count, new registrations (last 7 days)
- Users by role breakdown
- Current TOS/Privacy versions at a glance
- Prepared for future metrics (packs opened, active users, etc.)

### User Management (`/[lang]/admin/users`)
- Paginated user list with search (by username, email)
- Columns: Avatar, Username, Email, Role, Verified, Registered date
- Actions per user:
  - **Change role** — dropdown to assign any role (user, shop, moderator, admin, super_admin)
  - Role changes restricted: only `super_admin` can promote to `admin` or `super_admin`
  - Cannot demote yourself
- Filter by role, verified status

### Platform Settings (`/[lang]/admin/platform`)
- **TOS Version** — current version display, input to set new version (e.g. "1.0" -> "1.1")
- **Privacy Version** — same as above
- When a version is updated: all users with the old version will be prompted to re-accept on next visit (enforced by `proxy.ts`)
- Change history log (reads from `consent_log` aggregate: how many users accepted which version)

### Translation Management (`/[lang]/admin/translations`)
- **Namespace browser** — left panel lists all namespaces (auth.login, auth.register, dashboard, common, etc.)
- **Key editor** — select namespace, see all keys with DE and EN values side by side
- **Edit inline** — click to edit any value, save per key
- **Add key** — add new translation key to a namespace
- **Add namespace** — create new namespace (for future features)
- **Search** — search across all namespaces and keys
- **Missing translations** — highlight keys where DE or EN value is empty
- Saving invalidates the Redis cache for the affected namespace

### Notification Management (`/[lang]/admin/notifications`)
- **Send notification** form:
  - Recipient: Single user (search by username/email), all users, users by role
  - Title, Message, Type (info/success/warning/error)
  - CTA: Optional label + URL (internal route)
  - Language: Notification content is sent as-is (admin writes in desired language)
- **Sent history** — list of recently sent notifications with recipient count
- Future: scheduled notifications, notification templates

### Email Template Management (`/[lang]/admin/email-templates`)
- List of all templates with slug, name, last updated
- Edit template:
  - Subject (DE + EN fields)
  - Body as HTML (DE + EN fields)
  - Available variables shown as reference (e.g. `{{username}}`, `{{verifyUrl}}`)
  - Live preview with sample data, toggleable between DE/EN
- **Seeded templates** (created on first start):
  - `welcome` — Welcome email after registration
  - `verify-email` — Email verification link
  - `password-reset` — Password reset link
  - `consent-update` — Notification that TOS/Privacy was updated

## In-App Notification System

### User-Facing
- **Notification bell** in the dashboard header with unread count badge
- **Dropdown** on click: list of recent notifications, newest first
- Each notification shows: icon (by type), title, message, time ago, CTA button if present
- Click CTA -> navigate to the linked internal route
- "Mark all as read" action
- Unread notifications have a subtle PA-Green left border (consistent with toast design)

### Technical
- Notifications are stored in MongoDB (`notifications` collection)
- Created via: Admin Panel (manual), or programmatically (e.g. system events like consent update, future: pack opened, trade received)
- API routes for: fetch user notifications (paginated), mark as read, mark all as read
- Notification preferences respected: if user has `preferences.notifications.email: true`, important notifications also trigger an email using the appropriate email template
- Redis used for caching unread count per user (invalidated on new notification / mark as read)

### Extensibility
The notification system is designed to be used by future features:
- Any feature can create a notification by inserting into the `notifications` collection with userId, title, message, type, and optional CTA
- The CTA URL pattern makes it easy to link to any future page (packs, trades, marketplace, etc.)

### Extensibility (Admin Panel)
The admin panel structure is designed for easy extension:
- New admin pages: add a folder under `app/[lang]/(dashboard)/admin/`
- New sidebar items: add entry to the admin navigation config
- Role-based visibility: layout already handles auth check, new pages inherit protection

## Dashboard Pages

### Dashboard Home (`/[lang]/dashboard`)
- WIP placeholder with stat cards (prepared for future pack/collection data)
- Welcome message with username
- "Coming soon" teasers for future features

### Profile (`/[lang]/profile`)
- View/edit: Username, Name, Avatar, Bio, Social Links (Discord, Twitch, Twitter, YouTube)
- Toggle: Public profile visibility
- Display: Role badge, Level/XP (prepared for future gamification)

### Settings (`/[lang]/settings`)
- Language preference (DE/EN)
- Theme preference (Dark/Light — dark default, light as future option)
- Notification preferences (email, browser)

### Account (`/[lang]/account`)
- Change email (requires re-verification)
- Change password (only if credentials-registered)
- Linked providers (link/unlink Discord, Twitch, Google)
- Delete account (danger zone, confirmation required)

## Out of Scope (Future Features)
- Pack opening mechanics
- Collectible/card system
- Marketplace
- Shop inventory management
- Moderation tools
- Real payment/billing
- Production deployment / CI/CD
