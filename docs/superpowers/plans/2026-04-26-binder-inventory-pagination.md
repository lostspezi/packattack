# Binder Inventory Pagination + Advanced Search — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the all-at-once inventory load in the binder editor with on-demand pagination, infinite scroll, and filter dropdowns (game, set, rarity) plus a name search field.

**Architecture:** The `InventoryDrawer` component becomes self-contained — it owns filter state, pagination state, and the loaded card list. `binder-editor.tsx` drops its pre-fetch logic and instead receives newly loaded cards via a callback so the `cardLookup` function stays functional. A new `/api/collection/meta` route supplies the dropdown option lists via a single MongoDB aggregation.

**Tech Stack:** Next.js 16, React 19, TypeScript, Mongoose, Vitest, Tailwind CSS, dnd-kit, IntersectionObserver API

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `lib/binders/inventory.ts` | Replace `fetchInventory` (all-pages loop) with `fetchInventoryPage` (single page) + `fetchCollectionMeta`. Export `CollectionMeta` type. |
| Create | `app/api/collection/meta/route.ts` | MongoDB aggregation → `{ games, setsByGame, rarities }` |
| Create | `__tests__/collection-meta.test.ts` | Unit test for pure `buildCollectionMeta` helper |
| Rewrite | `components/binders/inventory-drawer.tsx` | Filter UI, infinite scroll, all pagination state. Exposes `removeCard` + `refresh` via `useImperativeHandle`. |
| Modify | `components/binders/binder-editor.tsx` | Drop pre-fetch, add `drawerRef`, wire `onCardsLoaded`, update slot-op callbacks. |

---

## Task 1 — Update `lib/binders/inventory.ts`

**Files:**
- Modify: `lib/binders/inventory.ts`

Replace the current file. The `fetchInventory` loop is the root cause of the performance problem — delete it. Add `fetchInventoryPage` (single page) and `fetchCollectionMeta`.

- [ ] **Step 1: Replace the file contents**

```ts
// lib/binders/inventory.ts

export interface InventoryCard {
  packPullId: string;
  cardId: string;
  name: string;
  game: string;
  set: string;
  setName: string;
  rarity: string;
  image: string | null;
  createdAt: string;
}

export interface CollectionMeta {
  games: string[];
  setsByGame: Record<string, string[]>;
  rarities: string[];
}

export interface InventoryPageParams {
  cursor?: string | null;
  game?: string;
  set?: string;
  rarity?: string;
  q?: string;
}

export async function fetchInventoryPage(
  params: InventoryPageParams = {},
): Promise<{ items: InventoryCard[]; nextCursor: string | null }> {
  const url = new URL("/api/collection", window.location.origin);
  url.searchParams.set("onlyFree", "1");
  if (params.cursor) url.searchParams.set("cursor", params.cursor);
  if (params.game) url.searchParams.set("game", params.game);
  if (params.set) url.searchParams.set("set", params.set);
  if (params.rarity) url.searchParams.set("rarity", params.rarity);
  if (params.q) url.searchParams.set("q", params.q);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("inventory fetch failed");
  return res.json() as Promise<{ items: InventoryCard[]; nextCursor: string | null }>;
}

export async function fetchCollectionMeta(): Promise<CollectionMeta> {
  const res = await fetch("/api/collection/meta");
  if (!res.ok) throw new Error("meta fetch failed");
  return res.json() as Promise<CollectionMeta>;
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: 0 errors (the old `fetchInventory` export will cause errors in `binder-editor.tsx` — that's fine, fix in Task 4).

- [ ] **Step 3: Commit**

```bash
git add lib/binders/inventory.ts
git commit -m "refactor(inventory): replace all-pages loop with single-page fetch + meta helper"
```

---

## Task 2 — Create `/api/collection/meta` route

**Files:**
- Create: `app/api/collection/meta/route.ts`
- Create: `__tests__/collection-meta.test.ts`

The route runs a MongoDB aggregation grouped by game. A pure helper function `buildCollectionMeta` transforms the rows so it can be unit tested without a database.

- [ ] **Step 1: Write the failing test**

Create `__tests__/collection-meta.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildCollectionMeta } from "@/app/api/collection/meta/route";

