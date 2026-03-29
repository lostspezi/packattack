# Remove Bulk Conversion System

**Date:** 2026-03-29
**Status:** Approved

## Summary

Remove the entire bulk conversion bonus system. Card decisions are simplified to two options: add to cart (Warenkorb) or convert 1:1 to coins (Umwandeln). No bonus multipliers, no bulk banners, no confirmation popups.

## What Gets Removed

### Constants (`lib/pack-constants.ts`)
- `BULK_COIN_THRESHOLD` (20)
- `BULK_CONVERSION_BONUS` (0.5)
- `MIN_PACKS_FOR_BULK_OFFER` (3)
- `MIN_BULK_CARDS_FOR_OFFER` (3)

### API Endpoint
- `/app/api/pulls/bulk-convert/route.ts` — entire file deleted

### UI Components (`components/packs/pack-opening.tsx`)
- Bulk conversion banner (offer to convert all bulk cards with 50% bonus)
- All bulk-related state variables (bulkCards, bulkTotal, bulkTotalWithBonus, bonusCoins, showBulkOffer, etc.)
- Bulk eligibility calculation logic

### Backend Logic
- `conversionValue *= 1.5` bonus application in bulk-convert endpoint
- Any bulk-related CoinTransaction reason strings

## What Stays Unchanged

- Single card decision flow via `/api/pulls/decide` (Warenkorb or Umwandeln)
- `coinValue = Math.max(1, Math.floor(internalPrice))` — 1:1 conversion
- Cart system (reservation, expiry, checkout)
- Auto-convert cron (`/api/cron/auto-convert`)
- Recovery system for interrupted pack openings
- CoinTransaction logging for individual conversions
- SSE live feed events

## Motivation

The bulk bonus system is being removed to simplify the card decision flow. A new incentive system may be designed at a later point. Removing now avoids carrying dead complexity and eliminates inflation/exploit risks associated with bonus multipliers.
