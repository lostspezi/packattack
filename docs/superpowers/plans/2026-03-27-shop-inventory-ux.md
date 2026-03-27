# Shop-Inventar UX Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the shop inventory management page with JustTCG card search (same as admin box management), two-column layout, per-condition entries, netto pricing, and Kleinunternehmer support.

**Architecture:** Update the `InventoryItem` model (add `condition`, rename `pricePerUnit` → `netPrice`, new unique index). Add `isSmallBusiness` to `ShopProfile`. Overhaul `POST /api/shop/inventory` to accept `justTcgId` and create Card records. Build three new components: `ShopCardSearch` (list-based card search), `ShopInventoryList` (table with inline edit), `ShopInventoryManager` (two-column container with mobile tabs). Expand JustTCG API role checks to include `"shop"`.

**Tech Stack:** Next.js App Router, Mongoose, MongoDB, TypeScript, Tailwind CSS, JustTCG API

---

> **Note on testing:** No test runner is configured. Each task uses `npm run typecheck` (runs `tsc --noEmit`) as the primary verification step. Run from the project root.

---

## File Map

**Models (modify):**
- `models/inventory-item.ts` — Add `condition` field, rename `pricePerUnit` → `netPrice`, change unique index to `shop+card+condition`
- `models/shop-profile.ts` — Add `isSmallBusiness: boolean`

**API routes (modify):**
- `app/api/justtcg/cards/route.ts` — Add `"shop"` to role check
- `app/api/justtcg/sets/route.ts` — Add `"shop"` to role check
- `app/api/justtcg/games/route.ts` — Add `"shop"` to role check
- `app/api/justtcg/rarities/route.ts` — Add `"shop"` to role check
- `app/api/shop/inventory/route.ts` — Overhaul POST (accept `justTcgId`), update GET (include `condition`, `netPrice`)
- `app/api/shop/inventory/[id]/route.ts` — Update PATCH to handle `condition`, `netPrice`
- `app/api/shop/apply/route.ts` — Accept `isSmallBusiness` from FormData

**Components (create):**
- `components/shop/shop-card-search.tsx` — JustTCG card search with list view and "+" button
- `components/shop/shop-inventory-list.tsx` — Inventory table with inline edit, auto-edit-mode for new items
- `components/shop/shop-inventory-manager.tsx` — Two-column layout container with mobile tabs

**Components (modify):**
- `components/shop/shop-apply-form.tsx` — Add Kleinunternehmer checkbox

**Pages (modify):**
- `app/[lang]/(dashboard)/shop/inventory/page.tsx` — Replace `ShopInventoryTable` with `ShopInventoryManager`

**Delete:**
- `app/api/cards/route.ts` — Replaced by JustTCG search
- `components/shop/shop-inventory-table.tsx` — Replaced by `ShopInventoryManager`

---

## Task 1: InventoryItem Model — Add `condition`, Rename `pricePerUnit` → `netPrice`

**Files:**
- Modify: `models/inventory-item.ts`

- [ ] **Step 1: Update the interface**

Replace the current `IInventoryItem` interface:

```typescript
export interface IInventoryItem extends Document {
  card: Types.ObjectId;
  shop: Types.ObjectId;
  condition: "Mint" | "Near Mint" | "Lightly Played" | "Moderately Played" | "Heavily Played";
  stock: number;
  ean: string | null;
  sku: string | null;
  notes: string | null;
  netPrice: number | null;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 2: Update the schema**

Replace the schema definition:

```typescript
const InventoryItemSchema = new Schema<IInventoryItem>(
  {
    card: { type: Schema.Types.ObjectId, ref: "Card", required: true },
    shop: { type: Schema.Types.ObjectId, ref: "User", required: true },
    condition: {
      type: String,
      required: true,
      enum: ["Mint", "Near Mint", "Lightly Played", "Moderately Played", "Heavily Played"],
      default: "Near Mint",
    },
    stock: { type: Number, required: true, default: 0, min: 0 },
    ean: { type: String, default: null },
    sku: { type: String, default: null },
    notes: { type: String, default: null },
    netPrice: { type: Number, default: null, min: 0 },
  },
  { timestamps: true }
);
```

- [ ] **Step 3: Update indexes**

Replace the three existing indexes:

```typescript
InventoryItemSchema.index({ shop: 1 });
InventoryItemSchema.index({ card: 1 });
InventoryItemSchema.index({ shop: 1, card: 1, condition: 1 }, { unique: true });
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: Errors in files that reference `pricePerUnit` — these will be fixed in later tasks.

- [ ] **Step 5: Commit**

```bash
git add models/inventory-item.ts
git commit -m "feat: add condition to InventoryItem, rename pricePerUnit to netPrice"
```

---

## Task 2: ShopProfile Model — Add `isSmallBusiness`

**Files:**
- Modify: `models/shop-profile.ts`

- [ ] **Step 1: Update the interface**

Add `isSmallBusiness` to `IShopProfile`:

