# Remove Bulk Conversion System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the entire bulk conversion bonus system, leaving only 1:1 card-to-coin conversion and cart claiming.

**Architecture:** Delete the bulk-convert API endpoint, remove bulk constants, strip all bulk-related UI/state from the pack-opening component, and clean up the CoinTransaction type enum.

**Tech Stack:** Next.js, React, TypeScript, Mongoose

---

### Task 1: Delete bulk-convert API endpoint

**Files:**
- Delete: `app/api/pulls/bulk-convert/route.ts`

- [ ] **Step 1: Delete the file**

```bash
rm app/api/pulls/bulk-convert/route.ts
```

- [ ] **Step 2: Verify no other code imports from this file**

```bash
grep -r "bulk-convert" --include="*.ts" --include="*.tsx" app/ components/ lib/
```

Expected: Only the pack-opening.tsx fetch call (handled in Task 3). No direct imports.

- [ ] **Step 3: Commit**

```bash
git add app/api/pulls/bulk-convert/route.ts
git commit -m "refactor: delete bulk-convert API endpoint"
```

---

### Task 2: Remove bulk constants

**Files:**
- Modify: `lib/pack-constants.ts`

- [ ] **Step 1: Replace the entire file contents**

The file currently exports only bulk-related constants. Replace with an empty file (or delete if no other constants exist):

```typescript
// Pack-related constants
// (Bulk conversion constants removed — 2026-03-29)
```

Actually, since all 4 exports are bulk-related, delete the file entirely:

```bash
rm lib/pack-constants.ts
```

- [ ] **Step 2: Verify no remaining imports**

```bash
grep -r "pack-constants" --include="*.ts" --include="*.tsx" app/ components/ lib/
```

Expected: Only `components/packs/pack-opening.tsx` (handled in Task 3).

- [ ] **Step 3: Commit**

```bash
git add lib/pack-constants.ts
git commit -m "refactor: remove bulk conversion constants"
```

---

### Task 3: Strip bulk logic from pack-opening component

**Files:**
- Modify: `components/packs/pack-opening.tsx`

- [ ] **Step 1: Remove the bulk constants import (line 8-13)**

Remove this entire import block:

```typescript
import {
  BULK_COIN_THRESHOLD,
  BULK_CONVERSION_BONUS,
  MIN_PACKS_FOR_BULK_OFFER,
  MIN_BULK_CARDS_FOR_OFFER,
} from "@/lib/pack-constants";
```

Also remove the `Sparkles` import from lucide-react (line 3) since it's only used in bulk UI. The import becomes:

```typescript
import { ShoppingCart, Coins, ArrowRight, RotateCcw } from "lucide-react";
```

- [ ] **Step 2: Remove bulk state variables (lines 76-78)**

Remove these three lines:

```typescript
  const [bulkDismissed, setBulkDismissed] = useState(false);
  const [bulkConverted, setBulkConverted] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
```

- [ ] **Step 3: Remove bulk computed values (lines 92-102)**

Remove this entire block:

```typescript
  // Bulk conversion computed values (exclude already-recovered cards)
  const bulkIndices = new Set(
    cards.map((c, i) => (c.coinValue < BULK_COIN_THRESHOLD && !recoveredIndices.has(i) ? i : -1)).filter((i) => i >= 0)
  );
  const bulkCards = cards.filter((c, i) => c.coinValue < BULK_COIN_THRESHOLD && !recoveredIndices.has(i));
  const isBulkEligible =
    result.packCount >= MIN_PACKS_FOR_BULK_OFFER &&
    bulkCards.length >= MIN_BULK_CARDS_FOR_OFFER;
  const bulkTotalBase = bulkCards.reduce((sum, c) => sum + c.conversionValue, 0);
  const bulkTotalWithBonus = Math.floor(bulkTotalBase * (1 + BULK_CONVERSION_BONUS));
  const bulkBonusAmount = bulkTotalWithBonus - bulkTotalBase;
```

- [ ] **Step 4: Simplify `allDecided` check (line 118-124)**

Replace:

