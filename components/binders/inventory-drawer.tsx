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