```typescript
export interface IShopProfile extends Document {
  user: Types.ObjectId;
  companyName: string;
  status: ShopStatus;
  isSmallBusiness: boolean;
  rejectReason: string | null;
  licenseFileId: string | null;
  licenseFileName: string | null;
  submittedAt: Date;
  reviewedBy: Types.ObjectId | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 2: Add field to schema**

Add after `status` field in `ShopProfileSchema`:

```typescript
    isSmallBusiness: { type: Boolean, default: false },
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (no other files reference `isSmallBusiness` yet)

- [ ] **Step 4: Commit**

```bash
git add models/shop-profile.ts
git commit -m "feat: add isSmallBusiness to ShopProfile for Kleinunternehmerregelung"
```

---

## Task 3: JustTCG API Routes — Add `"shop"` Role

**Files:**
- Modify: `app/api/justtcg/cards/route.ts`
- Modify: `app/api/justtcg/sets/route.ts`
- Modify: `app/api/justtcg/games/route.ts`
- Modify: `app/api/justtcg/rarities/route.ts`

All four routes currently have:
```typescript
if (!session?.user || (role !== "admin" && role !== "super_admin")) {
```

- [ ] **Step 1: Update `cards/route.ts`**

Replace the role check line:

```typescript
  if (!session?.user || !["admin", "super_admin", "shop"].includes(role ?? "")) {
```

- [ ] **Step 2: Update `sets/route.ts`**

Same replacement:

```typescript
  if (!session?.user || !["admin", "super_admin", "shop"].includes(role ?? "")) {
```

- [ ] **Step 3: Update `games/route.ts`**

Same replacement:

```typescript
  if (!session?.user || !["admin", "super_admin", "shop"].includes(role ?? "")) {
```

- [ ] **Step 4: Update `rarities/route.ts`**

Same replacement:

```typescript
  if (!session?.user || !["admin", "super_admin", "shop"].includes(role ?? "")) {
```

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/api/justtcg/cards/route.ts app/api/justtcg/sets/route.ts app/api/justtcg/games/route.ts app/api/justtcg/rarities/route.ts
git commit -m "feat: allow shop role to access JustTCG API routes"
```

---

## Task 4: Shop Apply — Kleinunternehmer Checkbox

**Files:**
- Modify: `components/shop/shop-apply-form.tsx`
- Modify: `app/api/shop/apply/route.ts`

- [ ] **Step 1: Add checkbox state and UI to `ShopApplyForm`**

Add state after the `file` state:

```typescript
const [isSmallBusiness, setIsSmallBusiness] = useState(false);
```

Add `isSmallBusiness` to FormData in `handleSubmit`, before the fetch:

```typescript
    fd.append("isSmallBusiness", isSmallBusiness ? "true" : "false");
```

Add the checkbox UI after the file upload `<div>` block (before the submit button):

```tsx
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          id="isSmallBusiness"
          checked={isSmallBusiness}
          onChange={(e) => setIsSmallBusiness(e.target.checked)}
          className="mt-1 rounded border-border"
        />
        <label htmlFor="isSmallBusiness" className="text-sm text-text-primary">
          {isDe
            ? "Ich unterliege der Kleinunternehmerregelung (§19 UStG)"
            : "I am subject to the small business regulation (§19 UStG)"}
        </label>
      </div>
```

- [ ] **Step 2: Update API route to accept `isSmallBusiness`**

In `app/api/shop/apply/route.ts`, after `const file = formData.get("file");` add:

```typescript
    const isSmallBusiness = formData.get("isSmallBusiness") === "true";