```typescript
  const allDecided = cards.every(
    (_, i) =>
      recoveredIndices.has(i) ||
      (bulkConverted && bulkIndices.has(i)) ||
      choices.get(i) === "claim" ||
      choices.get(i) === "convert"
  );
```

With:

```typescript
  const allDecided = cards.every(
    (_, i) =>
      recoveredIndices.has(i) ||
      choices.get(i) === "claim" ||
      choices.get(i) === "convert"
  );
```

- [ ] **Step 5: Simplify `coinsBack` calculation (lines 127-130)**

Replace:

```typescript
  const coinsBack = cards.reduce((sum, c, i) => {
    if (bulkConverted && bulkIndices.has(i)) return sum;
    return choices.get(i) === "convert" ? sum + c.conversionValue : sum;
  }, 0);
```

With:

```typescript
  const coinsBack = cards.reduce(
    (sum, c, i) => (choices.get(i) === "convert" ? sum + c.conversionValue : sum),
    0
  );
```

- [ ] **Step 6: Delete the entire `handleBulkConvert` function (lines 132-201)**

Remove the entire `async function handleBulkConvert()` block.

- [ ] **Step 7: Simplify `handleConfirm` — remove bulk skip logic (lines 208-209)**

Replace:

```typescript
        if (recoveredIndices.has(i)) continue;
        if (bulkConverted && bulkIndices.has(i)) continue;
```

With:

```typescript
        if (recoveredIndices.has(i)) continue;
```

- [ ] **Step 8: Remove bulk conversion banner from review phase UI (lines 283-339)**

Delete the entire `{/* Bulk conversion banner */}` section — the `{isBulkEligible && !bulkConverted && !bulkDismissed && (` block.

- [ ] **Step 9: Remove bulk conversion success indicator (lines 341-351)**

Delete the entire `{/* Bulk conversion success indicator */}` section — the `{bulkConverted && (` block.

- [ ] **Step 10: Simplify card list item rendering**

In the card list `.map()`, remove all bulk-related rendering. The `isBulk`, `isBulkDone`, and `bonusValue` variables and their conditional rendering need to go.

Replace the variables at the top of the map callback:

```typescript
            const choice = choices.get(i);
            const isBulk = bulkIndices.has(i);
            const isBulkDone = bulkConverted && isBulk;
            const isRecovered = recoveredIndices.has(i);
            const bonusValue = isBulk
              ? Math.floor(c.conversionValue * (1 + BULK_CONVERSION_BONUS))
              : c.conversionValue;
```

With:

```typescript
            const choice = choices.get(i);
            const isRecovered = recoveredIndices.has(i);
```

Replace the className conditional:

```typescript
                  isBulkDone
                    ? "border-pa-green/20 bg-pa-green/5"
                    : isRecovered
                      ? "border-white/8 bg-white/3 opacity-70"
                      : "border-border bg-surface",
```

With:

```typescript
                  isRecovered
                    ? "border-white/8 bg-white/3 opacity-70"
                    : "border-border bg-surface",
```

Replace the decision toggle section — remove the `isBulkDone` branch entirely. The ternary `{isBulkDone ? (...) : isRecovered ? (...) : (...)}` becomes just `{isRecovered ? (...) : (...)}`:

Remove:

```typescript
                {isBulkDone ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-pa-green/15 px-2.5 py-1.5 text-xs font-medium text-pa-green">
                      <Coins className="h-3.5 w-3.5" />
                      {bonusValue}
                      <span className="text-[10px] opacity-70">+50%</span>
                    </span>
                  </div>
                ) : isRecovered ? (
```

Replace with just:

```typescript
                {isRecovered ? (
```

- [ ] **Step 11: Simplify summary bar (lines 451-482)**

Replace the summary bar content:

```typescript
              <span className="text-blue-400">
                {convertedCount + (bulkConverted ? bulkCards.length : 0)}{" "}
                {isDe ? "Umwandlungen" : "Converts"}
              </span>
              {(coinsBack > 0 || bulkConverted) && (
                <span className="text-pa-green">
                  +{coinsBack + (bulkConverted ? bulkTotalWithBonus : 0)} Coins
                </span>
              )}
```

With:

