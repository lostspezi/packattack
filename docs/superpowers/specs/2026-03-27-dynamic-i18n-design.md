# Dynamic i18n System — German-First with Admin Language Management

## Context

The current i18n system has hardcoded `de` and `en` locales throughout the codebase. We want to start with German-only and allow adding more languages later via admin. The language switcher should only appear when 2+ languages are active.

## Architecture

### Language Model (`models/language.ts`)

New MongoDB collection:

```ts
{
  code: string        // unique, lowercase, e.g. "de"
  name: string        // e.g. "Deutsch"
  isDefault: boolean  // exactly one must be true
  isActive: boolean   // only active languages are served
  createdAt: Date
}
```

Seed: `{ code: "de", name: "Deutsch", isDefault: true, isActive: true }`

### Translation Model Change (`models/translation.ts`)

`values` changes from `{ de: string; en: string }` to `Map<string, string>`:

```ts
// Before
values: { de: { type: String, required: true }, en: { type: String, required: true } }

// After
values: { type: Map, of: String, default: new Map() }
```

Mongoose `Map` serializes as a plain object in MongoDB — reads via `.lean()` return `{ de: "..." }` as expected. `doc.values[lang]` or `doc.values.get(lang)` both work.

### i18n Core (`lib/i18n.ts`)

**Removed:** Hardcoded `locales`, `defaultLocale`, `Locale` union type.

**Added:**
- `getActiveLocales(): Promise<string[]>` — fetches from Language collection, cached in Redis (`i18n:active-locales`, 5min TTL)
- `getDefaultLocale(): Promise<string>` — fetches default language code, cached in Redis (`i18n:default-locale`, 5min TTL)
- `invalidateLanguageCache()` — clears both Redis keys above
- `type Locale = string` — alias kept for minimal diff across 24+ files

**Changed:**
- `getDictionary(lang: string, namespace: string)` — signature unchanged, works with dynamic locales
- `invalidateTranslationCache(namespace)` — uses `redis.keys("i18n:*:{namespace}")` pattern scan instead of iterating hardcoded array
- `getLocaleFromHeaders` — uses dynamic `getActiveLocales()` and `getDefaultLocale()`

### Language Switcher (`components/layout/language-switcher.tsx`)

**New interface:**
```ts
interface LanguageSwitcherProps {
  lang: string;
  languages: { code: string; name: string }[];
}
```

- Returns `null` if `languages.length < 2`
- Renders dynamic buttons for all active languages
- Parent layouts (auth, dashboard) fetch active languages and pass them down

### Locale Validation

**`app/[lang]/layout.tsx`:** Checks if `lang` is in active locales. If not, redirects to `/{defaultLocale}/dashboard`.

**`app/page.tsx` (new):** Redirects `/` to `/{defaultLocale}/dashboard`.

No middleware needed — validation happens at layout level (avoids Edge runtime constraints with MongoDB/Redis).

### Admin Language Management

**API:** `app/api/admin/languages/route.ts`
- `GET` — list all languages
- `POST` — add language (code + name). Adds empty values for new lang code to all translation docs: `Translation.updateMany({}, { $set: { "values.{code}": "" } })`
- `PATCH` — update language (activate/deactivate, set default). Uses `findOneAndUpdate` to atomically swap default.
- `DELETE` — remove language. Removes lang key from all translation docs. Cannot delete default language.

**Page:** `app/[lang]/(dashboard)/admin/languages/page.tsx`
**Component:** `components/admin/language-manager.tsx`

Features:
- Table with code, name, isActive toggle, isDefault indicator
- "Add Language" form
- Activate/deactivate and "Set as Default" actions
- Invalidates language cache on every change

### Translation Editor Changes (`components/admin/translation-key-editor.tsx`)

- Fetches active languages on mount
- Renders one column per active language (dynamic, not hardcoded DE/EN)
- `updateLocalKey(id, lang: string, value)` — generalized from `"de" | "en"`
- Missing value indicator per language column

### Translation API Changes (`app/api/admin/translations/route.ts`)

PATCH handler: `values` type changes from `{ de?: string; en?: string }` to `Record<string, string>`. Iterates over object keys dynamically:
```ts
for (const [lang, val] of Object.entries(values)) {
  update[`values.${lang}`] = val;
}
```

### Footer (`components/layout/footer.tsx`)

Moves from hardcoded `de`/`en` objects to the translation system. New namespace `footer` with keys like `link_terms`, `link_tos`, `link_privacy`, `link_imprint`. Parent layout passes `footerDict` down.

### Seed Data Changes

**`seed/translations.ts`:** Remove all `en: "..."` values. Only German remains.

**`lib/seed.ts`:**
- New `syncLanguages()` — seeds Language collection with German
- New `migrateTranslationValues()` — removes `en` field from existing docs
- Admin user `preferences.language` changes from `"en"` to `"de"`

### Settings (`components/settings/settings-form.tsx`)

Language preference dropdown shows only active languages (fetched from API) instead of hardcoded DE/EN options.

## Files to Modify/Create

| File | Action |
|------|--------|
| `models/language.ts` | CREATE |
| `models/translation.ts` | MODIFY — Map schema |
| `lib/i18n.ts` | MODIFY — dynamic locales |
| `lib/seed.ts` | MODIFY — language seed + migration |
| `seed/translations.ts` | MODIFY — remove English |
| `components/layout/language-switcher.tsx` | MODIFY — dynamic + conditional |
| `components/layout/user-header.tsx` | MODIFY — pass languages prop |
| `components/layout/footer.tsx` | MODIFY — use translation system |
| `app/[lang]/layout.tsx` | MODIFY — locale validation, footer dict |
| `app/page.tsx` | CREATE — root redirect |
| `app/[lang]/(auth)/layout.tsx` | MODIFY — fetch & pass languages |
| `app/[lang]/(dashboard)/layout.tsx` | MODIFY — fetch & pass languages |
| `app/api/admin/languages/route.ts` | CREATE — CRUD API |
| `app/[lang]/(dashboard)/admin/languages/page.tsx` | CREATE — admin page |
| `components/admin/language-manager.tsx` | CREATE — UI component |
| `components/admin/translation-key-editor.tsx` | MODIFY — dynamic columns |
| `app/api/admin/translations/route.ts` | MODIFY — dynamic values |
| `components/layout/sidebar-nav.tsx` | MODIFY — add languages link |
| `components/settings/settings-form.tsx` | MODIFY — dynamic language options |

## Verification

1. Start app — only German available, no language switcher visible
2. Visit `/` — redirects to `/de/dashboard`
3. Visit `/en/dashboard` — redirects to `/de/dashboard` (en not active)
4. Admin: Add English language — switcher appears site-wide
5. Admin: Translation editor shows DE + EN columns, EN values empty
6. Admin: Fill EN values, switch to English — translations load correctly
7. Admin: Deactivate English — switcher disappears, EN URLs redirect to DE
8. Settings: Language dropdown shows only active languages