```

Add `isSmallBusiness` to `ShopProfile.create()`:

```typescript
    const profile = await ShopProfile.create({
      user: userId,
      companyName: parsed.data.companyName,
      status: "pending",
      isSmallBusiness,
      licenseFileId: fileId,
      licenseFileName: filename,
      submittedAt: new Date(),
    });
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add components/shop/shop-apply-form.tsx app/api/shop/apply/route.ts
git commit -m "feat: add Kleinunternehmer checkbox to shop application"
```

---

## Task 5: Overhaul `POST /api/shop/inventory` — Accept `justTcgId`

**Files:**
- Modify: `app/api/shop/inventory/route.ts`

- [ ] **Step 1: Add Card import and update POST handler**

Add Card import at the top:

```typescript
import Card from "@/models/card";
```

Replace the entire `POST` function with:

```typescript
export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const allowedRolesPost = ["shop", "admin", "super_admin"];
  if (!session?.user || !userId || !role || !allowedRolesPost.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    justTcgId,
    name,
    game,
    set,
    setName,
    rarity,
    tcgplayerId,
    tcgplayerSkuId,
    condition,
    stock,
    variants,
  } = body as {
    justTcgId?: string;
    name?: string;
    game?: string;
    set?: string;
    setName?: string;
    rarity?: string;
    tcgplayerId?: string | null;
    tcgplayerSkuId?: string | null;
    condition?: string;
    stock?: number;
    variants?: Array<{ condition: string; printing: string; price: number }>;
  };

  if (!justTcgId) {
    return NextResponse.json({ error: "justTcgId is required" }, { status: 400 });
  }

  const itemCondition = condition ?? "Near Mint";
  const validConditions = ["Mint", "Near Mint", "Lightly Played", "Moderately Played", "Heavily Played"];
  if (!validConditions.includes(itemCondition)) {
    return NextResponse.json({ error: "Invalid condition" }, { status: 400 });
  }

  try {
    await connectDB();

    // Find or create Card record (same logic as POST /api/admin/boxes/[id]/cards)
    let card = await Card.findOne({ justTcgId });

    if (!card) {
      const imageUrl = tcgplayerId
        ? `https://tcgplayer-cdn.tcgplayer.com/product/${tcgplayerId}_200w.jpg`
        : null;

      const cardVariants = variants ?? [];
      let marketPrice: number | null = null;
      if (cardVariants.length > 0) {
        const nearMint = cardVariants.find((v) => v.condition === "Near Mint" && v.price > 0);
        const bestVariant = nearMint ?? cardVariants.find((v) => v.price > 0);
        if (bestVariant) {
          marketPrice = Math.round(bestVariant.price * 100) / 100;
        }
      }

      card = await Card.create({
        justTcgId,
        name: name ?? "Unknown",
        game: game ?? "",
        set: set ?? "",
        setName: setName ?? "",
        rarity: rarity ?? "",
        image: imageUrl,
        tcgplayerId: tcgplayerId ?? null,
        marketPrice,
        internalPrice: marketPrice,
        lastPriceUpdate: marketPrice !== null ? new Date() : null,
        variants: cardVariants,
      });
    }

    // Duplicate check: same shop + card + condition
    const existing = await InventoryItem.findOne({
      shop: userId,
      card: card._id,
      condition: itemCondition,
    });
    if (existing) {
      return NextResponse.json(
        { error: "Dieser Artikel mit diesem Zustand existiert bereits." },
        { status: 409 }
      );
    }

    const item = await InventoryItem.create({
      card: card._id,
      shop: userId,
      condition: itemCondition,
      stock: stock ?? 0,
      sku: tcgplayerSkuId ?? null,
      ean: null,
      notes: null,
      netPrice: null,
    });

    return NextResponse.json({ _id: item._id.toString() }, { status: 201 });
  } catch (err) {
    console.error("[shop/inventory POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Update GET handler to include `condition` and `netPrice`**

Update the `populate` call to include `tcgplayerId` and `setName`:

```typescript
        .populate("card", "name game rarity image tcgplayerId setName set")
```

Update the response mapping:

```typescript
      items: items.map((i) => ({
        _id: i._id.toString(),
        card: i.card,
        condition: i.condition,
        stock: i.stock,
        ean: i.ean,
        sku: i.sku,
        notes: i.notes,
        netPrice: i.netPrice,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
      })),
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: Errors in `shop-inventory-table.tsx` (references `pricePerUnit`) — will be fixed when we replace it.

- [ ] **Step 4: Commit**

```bash
git add app/api/shop/inventory/route.ts
git commit -m "feat: overhaul POST /api/shop/inventory to accept justTcgId and create Card records"
```

---

## Task 6: Update `PATCH /api/shop/inventory/[id]` — Handle `condition` and `netPrice`

**Files:**
- Modify: `app/api/shop/inventory/[id]/route.ts`

- [ ] **Step 1: Update PATCH handler**

Replace the body destructuring:

```typescript
  const { stock, ean, sku, notes, netPrice, condition } = body as {
    stock?: number;
    ean?: string | null;
    sku?: string | null;
    notes?: string | null;
    netPrice?: number | null;
    condition?: string;
  };
```

Add condition validation after stock validation:

```typescript
  if (condition !== undefined) {
    const validConditions = ["Mint", "Near Mint", "Lightly Played", "Moderately Played", "Heavily Played"];
    if (!validConditions.includes(condition)) {
      return NextResponse.json({ error: "Invalid condition" }, { status: 400 });
    }
  }
```

Replace the field update section:

```typescript
    if (stock !== undefined) item.stock = stock;
    if (ean !== undefined) item.ean = ean;
    if (sku !== undefined) item.sku = sku;
    if (notes !== undefined) item.notes = notes;
    if (netPrice !== undefined) item.netPrice = netPrice;
    if (condition !== undefined) item.condition = condition as typeof item.condition;
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: May still have errors from `shop-inventory-table.tsx` — those will be fixed in Task 9.

- [ ] **Step 3: Commit**

```bash
git add app/api/shop/inventory/[id]/route.ts
git commit -m "feat: update PATCH inventory endpoint for condition and netPrice"
```

---

## Task 7: Create `ShopCardSearch` Component

**Files:**
- Create: `components/shop/shop-card-search.tsx`

This is adapted from `components/admin/justtcg-card-search.tsx` but with a list view instead of dropdown, game selector, and `existingInventoryIds` to mark already-added cards.

- [ ] **Step 1: Create the component**

Create `components/shop/shop-card-search.tsx`:

```tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Search, Plus, Loader2, X, ChevronDown, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

interface JustTCGCardResult {
  id: string;
  name: string;
  rarity: string;
  set?: string;
  set_name?: string;
  setName?: string;
  tcgplayerId?: string | null;
  variants?: Array<{ condition: string; printing: string; price: number; tcgplayerSkuId?: string }>;
}

export interface ShopAddCardPayload {
  justTcgId: string;
  name: string;
  game: string;
  set: string;
  setName: string;
  rarity: string;
  tcgplayerId: string | null;
  tcgplayerSkuId: string | null;
  condition: string;
  stock: number;
  variants: Array<{ condition: string; printing: string; price: number }>;
}

interface JustTCGGame {
  id: string;
  name: string;
}

interface JustTCGSet {
  id: string;
  slug: string;
  name: string;
}

interface ShopCardSearchProps {
  existingInventoryIds: Set<string>;
  onAdd: (payload: ShopAddCardPayload) => Promise<void>;
  lang: string;
}

// --- Set Multi-Select Filter (reused from JustTCGCardSearch pattern) ---
function SetFilter({
  sets,
  selectedSets,
  onToggle,
  onClear,
  loading,
  lang,
}: {
  sets: JustTCGSet[];
  selectedSets: Set<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
  loading: boolean;
  lang: string;
}) {
  const isDe = lang === "de";
  const [setQuery, setSetQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!setQuery.trim()) return sets;
    const q = setQuery.toLowerCase();
    return sets.filter((s) => s.name.toLowerCase().includes(q));
  }, [sets, setQuery]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (loading) {
    return (
      <div className="h-[42px] flex items-center text-text-muted text-xs">
        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
        {isDe ? "Sets laden..." : "Loading sets..."}
      </div>
    );
  }

  const selectedList = sets.filter((s) => selectedSets.has(s.id));

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm rounded-[10px] border border-border bg-surface-elevated text-left hover:border-white/15 transition-colors min-h-[42px]"
      >
        <span className="flex-1 min-w-0 truncate text-text-secondary">
          {selectedSets.size === 0
            ? (isDe ? "Sets filtern..." : "Filter by set...")
            : (isDe ? `${selectedSets.size} Set(s) ausgewählt` : `${selectedSets.size} set(s) selected`)}
        </span>
        <ChevronDown className={`w-4 h-4 text-text-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {selectedList.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedList.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-pa-green/10 text-pa-green border border-pa-green/20"
            >
              <span className="truncate max-w-[200px]">{s.name}</span>
              <button
                type="button"
                onClick={() => onToggle(s.id)}
                className="shrink-0 hover:text-white transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] text-text-muted hover:text-text-secondary transition-colors px-1"
          >
            {isDe ? "Alle entfernen" : "Clear all"}
          </button>
        </div>
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-surface-elevated border border-border rounded-[12px] shadow-xl overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
              <input
                type="text"
                value={setQuery}
                onChange={(e) => setSetQuery(e.target.value)}
                placeholder={isDe ? "Set suchen..." : "Search sets..."}
                className="w-full pl-8 pr-3 py-2 text-sm bg-white/4 border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-pa-green/50"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-[240px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-text-muted">
                {isDe ? "Keine Sets gefunden." : "No sets found."}
              </div>
            ) : (
              filtered.map((s) => {
                const isSelected = selectedSets.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onToggle(s.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/4 transition-colors border-b border-border/30 last:border-0"
                  >
                    <span className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center text-[10px] ${isSelected ? "bg-pa-green border-pa-green text-black" : "border-border"}`}>
                      {isSelected && "✓"}
                    </span>
                    <span className="text-sm text-text-primary truncate">{s.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main Component ---
export function ShopCardSearch({ existingInventoryIds, onAdd, lang }: ShopCardSearchProps) {
  const isDe = lang === "de";
  const { toast } = useToast();

  // Game state
  const [games, setGames] = useState<JustTCGGame[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState("");

  // Set state
  const [sets, setSets] = useState<JustTCGSet[]>([]);
  const [setsLoading, setSetsLoading] = useState(false);
  const [selectedSets, setSelectedSets] = useState<Set<string>>(new Set());

  // Search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<JustTCGCardResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  // Fetch games on mount
  useEffect(() => {
    setGamesLoading(true);
    fetch("/api/justtcg/games")
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json() as { games?: JustTCGGame[] };
        const gameList = data.games ?? [];
        setGames(gameList);
        if (gameList.length > 0) setSelectedGame(gameList[0].id);
      })
      .catch(() => {})
      .finally(() => setGamesLoading(false));
  }, []);

  // Fetch sets when game changes
  useEffect(() => {
    if (!selectedGame) return;
    setSetsLoading(true);
    setSelectedSets(new Set());
    fetch(`/api/justtcg/sets?game=${encodeURIComponent(selectedGame)}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json() as { sets?: JustTCGSet[] };
        setSets(data.sets ?? []);
      })
      .catch(() => {})
      .finally(() => setSetsLoading(false));
  }, [selectedGame]);

  function toggleSet(id: string) {
    setSelectedSets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Debounced search
  useEffect(() => {
    const hasSearch = query.length >= 2;
    const hasSets = selectedSets.size > 0;

    if (!hasSearch && !hasSets) {
      setResults([]);
      return;
    }
    if (!selectedGame) return;

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const setIds = Array.from(selectedSets);

        if (setIds.length > 1 && hasSearch) {
          const limit = Math.max(5, Math.floor(20 / setIds.length));
          const fetches = setIds.map(async (setId) => {
            const params = new URLSearchParams({ game: selectedGame, set: setId, limit: String(limit) });
            if (hasSearch) params.set("search", query);
            const res = await fetch(`/api/justtcg/cards?${params.toString()}`);
            if (!res.ok) return [];
            const data = await res.json() as { cards?: JustTCGCardResult[] };
            return data.cards ?? [];
          });
          const allResults = await Promise.all(fetches);
          const seen = new Set<string>();
          const merged: JustTCGCardResult[] = [];
          for (const batch of allResults) {
            for (const card of batch) {
              if (!seen.has(card.id)) {
                seen.add(card.id);
                merged.push(card);
              }
            }
          }
          setResults(merged.slice(0, 20));
        } else {
          const params = new URLSearchParams({ game: selectedGame, limit: "20" });
          if (hasSearch) params.set("search", query);
          if (setIds.length === 1) params.set("set", setIds[0]);
          const res = await fetch(`/api/justtcg/cards?${params.toString()}`);
          if (!res.ok) {
            setResults([]);
            return;
          }
          const data = await res.json() as { cards?: JustTCGCardResult[] };
          setResults(data.cards ?? []);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      setLoading(false);
    };
  }, [query, selectedSets, selectedGame]);

  async function handleAdd(card: JustTCGCardResult) {
    const inventoryKey = `${card.id}_Near Mint`;
    if (existingInventoryIds.has(inventoryKey)) return;
    setAddingId(card.id);

    // Find Near Mint SKU
    const nmVariant = card.variants?.find((v) => v.condition === "Near Mint");
    const tcgplayerSkuId = nmVariant?.tcgplayerSkuId ?? null;

    try {
      await onAdd({
        justTcgId: card.id,
        name: card.name,
        game: selectedGame,
        set: card.set ?? "",
        setName: card.set_name ?? card.setName ?? "",
        rarity: card.rarity,
        tcgplayerId: card.tcgplayerId ?? null,
        tcgplayerSkuId,
        condition: "Near Mint",
        stock: 0,
        variants: card.variants ?? [],
      });
      toast({ type: "success", title: `${card.name} ${isDe ? "hinzugefügt" : "added"}` });
    } catch {
      toast({ type: "error", title: isDe ? "Fehler beim Hinzufügen" : "Failed to add card" });
    } finally {
      setAddingId(null);
    }
  }

  // Get NM price for display
  function getNmPrice(card: JustTCGCardResult): string | null {
    const nm = card.variants?.find((v) => v.condition === "Near Mint" && v.price > 0);
    if (nm) return `$${nm.price.toFixed(2)}`;
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="space-y-3 mb-4">
        {/* Game selector */}
        {gamesLoading ? (
          <div className="h-[42px] flex items-center text-text-muted text-xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
            {isDe ? "Spiele laden..." : "Loading games..."}
          </div>
        ) : (
          <select
            value={selectedGame}
            onChange={(e) => setSelectedGame(e.target.value)}
            className="w-full px-3 py-2.5 text-sm rounded-[10px] border border-border bg-surface-elevated text-text-primary hover:border-white/15 transition-colors"
          >
            {games.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        )}

        {/* Card name search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pa-green animate-spin" />
          )}
          <Input
            placeholder={isDe ? "Karte suchen (mind. 2 Zeichen)..." : "Search cards (min. 2 characters)..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="py-2.5 text-sm pl-9 pr-9"
          />
        </div>

        {/* Set filter */}
        <SetFilter
          sets={sets}
          selectedSets={selectedSets}
          onToggle={toggleSet}
          onClear={() => setSelectedSets(new Set())}
          loading={setsLoading}
          lang={lang}
        />
      </div>

      {/* Results list */}
      <div className="flex-1 overflow-y-auto space-y-1">
        {results.length === 0 && !loading && (query.length >= 2 || selectedSets.size > 0) && (
          <div className="text-center py-8 text-sm text-text-muted">
            {isDe ? "Keine Karten gefunden." : "No cards found."}
          </div>
        )}

        {results.map((card) => {
          const inventoryKey = `${card.id}_Near Mint`;
          const alreadyAdded = existingInventoryIds.has(inventoryKey);
          const isAdding = addingId === card.id;
          const setName = card.set_name ?? card.setName ?? "";
          const nmPrice = getNmPrice(card);

          return (
            <button
              key={card.id}
              type="button"
              disabled={alreadyAdded || isAdding}
              onClick={() => void handleAdd(card)}
              className={[
                "w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg transition-colors",
                alreadyAdded
                  ? "opacity-40 cursor-not-allowed bg-white/2"
                  : "hover:bg-white/4 cursor-pointer",
              ].join(" ")}
            >
              {/* Thumbnail */}
              {card.tcgplayerId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayerId}_200w.jpg`}
                  alt=""
                  className="w-9 h-[50px] object-cover rounded shrink-0"
                  loading="lazy"
                />
              ) : (
                <div className="w-9 h-[50px] bg-white/4 rounded shrink-0 flex items-center justify-center">
                  <span className="text-text-muted text-[10px]">?</span>
                </div>
              )}

              {/* Name + Set */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{card.name}</p>
                <p className="text-xs text-text-muted truncate">
                  {setName}{setName && card.rarity ? " · " : ""}{card.rarity}
                </p>
              </div>

              {/* NM Price */}
              {nmPrice && (
                <span className="shrink-0 text-xs text-text-secondary">{nmPrice}</span>
              )}

              {/* Add button */}
              <span className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full border border-border">
                {isAdding ? (
                  <Loader2 className="w-4 h-4 text-pa-green animate-spin" />
                ) : alreadyAdded ? (
                  <Check className="w-4 h-4 text-text-muted" />
                ) : (
                  <Plus className="w-4 h-4 text-pa-green" />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (component not used yet)

- [ ] **Step 3: Commit**

```bash
git add components/shop/shop-card-search.tsx
git commit -m "feat: add ShopCardSearch component with JustTCG list view"
```

---

## Task 8: Create `ShopInventoryList` Component

**Files:**
- Create: `components/shop/shop-inventory-list.tsx`

Table with inline edit, auto-opens new items in edit mode, condition dropdown triggers SKU update.

- [ ] **Step 1: Create the component**

Create `components/shop/shop-inventory-list.tsx`:

```tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Pencil, Save, X, Trash2, Loader2 } from "lucide-react";

interface CardDoc {
  _id: string;
  name: string;
  game: string;
  rarity: string;
  image: string | null;
  tcgplayerId: string | null;
  setName: string;
  set: string;
}

export interface InventoryItemRow {
  _id: string;
  card: CardDoc;
  condition: string;
  stock: number;
  ean: string | null;
  sku: string | null;
  notes: string | null;
  netPrice: number | null;
}

const CONDITIONS = ["Mint", "Near Mint", "Lightly Played", "Moderately Played", "Heavily Played"] as const;

interface ShopInventoryListProps {
  lang: string;
  newItemId: string | null;
  onNewItemHandled: () => void;
  refreshKey: number;
}

export function ShopInventoryList({ lang, newItemId, onNewItemHandled, refreshKey }: ShopInventoryListProps) {
  const isDe = lang === "de";
  const [items, setItems] = useState<InventoryItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCondition, setEditCondition] = useState("");
  const [editStock, setEditStock] = useState(0);
  const [editNetPrice, setEditNetPrice] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editEan, setEditEan] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/shop/inventory?limit=200");
      const data = (await res.json()) as { items: InventoryItemRow[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Ladefehler");
      } else {
        setItems(data.items ?? []);
      }
    } catch {
      setError("Ladefehler");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchItems(); }, [fetchItems, refreshKey]);

  // Auto-open new item in edit mode
  useEffect(() => {
    if (newItemId && items.length > 0) {
      const newItem = items.find((i) => i._id === newItemId);
      if (newItem) {
        startEdit(newItem);
        onNewItemHandled();
      }
    }
  }, [newItemId, items, onNewItemHandled]);

  function startEdit(item: InventoryItemRow) {
    setEditingId(item._id);
    setEditCondition(item.condition);
    setEditStock(item.stock);
    setEditNetPrice(item.netPrice?.toFixed(2) ?? "");
    setEditSku(item.sku ?? "");
    setEditEan(item.ean ?? "");
    setEditNotes(item.notes ?? "");
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/shop/inventory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condition: editCondition,
          stock: editStock,
          netPrice: editNetPrice ? parseFloat(editNetPrice) : null,
          sku: editSku || null,
          ean: editEan || null,
          notes: editNotes || null,
        }),
      });
      if (res.ok) {
        setEditingId(null);
        await fetchItems();
      } else {
        const data = (await res.json()) as { error?: string };
        alert(data.error ?? "Fehler");
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: string) {
    if (!confirm(isDe ? "Wirklich löschen?" : "Delete this item?")) return;
    const res = await fetch(`/api/shop/inventory/${id}`, { method: "DELETE" });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      alert(data.error ?? "Fehler");
    } else {
      await fetchItems();
    }
  }

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-text-muted text-sm">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        {isDe ? "Lädt..." : "Loading..."}
      </div>
    );
  }
  if (error) return <p className="text-sm text-error py-4">{error}</p>;

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-text-muted text-sm">
        {isDe
          ? "Noch keine Artikel im Inventar. Suche links nach Karten und füge sie hinzu."
          : "No inventory items yet. Search for cards on the left and add them."}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-text-secondary text-xs">
            <th className="py-2 pr-2 w-8"></th>
            <th className="py-2 pr-3">{isDe ? "Karte" : "Card"}</th>
            <th className="py-2 pr-3">{isDe ? "Zustand" : "Condition"}</th>
            <th className="py-2 pr-3">{isDe ? "Bestand" : "Stock"}</th>
            <th className="py-2 pr-3">{isDe ? "Netto-Preis" : "Net Price"}</th>
            <th className="py-2 pr-3">SKU</th>
            <th className="py-2 pr-3">EAN</th>
            <th className="py-2 pr-3">{isDe ? "Notiz" : "Notes"}</th>
            <th className="py-2 w-24"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isEditing = editingId === item._id;
            const card = item.card;
            const imgUrl = card.tcgplayerId
              ? `https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayerId}_200w.jpg`
              : null;

            return (
              <tr key={item._id} className={`border-b border-border/50 ${isEditing ? "bg-white/2" : "hover:bg-white/2"}`}>
                {/* Thumbnail */}
                <td className="py-2 pr-2">
                  {imgUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imgUrl} alt="" className="w-7 h-10 object-cover rounded" loading="lazy" />
                  ) : (
                    <div className="w-7 h-10 bg-white/4 rounded" />
                  )}
                </td>

                {/* Card name + set */}
                <td className="py-2 pr-3">
                  <p className="font-medium text-text-primary truncate max-w-[160px]">{card.name}</p>
                  <p className="text-[11px] text-text-muted truncate max-w-[160px]">{card.setName}</p>
                </td>

                {/* Condition */}
                <td className="py-2 pr-3">
                  {isEditing ? (
                    <select
                      value={editCondition}
                      onChange={(e) => setEditCondition(e.target.value)}
                      className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                    >
                      {CONDITIONS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-text-secondary">{item.condition}</span>
                  )}
                </td>

                {/* Stock */}
                <td className="py-2 pr-3">
                  {isEditing ? (
                    <input
                      type="number"
                      min={0}
                      value={editStock}
                      onChange={(e) => setEditStock(parseInt(e.target.value, 10) || 0)}
                      className="w-16 rounded border border-border bg-background px-2 py-1 text-xs"
                    />
                  ) : (
                    <span className="text-text-secondary">{item.stock}</span>
                  )}
                </td>

                {/* Net Price */}
                <td className="py-2 pr-3">
                  {isEditing ? (
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={editNetPrice}
                        onChange={(e) => setEditNetPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-20 rounded border border-border bg-background px-2 py-1 text-xs pr-5"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-text-muted">€</span>
                    </div>
                  ) : (
                    <span className="text-text-secondary">
                      {item.netPrice != null ? `${item.netPrice.toFixed(2)} €` : "—"}
                    </span>
                  )}
                </td>

                {/* SKU */}
                <td className="py-2 pr-3">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editSku}
                      onChange={(e) => setEditSku(e.target.value)}
                      className="w-24 rounded border border-border bg-background px-2 py-1 text-xs"
                    />
                  ) : (
                    <span className="text-xs text-text-muted truncate max-w-[100px] block">{item.sku ?? "—"}</span>
                  )}
                </td>

                {/* EAN */}
                <td className="py-2 pr-3">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editEan}
                      onChange={(e) => setEditEan(e.target.value)}
                      className="w-24 rounded border border-border bg-background px-2 py-1 text-xs"
                    />
                  ) : (
                    <span className="text-xs text-text-muted truncate max-w-[100px] block">{item.ean ?? "—"}</span>
                  )}
                </td>

                {/* Notes */}
                <td className="py-2 pr-3">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-28 rounded border border-border bg-background px-2 py-1 text-xs"
                    />
                  ) : (
                    <span className="text-xs text-text-muted truncate max-w-[120px] block">{item.notes ?? "—"}</span>
                  )}
                </td>

                {/* Actions */}
                <td className="py-2">
                  {isEditing ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => void saveEdit(item._id)}
                        disabled={saving}
                        className="p-1.5 rounded hover:bg-pa-green/10 text-pa-green transition-colors"
                        title={isDe ? "Speichern" : "Save"}
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1.5 rounded hover:bg-white/5 text-text-muted transition-colors"
                        title={isDe ? "Abbrechen" : "Cancel"}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <button
                        onClick={() => startEdit(item)}
                        className="p-1.5 rounded hover:bg-white/5 text-text-muted hover:text-text-primary transition-colors"
                        title={isDe ? "Bearbeiten" : "Edit"}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => void deleteItem(item._id)}
                        className="p-1.5 rounded hover:bg-error/10 text-text-muted hover:text-error transition-colors"
                        title={isDe ? "Löschen" : "Delete"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (component not used yet)

- [ ] **Step 3: Commit**

```bash
git add components/shop/shop-inventory-list.tsx
git commit -m "feat: add ShopInventoryList component with inline edit and auto-edit-mode"
```

---

## Task 9: Create `ShopInventoryManager` Container

**Files:**
- Create: `components/shop/shop-inventory-manager.tsx`
- Modify: `app/[lang]/(dashboard)/shop/inventory/page.tsx`
- Delete: `components/shop/shop-inventory-table.tsx`
- Delete: `app/api/cards/route.ts`

- [ ] **Step 1: Create the manager component**

Create `components/shop/shop-inventory-manager.tsx`:

```tsx
"use client";

import React, { useState, useCallback } from "react";
import { Search, Layers } from "lucide-react";
import { ShopCardSearch, ShopAddCardPayload } from "./shop-card-search";
import { ShopInventoryList } from "./shop-inventory-list";

interface ShopInventoryManagerProps {
  lang: string;
}

export function ShopInventoryManager({ lang }: ShopInventoryManagerProps) {
  const isDe = lang === "de";

  // Track existing inventory card+condition combos for duplicate marking
  const [existingInventoryIds, setExistingInventoryIds] = useState<Set<string>>(new Set());
  const [newItemId, setNewItemId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Mobile tab state
  const [activeTab, setActiveTab] = useState<"search" | "inventory">("search");
  const [inventoryCount, setInventoryCount] = useState(0);

  const handleAdd = useCallback(async (payload: ShopAddCardPayload) => {
    const res = await fetch("/api/shop/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      throw new Error(data.error ?? "Failed to add");
    }

    const data = (await res.json()) as { _id: string };

    // Mark as existing
    setExistingInventoryIds((prev) => {
      const next = new Set(prev);
      next.add(`${payload.justTcgId}_${payload.condition}`);
      return next;
    });

    // Trigger inventory list refresh and auto-edit
    setNewItemId(data._id);
    setRefreshKey((k) => k + 1);

    // Switch to inventory tab on mobile
    setActiveTab("inventory");
  }, []);

  const handleNewItemHandled = useCallback(() => {
    setNewItemId(null);
  }, []);

  return (
    <div className="h-full">
      {/* Mobile tabs - only visible below lg */}
      <div className="flex lg:hidden border-b border-border mb-4">
        <button
          onClick={() => setActiveTab("search")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "search"
              ? "border-pa-green text-pa-green"
              : "border-transparent text-text-muted hover:text-text-secondary"
          }`}
        >
          <Search className="w-4 h-4" />
          {isDe ? "Suche" : "Search"}
        </button>
        <button
          onClick={() => setActiveTab("inventory")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "inventory"
              ? "border-pa-green text-pa-green"
              : "border-transparent text-text-muted hover:text-text-secondary"
          }`}
        >
          <Layers className="w-4 h-4" />
          {isDe ? "Inventar" : "Inventory"}
        </button>
      </div>

      {/* Desktop: Two columns / Mobile: Tab content */}
      <div className="flex gap-6 h-[calc(100vh-200px)]">
        {/* Left column: Search */}
        <div className={`lg:w-[40%] lg:border-r lg:border-border lg:pr-6 overflow-y-auto ${
          activeTab === "search" ? "block" : "hidden lg:block"
        }`}>
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
            {isDe ? "Kartensuche" : "Card Search"}
          </h3>
          <ShopCardSearch
            existingInventoryIds={existingInventoryIds}
            onAdd={handleAdd}
            lang={lang}
          />
        </div>

        {/* Right column: Inventory */}
        <div className={`lg:flex-1 overflow-y-auto ${
          activeTab === "inventory" ? "block" : "hidden lg:block"
        }`}>
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
            {isDe ? "Mein Inventar" : "My Inventory"}
          </h3>
          <ShopInventoryList
            lang={lang}
            newItemId={newItemId}
            onNewItemHandled={handleNewItemHandled}
            refreshKey={refreshKey}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update the shop inventory page**

Replace `app/[lang]/(dashboard)/shop/inventory/page.tsx`:

```tsx
import { ShopInventoryManager } from "@/components/shop/shop-inventory-manager";