```typescript
              <span className="text-blue-400">
                {convertedCount} {isDe ? "Umwandlungen" : "Converts"}
              </span>
              {coinsBack > 0 && (
                <span className="text-pa-green">+{coinsBack} Coins</span>
              )}
```

Replace the remaining count calculation:

```typescript
                  {isDe
                    ? `Noch ${cards.length - claimedCount - convertedCount - (bulkConverted ? bulkCards.length : 0) - recoveredIndices.size} offen`
                    : `${cards.length - claimedCount - convertedCount - (bulkConverted ? bulkCards.length : 0) - recoveredIndices.size} remaining`}
```

With:

```typescript
                  {isDe
                    ? `Noch ${cards.length - claimedCount - convertedCount - recoveredIndices.size} offen`
                    : `${cards.length - claimedCount - convertedCount - recoveredIndices.size} remaining`}
```

Remove the bulk sub-line entirely (lines 475-481):

```typescript
          {bulkConverted && (
            <p className="text-xs text-pa-green/70">
              {isDe
                ? `↳ davon ${bulkCards.length} Bulk-Karten mit +50% Bonus`
                : `↳ incl. ${bulkCards.length} bulk cards with +50% bonus`}
            </p>
          )}
```

- [ ] **Step 12: Verify the component compiles**

```bash
npx tsc --noEmit components/packs/pack-opening.tsx
```

Expected: No errors.

- [ ] **Step 13: Commit**

```bash
git add components/packs/pack-opening.tsx
git commit -m "refactor: remove all bulk conversion UI and logic from pack-opening"
```

---

### Task 4: Clean up CoinTransaction type enum

**Files:**
- Modify: `models/coin-transaction.ts`

- [ ] **Step 1: Remove `bulk_conversion` from the type union and enum**

In `models/coin-transaction.ts`, remove `"bulk_conversion"` from both the TypeScript type union (line 6) and the Mongoose enum array (line 23).

Line 6 — change:

```typescript
  type: "admin_grant" | "admin_deduct" | "pack_purchase" | "card_conversion" | "bulk_conversion" | "coin_purchase" | "shipping_payment" | "reservation_expired" | "battle_entry" | "battle_card_conversion" | "battle_refund";
```

To:

```typescript
  type: "admin_grant" | "admin_deduct" | "pack_purchase" | "card_conversion" | "coin_purchase" | "shipping_payment" | "reservation_expired" | "battle_entry" | "battle_card_conversion" | "battle_refund";
```

Line 23 — change:

```typescript
      enum: ["admin_grant", "admin_deduct", "pack_purchase", "card_conversion", "bulk_conversion", "coin_purchase", "shipping_payment", "reservation_expired", "battle_entry", "battle_card_conversion", "battle_refund"],
```

To:

```typescript
      enum: ["admin_grant", "admin_deduct", "pack_purchase", "card_conversion", "coin_purchase", "shipping_payment", "reservation_expired", "battle_entry", "battle_card_conversion", "battle_refund"],
```

Note: Existing `bulk_conversion` records in the database will remain but won't cause issues — Mongoose only validates on write.

- [ ] **Step 2: Commit**

```bash
git add models/coin-transaction.ts
git commit -m "refactor: remove bulk_conversion from CoinTransaction types"
```

---

### Task 5: Final verification

- [ ] **Step 1: Full TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors related to bulk conversion.

- [ ] **Step 2: Search for any remaining references**

```bash
grep -ri "bulk" --include="*.ts" --include="*.tsx" app/ components/ lib/ models/ | grep -v node_modules | grep -v "docs/"
```

Expected: No hits (or only unrelated uses of "bulk" like MongoDB's `bulkWrite`).

- [ ] **Step 3: Run dev server smoke test**

```bash
npm run dev
```

Open a pack in the browser and verify:
- No bulk conversion banner appears
- Each card shows only Warenkorb / Coin buttons
- Converting a card gives 1:1 coin value
- Confirm button works normally

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

Expected: No new errors.

- [ ] **Step 5: Final commit (if any lint fixes needed)**

```bash
git add -A
git commit -m "fix: resolve any lint issues from bulk removal"
```
