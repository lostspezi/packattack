# Closed Beta System Design

## Context

PackAttack.gg is launching as a closed beta. Users can already register and log in, but only admin-activated beta testers should access the platform. All other users see a waiting page with closed beta info, social media links, and a promise of email notification when open beta begins. This requires migrating the existing single-role system to a multi-role system.

## Requirements

1. Users can have multiple roles simultaneously (multi-role)
2. Non-beta users see a dedicated waiting page after login (beta gate)
3. Beta testers receive a visible badge (profile, chat, waiting page)
4. Admins assign `beta_tester` role via existing admin user table
5. Admin can manually trigger email notification to all waiting users when open beta starts
6. Social media links (Discord, Instagram, TikTok, YouTube) on waiting page and footer

## Architecture

### Phase 1: Role Helper Library

**New file: `lib/roles.ts`**

Centralized role-checking functions to replace 196 raw string comparisons across 71 files.

```typescript
type UserRole = "user" | "shop" | "moderator" | "admin" | "super_admin" | "beta_tester";

function hasRole(roles: string[], role: string): boolean
function hasAnyRole(roles: string[], ...check: string[]): boolean
function isAdmin(roles: string[]): boolean          // admin | super_admin
function isSuperAdmin(roles: string[]): boolean     // super_admin only
function isStaff(roles: string[]): boolean          // moderator | admin | super_admin
function isShop(roles: string[]): boolean           // shop | admin | super_admin
function isBetaTester(roles: string[]): boolean     // beta_tester | admin | super_admin
```

Staff (admin/super_admin) implicitly pass the beta gate — they are never blocked.

### Phase 2: Schema & Auth Migration

**`models/user.ts`** — Change interface and schema:
- `role: string` → `roles: string[]` with default `["user"]`
- Add `"beta_tester"` to allowed values

**`lib/auth.ts`** — JWT + Session callbacks:
- Read `dbUser.roles` with fallback to `[dbUser.role ?? "user"]` for backward compat
- Session exposes `roles: string[]` instead of `role: string`
- Dual fallback: `token.roles ?? (token.role ? [token.role] : ["user"])`

**`types/next-auth.d.ts`** — Update type declarations for Session and JWT.

### Phase 3: Database Migration Script

**New file: `scripts/migrate-role-to-roles.ts`**

Sets `roles = [role || "user"]` for all users where `roles` field does not exist. Keeps old `role` field for rollback safety. Not a hard blocker due to auth fallbacks, but should run promptly.

### Phase 4: Permission Check Migration (~70 files)

Mechanical replacement across the codebase:

| Old Pattern | New Pattern |
|---|---|
| `role === "admin" \|\| role === "super_admin"` | `isAdmin(roles)` |
| `role === "super_admin"` | `isSuperAdmin(roles)` |
| `role === "admin" \|\| role === "super_admin" \|\| role === "moderator"` | `isStaff(roles)` |
| `["shop", "admin", "super_admin"].includes(role)` | `isShop(roles)` |

**Order**: API routes (security) → Layouts (access) → Components (UI) → Chat (complex/isolated)

**Chat backward compatibility**: Rendering handles both `authorSnapshot.role` (string, old) and `authorSnapshot.roles` (array, new).

### Phase 5: Admin Role Management

**`app/api/admin/users/[id]/role/route.ts`**:
- Accept `{ roles: string[] }` body
- Validate all roles against allowed list
- Ensure `"user"` always present
- Only `super_admin` can assign `admin`/`super_admin`
- Auto-manage beta badge: add to `badges` array when `beta_tester` added, remove when removed

Beta badge definition:
```typescript
{ key: "beta_tester", label: "Beta Tester", tone: "gold", sortOrder: -1, active: true }
```

**`components/admin/role-selector.tsx`**:
- Dropdown → checkbox group (multi-select)
- `"user"` checkbox always checked + disabled
- `"admin"` / `"super_admin"` disabled unless session user is super_admin
- On toggle: PATCH full roles array

**`components/admin/user-table.tsx`** + **`app/api/admin/users/route.ts`**:
- Display multiple role badges per user
- Filter by role uses MongoDB array-contains

### Phase 6: Beta Gate

**`app/[lang]/(dashboard)/layout.tsx`**:
After existing session check, add:
```typescript
const roles = session.user.roles ?? ["user"];
if (!isBetaTester(roles)) redirect(`/${lang}/waiting`);
```

**New file: `app/[lang]/(auth)/waiting/page.tsx`**:
Placed under `(auth)` route group to use centered auth layout and avoid dashboard's beta gate (no redirect loop).

Content:
- PackAttack.gg logo
- Closed beta heading + explanation text
- Beta tester badge SVG (`/badges/beta-tester.svg`)
- Social media icon links: Discord, Instagram, TikTok, YouTube
- "We'll notify you by email" info
- Logout button

### Phase 7: Footer Social Links

**`components/layout/footer.tsx`**:
Add social media icons (Discord, Instagram, TikTok, YouTube) as a new section alongside existing legal links. Icons as inline SVGs or lucide-react icons.

### Phase 8: Open Beta Email Notification

**New email template**: `open-beta-notification` slug with de/en variants, seeded via `seed/email-templates.ts`.

**New API: `app/api/admin/notifications/open-beta/route.ts`**:
- POST, admin-only
- Query users where `roles` does not contain `beta_tester`
- Send template email in batches (rate limiting for Resend)
- Return count of emails sent

**Admin UI**: Button in admin notifications section with confirmation modal.

### Phase 9: Assets

- `public/badges/beta-tester.svg` — User provides the SVG file

## Risk Mitigations

| Risk | Mitigation |
|---|---|
| Old JWT sessions lack `roles` | Dual fallback: `token.roles ?? [token.role]` |
| Pre-migration DB records | Auth reads `dbUser.roles ?? [dbUser.role]` |
| Old chat messages have `role` string | Render code handles both formats |
| Beta gate redirect loop | Waiting page under `(auth)` group, gate only in `(dashboard)` |
| Partial rollout | Migration script + fallbacks allow gradual deployment |

## Verification

1. **Multi-role**: Create user, assign multiple roles via admin panel, verify session contains roles array
2. **Beta gate**: Login as user without `beta_tester` → see waiting page. Add `beta_tester` via admin → see dashboard
3. **Badge**: Verify beta badge appears in profile and chat after role assignment
4. **Admin UI**: Test checkbox role-selector, verify "user" cannot be removed, admin/super_admin restricted
5. **Backward compat**: Test with old JWT token (simulate by not clearing cookies during migration)
6. **Footer**: Verify social links render on all pages
7. **Open beta email**: Trigger via admin, verify emails sent to correct users