describe("buildCollectionMeta", () => {
  it("builds sorted games, setsByGame, and rarities from aggregation rows", () => {
    const rows = [
      { _id: "pokemon", sets: ["sv1", "swsh1"], rarities: ["Rare", "Common"] },
      { _id: "lorcana", sets: ["tfc"], rarities: ["Common", "Uncommon"] },
    ];
    const meta = buildCollectionMeta(rows);
    expect(meta.games).toEqual(["lorcana", "pokemon"]);
    expect(meta.setsByGame).toEqual({
      lorcana: ["tfc"],
      pokemon: ["sv1", "swsh1"],
    });
    expect(meta.rarities).toEqual(["Common", "Rare", "Uncommon"]);
  });

  it("skips rows where _id is falsy", () => {
    const rows = [
      { _id: "", sets: ["sv1"], rarities: ["Common"] },
      { _id: "pokemon", sets: ["sv1"], rarities: ["Rare"] },
    ];
    const meta = buildCollectionMeta(rows);
    expect(meta.games).toEqual(["pokemon"]);
  });

  it("deduplicates rarities across games", () => {
    const rows = [
      { _id: "pokemon", sets: [], rarities: ["Common", "Rare"] },
      { _id: "lorcana", sets: [], rarities: ["Common"] },
    ];
    const meta = buildCollectionMeta(rows);
    expect(meta.rarities).toEqual(["Common", "Rare"]);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx vitest run __tests__/collection-meta.test.ts
```

Expected: FAIL — `buildCollectionMeta` is not exported yet.

- [ ] **Step 3: Create the route with the exported helper**

Create `app/api/collection/meta/route.ts`:

```ts
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import PackPull from "@/models/pack-pull";
import type { CollectionMeta } from "@/lib/binders/inventory";

interface AggRow {
  _id: string;
  sets: string[];
  rarities: string[];
}

export function buildCollectionMeta(rows: AggRow[]): CollectionMeta {
  const games: string[] = [];
  const setsByGame: Record<string, string[]> = {};
  const raritySet = new Set<string>();
  for (const row of rows) {
    const game = row._id;
    if (!game) continue;
    games.push(game);
    setsByGame[game] = row.sets.filter(Boolean).sort();
    for (const r of row.rarities) if (r) raritySet.add(r);
  }
  games.sort();
  return { games, setsByGame, rarities: [...raritySet].sort() };
}

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await connectDB();
  const userObjId = new Types.ObjectId(userId);
  const rows = (await PackPull.aggregate([
    { $match: { userId: userObjId, binderId: null } },
    {
      $lookup: {
        from: "cards",
        localField: "cardId",
        foreignField: "_id",
        as: "card",
      },
    },
    { $unwind: "$card" },
    {
      $group: {
        _id: "$card.game",
        sets: { $addToSet: "$card.set" },
        rarities: { $addToSet: "$card.rarity" },
      },
    },
  ])) as AggRow[];
  return NextResponse.json(buildCollectionMeta(rows) satisfies CollectionMeta);
}
```

- [ ] **Step 4: Run the test — expect pass**

```bash
npx vitest run __tests__/collection-meta.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: same error count as after Task 1 (no new errors).

- [ ] **Step 6: Commit**

```bash
git add app/api/collection/meta/route.ts __tests__/collection-meta.test.ts
git commit -m "feat(api): add /api/collection/meta route with buildCollectionMeta helper"
```

---

## Task 3 — Rewrite `inventory-drawer.tsx`

**Files:**
- Rewrite: `components/binders/inventory-drawer.tsx`

The drawer owns all state: filters, loaded items, cursor, loading flag, meta. It exposes `removeCard(packPullId)` and `refresh()` via `useImperativeHandle` so the editor can drive it after slot operations. An `IntersectionObserver` on a sentinel div triggers the next page load.

The `onCardsLoaded` callback is called each time a page is fetched — the editor uses this to fold cards into `placedById` for the `cardLookup` function.

Filter row: search input, game select, set select (filtered by selected game), rarity select. "Filter zurücksetzen" appears when any filter is active.

- [ ] **Step 1: Write the new file**

```tsx
"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useDraggable } from "@dnd-kit/core";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, ChevronUp, Loader2, Search, X } from "lucide-react";
import {
  fetchCollectionMeta,
  fetchInventoryPage,
  type CollectionMeta,
  type InventoryCard,
  type InventoryPageParams,
} from "@/lib/binders/inventory";

export interface InventoryDrawerHandle {
  removeCard(packPullId: string): void;
  refresh(): void;
}

interface Filters {
  q: string;
  game: string;
  set: string;
  rarity: string;
}

const EMPTY_FILTERS: Filters = { q: "", game: "", set: "", rarity: "" };

interface InventoryDrawerProps {
  open: boolean;
  onToggle: () => void;
  isDe: boolean;
  onCardsLoaded?: (cards: InventoryCard[]) => void;
}

export const InventoryDrawer = forwardRef<
  InventoryDrawerHandle,
  InventoryDrawerProps
>(function InventoryDrawer({ open, onToggle, isDe, onCardsLoaded }, ref) {
  const [items, setItems] = useState<InventoryCard[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [meta, setMeta] = useState<CollectionMeta | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [debouncedQ, setDebouncedQ] = useState("");
  const sentinelRef = useRef<HTMLDivElement>(null);
  const didInit = useRef(false);

  const activeFilters: InventoryPageParams = {
    ...(filters.game ? { game: filters.game } : {}),
    ...(filters.set ? { set: filters.set } : {}),
    ...(filters.rarity ? { rarity: filters.rarity } : {}),
    ...(debouncedQ ? { q: debouncedQ } : {}),
  };
  const hasActiveFilter =
    !!filters.game || !!filters.set || !!filters.rarity || !!debouncedQ;

  const loadPage = useCallback(
    async (params: InventoryPageParams, append: boolean) => {
      setIsLoading(true);
      setHasError(false);
      try {
        const data = await fetchInventoryPage(params);
        setItems((prev) => (append ? [...prev, ...data.items] : data.items));
        setNextCursor(data.nextCursor);
        onCardsLoaded?.(data.items);
      } catch {
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    },
    [onCardsLoaded],
  );

  // Debounce search field
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q), 300);
    return () => clearTimeout(t);
  }, [filters.q]);

  // Fetch page 1 whenever active filters (including debounced q) change
  useEffect(() => {
    if (!didInit.current) return;
    setItems([]);
    setNextCursor(null);
    loadPage(activeFilters, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.game, filters.set, filters.rarity, debouncedQ]);

  // Load meta + first page on first open
  useEffect(() => {
    if (!open || didInit.current) return;
    didInit.current = true;
    fetchCollectionMeta()
      .then(setMeta)
      .catch(() => {});
    loadPage(activeFilters, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Infinite scroll sentinel
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && nextCursor && !isLoading) {
          loadPage({ ...activeFilters, cursor: nextCursor }, true);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextCursor, isLoading, loadPage, filters.game, filters.set, filters.rarity, debouncedQ]);

  useImperativeHandle(ref, () => ({
    removeCard(packPullId: string) {
      setItems((prev) => prev.filter((c) => c.packPullId !== packPullId));
    },
    refresh() {
      setItems([]);
      setNextCursor(null);
      setFilters(EMPTY_FILTERS);
      setDebouncedQ("");
      loadPage({}, false);
    },
  }));

  const visibleSets = filters.game
    ? (meta?.setsByGame[filters.game] ?? [])
    : Object.values(meta?.setsByGame ?? {}).flat().sort();

  const selectCls =
    "h-8 rounded-md border border-border bg-surface px-2 text-xs text-text-primary focus:outline-none focus:border-pa-green/50 min-w-0";

  return (
    <div className="bg-surface border border-border rounded-xl">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/3 transition-colors"
      >
        <span className="text-sm font-semibold text-text-primary">
          {isDe ? "Inventar" : "Inventory"}{" "}
          <span className="text-text-muted font-normal">({items.length}{nextCursor ? "+" : ""})</span>
        </span>
        {open ? (
          <ChevronDown className="w-4 h-4 text-text-secondary" />
        ) : (
          <ChevronUp className="w-4 h-4 text-text-secondary" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Filter row */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[140px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
              <input
                type="text"
                value={filters.q}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, q: e.target.value }))
                }
                placeholder={isDe ? "Kartenname…" : "Card name…"}
                className="h-8 w-full rounded-md border border-border bg-surface pl-7 pr-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-pa-green/50"
              />
            </div>

            {meta && meta.games.length > 1 && (
              <select
                value={filters.game}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    game: e.target.value,
                    set: "",
                  }))
                }
                className={selectCls}
              >
                <option value="">{isDe ? "Alle Spiele" : "All games"}</option>
                {meta.games.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            )}

            {meta && visibleSets.length > 0 && (
              <select
                value={filters.set}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, set: e.target.value }))
                }
                className={selectCls}
              >
                <option value="">{isDe ? "Alle Sets" : "All sets"}</option>
                {visibleSets.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}

            {meta && meta.rarities.length > 0 && (
              <select
                value={filters.rarity}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, rarity: e.target.value }))
                }
                className={selectCls}
              >
                <option value="">{isDe ? "Alle Raritäten" : "All rarities"}</option>
                {meta.rarities.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            )}

            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                  setDebouncedQ("");
                }}
                className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
              >
                <X className="w-3 h-3" />
                {isDe ? "Zurücksetzen" : "Reset"}
              </button>
            )}
          </div>

          {/* Card grid */}
          <div className="max-h-[40vh] overflow-y-auto">
            {isLoading && items.length === 0 ? (
              <div className="py-8 text-center">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-pa-green" />
              </div>
            ) : hasError && items.length === 0 ? (
              <p className="text-sm text-text-muted py-6 text-center">
                {isDe ? "Fehler beim Laden." : "Failed to load."}{" "}
                <button
                  type="button"
                  onClick={() => loadPage(activeFilters, false)}
                  className="underline"
                >
                  {isDe ? "Nochmal" : "Retry"}
                </button>
              </p>
            ) : items.length === 0 ? (
              <p className="text-sm text-text-muted py-6 text-center">
                {hasActiveFilter
                  ? isDe
                    ? "Keine Karten gefunden."
                    : "No cards found."
                  : isDe
                    ? "Keine freien Karten."
                    : "No free cards."}
                {hasActiveFilter && (
                  <>
                    {" "}
                    <button
                      type="button"
                      onClick={() => setFilters(EMPTY_FILTERS)}
                      className="underline"
                    >
                      {isDe ? "Filter zurücksetzen" : "Reset filters"}
                    </button>
                  </>
                )}
              </p>
            ) : (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-10 gap-2">
                  <AnimatePresence initial={false}>
                    {items.map((c) => (
                      <DraggableInventoryTile key={c.packPullId} card={c} />
                    ))}
                  </AnimatePresence>
                </div>
                {/* Infinite scroll sentinel */}
                <div ref={sentinelRef} className="h-4" />
                {isLoading && (
                  <div className="py-2 text-center">
                    <Loader2 className="w-4 h-4 animate-spin mx-auto text-pa-green" />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

function DraggableInventoryTile({ card }: { card: InventoryCard }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `inv:${card.packPullId}`,
    data: { kind: "inventory", card },
  });
  return (
    <motion.div
      layoutId={`card-${card.packPullId}`}
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.6, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      className={[
        "relative aspect-[5/7] rounded-md overflow-hidden bg-black/20 ring-1 ring-white/10",
        isDragging ? "opacity-30" : "hover:ring-pa-green/40",
      ].join(" ")}
    >
      <button
        ref={setNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        className="absolute inset-0 cursor-grab active:cursor-grabbing touch-none"
        title={card.name}
      >
        {card.image ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={card.image}
            alt={card.name}
            className="object-cover w-full h-full"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[9px] text-white/60 px-1 text-center">
            {card.name}
          </div>
        )}
      </button>
      <span className="pointer-events-none absolute bottom-0.5 left-0.5 px-1 py-0 rounded text-[8px] font-bold uppercase tracking-wider bg-black/70 text-white border border-white/15">
        {card.rarity}
      </span>
    </motion.div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: errors in `binder-editor.tsx` about old props (`inventory`, `loading`) — that's fine, fixed in Task 4. No new errors in `inventory-drawer.tsx` itself.

- [ ] **Step 3: Commit**

```bash
git add components/binders/inventory-drawer.tsx
git commit -m "feat(binders): rewrite InventoryDrawer with filter UI, infinite scroll, own pagination state"
```

---

## Task 4 — Update `binder-editor.tsx`

**Files:**
- Modify: `components/binders/binder-editor.tsx`

Remove the pre-fetch logic (`fetchInventory` call, `inventory`/`inventoryLoading` state, `reloadInventory`, the fold `useEffect`). Add `drawerRef` and `handleCardsLoaded`. Update the three `reloadInventory()` call sites:
- **place** (drag from inventory): `drawerRef.current?.removeCard(packPullId)` — optimistic remove
- **remove from slot**: `drawerRef.current?.refresh()` — reset + re-fetch
- **swap** (slot to slot): remove the `reloadInventory()` call entirely (swap doesn't touch inventory)

`cardLookup` drops the `inventoryById` fallback — `placedById` alone is sufficient because `handleCardsLoaded` folds inventory pages into `placedById` as they arrive.

- [ ] **Step 1: Apply all changes to `binder-editor.tsx`**

Change the imports at the top — remove `fetchInventory`, keep `InventoryCard`:

```ts
// Remove this import:
import { fetchInventory, type InventoryCard } from "@/lib/binders/inventory";

// Replace with:
import type { InventoryCard } from "@/lib/binders/inventory";
```

Add the drawer ref import:

```ts
// Add to React imports:
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Add to component imports:
import { InventoryDrawer, type InventoryDrawerHandle } from "./inventory-drawer";
```

Inside the `BinderEditor` function, remove these lines:

```ts
// DELETE these:
const [inventory, setInventory] = useState<InventoryCard[]>([]);
const [inventoryLoading, setInventoryLoading] = useState(true);

const inventoryById = useMemo(() => {
  const map = new Map<string, InventoryCard>();
  for (const c of inventory) map.set(c.packPullId, c);
  return map;
}, [inventory]);

const reloadInventory = useCallback(async () => {
  setInventoryLoading(true);
  try {
    const items = await fetchInventory();
    setInventory(items);
  } finally {
    setInventoryLoading(false);
  }
}, []);

useEffect(() => {
  reloadInventory();
}, [reloadInventory]);

// DELETE the fold useEffect:
useEffect(() => {
  setPlacedById((prev) => {
    const next = new Map(prev);
    for (const c of inventory) {
      if (!next.has(c.packPullId)) next.set(c.packPullId, c);
    }
    return next;
  });
}, [inventory]);
```

Add the drawer ref and cards-loaded callback after the `placedById` state:

```ts
const drawerRef = useRef<InventoryDrawerHandle>(null);

const handleCardsLoaded = useCallback((cards: InventoryCard[]) => {
  setPlacedById((prev) => {
    const next = new Map(prev);
    for (const c of cards) {
      if (!next.has(c.packPullId)) next.set(c.packPullId, c);
    }
    return next;
  });
}, []);
```

Replace `cardLookup` — remove `inventoryById` fallback:

```ts
// OLD:
const cardLookup = useCallback(
  (packPullId: string): InventoryCard | undefined => {
    return inventoryById.get(packPullId) ?? placedById.get(packPullId);
  },
  [inventoryById, placedById],
);

// NEW:
const cardLookup = useCallback(
  (packPullId: string): InventoryCard | PlacedCardDTO | undefined => {
    return placedById.get(packPullId);
  },
  [placedById],
);
```

Update `handleRemoveCard` — replace `await reloadInventory()` with `drawerRef.current?.refresh()`:

```ts
const handleRemoveCard = useCallback(
  async (pageIndex: number, slotPosition: number) => {
    const ok = await performSlotOp({
      op: "remove",
      pageIndex,
      slotPosition,
    });
    if (ok) drawerRef.current?.refresh();
  },
  [performSlotOp],
);
```

Update `handleDragEnd` — two changes:
1. After successful place from inventory: `drawerRef.current?.removeCard(drag.card.packPullId)` instead of `await reloadInventory()`
2. After successful swap: remove `await reloadInventory()` entirely

```ts
// In handleDragEnd, inventory place branch:
if (ok) {
  drawerRef.current?.removeCard(drag.card.packPullId);
}

// In handleDragEnd, swap branch:
if (ok) {
  // no inventory update needed for slot-to-slot swap
}
```

Update the `<InventoryDrawer>` JSX — replace old props with new ones:

```tsx
// OLD:
<InventoryDrawer
  open={drawerOpen}
  onToggle={() => setDrawerOpen((v) => !v)}
  inventory={inventory}
  loading={inventoryLoading}
  isDe={isDe}
/>

// NEW:
<InventoryDrawer
  ref={drawerRef}
  open={drawerOpen}
  onToggle={() => setDrawerOpen((v) => !v)}
  isDe={isDe}
  onCardsLoaded={handleCardsLoaded}
/>
```

Also remove `useEffect` from React imports if it's no longer used (check — `useEffect` is still used for `totalSpreads` clamp, so keep it).

- [ ] **Step 2: Typecheck — expect 0 errors**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass, including the 3 new `collection-meta` tests.

- [ ] **Step 4: Commit**

```bash
git add components/binders/binder-editor.tsx
git commit -m "refactor(binders): drop inventory pre-fetch, wire drawerRef for on-demand pagination"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All spec requirements covered — meta route (Task 2), `fetchInventoryPage` (Task 1), drawer filter UI with game/set/rarity/search (Task 3), infinite scroll (Task 3), optimistic card remove on place (Task 4), drawer refresh on unplace (Task 4), `setsByGame` for cross-filtered set dropdown (Task 3), error state + retry (Task 3), empty state with reset button (Task 3), `onCardsLoaded` for `cardLookup` correctness (Task 4).
- [x] **No placeholders:** All steps contain actual code.
- [x] **Type consistency:** `InventoryDrawerHandle` defined in Task 3, imported in Task 4. `CollectionMeta` defined in Task 1, used in Tasks 2 and 3. `InventoryPageParams` defined in Task 1, used in Tasks 1 and 3. `buildCollectionMeta` exported in Task 2, tested in Task 2.
- [x] **cardLookup return type:** Changed to `InventoryCard | PlacedCardDTO | undefined` — both types have the fields used by callers (`name`, `packPullId`). Verify callers accept this union.
