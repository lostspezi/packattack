# Binder Inventory: Pagination + Advanced Search Design

**Date:** 2026-04-26  
**Status:** Approved

## Problem

The binder editor (`/binders/[slug]`) loads all available cards for a user in one shot on drawer open. `lib/binders/inventory.ts` loops through up to 50 cursor pages (60 cards each = 3,000 cards max) and holds everything in memory. With 3,000 cards on prod this kills performance.

The `/api/collection` route already supports cursor-based pagination and all needed filters (`q`, `game`, `set`, `rarity`, `onlyFree`). The fix is entirely on the client side.

---

## Architecture

### Root cause

`lib/binders/inventory.ts` intentionally exhausts all pages in a loop. `binder-editor.tsx` calls this on mount and stores the full card list in state, passing it down to the drawer.

### Strategy

Make `inventory-drawer.tsx` the owner of filter state and pagination state. The drawer fetches on demand. `binder-editor.tsx` no longer pre-fetches cards.

### Files changed

| File | Change |
|------|--------|
| `lib/binders/inventory.ts` | Rewrite: single-page fetch, returns `{ items, nextCursor }` |
| `components/binders/inventory-drawer.tsx` | Add filter UI, infinite scroll, own pagination state |
| `components/binders/binder-editor.tsx` | Remove `fetchInventory()` call on mount |
| `app/api/collection/meta/route.ts` | New route — returns distinct `games`, `sets`, `rarities` from user inventory |

---

## Component Design

### `inventory-drawer.tsx` state

```ts
filterState: { q: string; game: string; set: string; rarity: string }
items: InventoryCard[]
nextCursor: string | null
isLoading: boolean
meta: { games: string[]; setsByGame: Record<string, string[]>; rarities: string[] } | null
```

### On drawer open

Two parallel fetches:
1. `/api/collection/meta` — populates filter dropdowns (cached for drawer lifetime)
2. `/api/collection?onlyFree=1` — first page of cards (60 items)

### On filter change

Reset `items` to `[]`, `nextCursor` to `null`, fetch page 1 with current filters. Search field is debounced 300 ms.

### Infinite scroll

`IntersectionObserver` on a sentinel `<div>` at the bottom of the card grid. When sentinel is visible and `nextCursor !== null` and `!isLoading` → fetch next page, append to `items`.

### Filter UI (single row at top of drawer)

- Text input — name search (`q`)
- Game dropdown — options from `meta.games`
- Set dropdown — options from `meta.sets`, filtered by selected game; resets when game changes
- Rarity dropdown — options from `meta.rarities`
- "Filter zurücksetzen" link — visible when any filter is active; resets all filters and re-fetches

### On card placed

Remove card from `items` locally (optimistic). No re-fetch.

### Drawer close/reopen

Filter state and cached items persist until the binder page is unmounted.

---

## `/api/collection/meta` Route

New file: `app/api/collection/meta/route.ts`

MongoDB aggregation on `PackPull` (where `userId` matches and `binderId` is `null`), joined with `Card`. Groups by game to produce a `setsByGame` map so the client can filter the Set dropdown when a Game is selected:

```js
[
  { $match: { userId: userObjId, binderId: null } },
  { $lookup: { from: "cards", localField: "cardId", foreignField: "_id", as: "card" } },
  { $unwind: "$card" },
  {
    $group: {
      _id: "$card.game",
      sets:     { $addToSet: "$card.set" },
      rarities: { $addToSet: "$card.rarity" },
    }
  }
]
// post-process in JS: build { games[], setsByGame, rarities[] }
```

Response:
```ts
{
  games: string[]                    // sorted alphabetically
  setsByGame: Record<string, string[]> // game → sorted set codes
  rarities: string[]                 // sorted alphabetically, union across all games
}
```

Client uses `setsByGame[selectedGame] ?? allSets` when populating the Set dropdown.

---

## Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Filter active, no results | Empty state: "Keine Karten gefunden" + "Filter zurücksetzen" button |
| Fetch error | Inline error message; user can retry by changing any filter |
| Game filter changed | Set dropdown resets if current set not in new game's sets |
| All cards visible (< 60) | No sentinel trigger, no further fetches |
| Card placed | Removed from `items` optimistically |

---

## Out of Scope

- Filtering by card condition or printing (not indexed, minor use case)
- Multiple-value filter per field (e.g. two rarities at once)
- Persisting filter state across page navigations