export default async function ShopInventoryPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const isDe = lang === "de";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {isDe ? "Inventar-Verwaltung" : "Inventory Management"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {isDe
            ? "Suche Karten und verwalte deinen Bestand mit Zustand und Netto-Preisen."
            : "Search cards and manage your stock with condition and net prices."}
        </p>
      </div>
      <ShopInventoryManager lang={lang} />
    </div>
  );
}
```

- [ ] **Step 3: Delete old files**

Delete `components/shop/shop-inventory-table.tsx` and `app/api/cards/route.ts`.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS — all old references replaced.

- [ ] **Step 5: Commit**

```bash
git add components/shop/shop-inventory-manager.tsx app/[lang]/(dashboard)/shop/inventory/page.tsx
git rm components/shop/shop-inventory-table.tsx app/api/cards/route.ts
git commit -m "feat: replace shop inventory UI with two-column layout and JustTCG search"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | InventoryItem model: `condition`, `netPrice`, new unique index | `models/inventory-item.ts` |
| 2 | ShopProfile model: `isSmallBusiness` | `models/shop-profile.ts` |
| 3 | JustTCG routes: add `"shop"` role | 4 API routes |
| 4 | Shop apply: Kleinunternehmer checkbox | form + API |
| 5 | POST /api/shop/inventory: accept `justTcgId` | API route |
| 6 | PATCH inventory: handle `condition` + `netPrice` | API route |
| 7 | ShopCardSearch component | new component |
| 8 | ShopInventoryList component | new component |
| 9 | ShopInventoryManager + page update + cleanup | container + page + deletions |
