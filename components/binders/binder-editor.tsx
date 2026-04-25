"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Layers,
  Loader2,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { fetchInventory, type InventoryCard } from "@/lib/binders/inventory";
import { BINDER_THEMES } from "./theme-picker";
import { BinderSpread, type SpreadDragSource } from "./binder-spread";
import { InventoryDrawer } from "./inventory-drawer";
import { CardDragOverlay } from "./card-drag-overlay";

interface BinderSlotDTO {
  position: number;
  packPullId: string | null;
  expectedCardId: string | null;
  note: string | null;
}
interface BinderPageDTO {
  title: string | null;
  backgroundId: string | null;
  slots: BinderSlotDTO[];
}
export interface BinderDTO {
  _id: string;
  userId: string;
  slug: string;
  name: string;
  description: string;
  type: "free" | "set-template";
  setTemplate: { game: string; set: string } | null;
  theme: string;
  coverPackPullId: string | null;
  pages: BinderPageDTO[];
  isPublic: boolean;
  publishedAt: string | null;
  likeCount: number;
  viewCount: number;
  cardCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlacedCardDTO {
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

interface BinderEditorProps {
  initialBinder: BinderDTO;
  placedCards: PlacedCardDTO[];
  lang: string;
}

export interface SlotDropTarget {
  pageIndex: number;
  slotPosition: number;
}

export type DragSource =
  | { kind: "inventory"; card: InventoryCard }
  | ({ kind: "slot" } & SpreadDragSource);

export function BinderEditor({
  initialBinder,
  placedCards,
  lang,
}: BinderEditorProps) {
  const isDe = lang === "de";
  const router = useRouter();
  const { toast } = useToast();

  const [binder, setBinder] = useState<BinderDTO>(initialBinder);
  const [inventory, setInventory] = useState<InventoryCard[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [spreadIndex, setSpreadIndex] = useState(0);
  const [savingOp, setSavingOp] = useState(false);
  const [activeDrag, setActiveDrag] = useState<DragSource | null>(null);
  const [placedById, setPlacedById] = useState<Map<string, PlacedCardDTO>>(
    () => {
      const map = new Map<string, PlacedCardDTO>();
      for (const c of placedCards) map.set(c.packPullId, c);
      return map;
    },
  );

  const inventoryById = useMemo(() => {
    const map = new Map<string, InventoryCard>();
    for (const c of inventory) map.set(c.packPullId, c);
    return map;
  }, [inventory]);

  const cardLookup = useCallback(
    (packPullId: string): InventoryCard | undefined => {
      return inventoryById.get(packPullId) ?? placedById.get(packPullId);
    },
    [inventoryById, placedById],
  );

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

  // After every server response, fold the new placed-cards into the local map
  // so cards moved into a slot via swap remain renderable even if they were
  // outside both the current inventory and the initial placedCards.
  useEffect(() => {
    setPlacedById((prev) => {
      const next = new Map(prev);
      for (const c of inventory) {
        if (!next.has(c.packPullId)) next.set(c.packPullId, c);
      }
      return next;
    });
  }, [inventory]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor),
  );

  const totalSpreads = Math.max(1, Math.ceil(binder.pages.length / 2));
  const leftPageIndex = spreadIndex * 2;
  const rightPageIndex = leftPageIndex + 1;

  const goPrev = useCallback(() => {
    setSpreadIndex((i) => Math.max(0, i - 1));
  }, []);
  const goNext = useCallback(() => {
    setSpreadIndex((i) => Math.min(totalSpreads - 1, i + 1));
  }, [totalSpreads]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as DragSource | undefined;
    if (data) setActiveDrag(data);
  }, []);

  const performSlotOp = useCallback(
    async (body: Record<string, unknown>) => {
      setSavingOp(true);
      try {
        const res = await fetch(`/api/binders/${binder.slug}/slots`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast({
            type: "error",
            title: isDe ? "Aktion fehlgeschlagen." : "Action failed.",
            message:
              typeof err?.error === "string" ? err.error : undefined,
          });
          return false;
        }
        const data = (await res.json()) as { binder: BinderDTO };
        setBinder(data.binder);
        return true;
      } catch {
        toast({
          type: "error",
          title: isDe ? "Netzwerkfehler." : "Network error.",
        });
        return false;
      } finally {
        setSavingOp(false);
      }
    },
    [binder.slug, toast, isDe],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const drag = activeDrag;
      setActiveDrag(null);
      const over = event.over;
      if (!drag || !over) return;
      const overData = over.data.current as
        | { kind: "slot"; pageIndex: number; slotPosition: number }
        | undefined;
      if (!overData || overData.kind !== "slot") return;

      if (drag.kind === "inventory") {
        const slot = binder.pages[overData.pageIndex]?.slots.find(
          (s) => s.position === overData.slotPosition,
        );
        const expectedCurrent = slot?.packPullId ?? null;
        const ok = await performSlotOp({
          op: "place",
          packPullId: drag.card.packPullId,
          pageIndex: overData.pageIndex,
          slotPosition: overData.slotPosition,
          expectedCurrent,
        });
        if (ok) {
          await reloadInventory();
        }
      } else {
        // dragging a slot card to another slot
        const fromCoord = {
          pageIndex: drag.pageIndex,
          slotPosition: drag.slotPosition,
        };
        const toCoord = {
          pageIndex: overData.pageIndex,
          slotPosition: overData.slotPosition,
        };
        if (
          fromCoord.pageIndex === toCoord.pageIndex &&
          fromCoord.slotPosition === toCoord.slotPosition
        ) {
          return;
        }
        const ok = await performSlotOp({
          op: "swap",
          from: fromCoord,
          to: toCoord,
        });
        if (ok) await reloadInventory();
      }
    },
    [activeDrag, binder.pages, performSlotOp, reloadInventory],
  );

  const theme =
    BINDER_THEMES.find((t) => t.key === binder.theme) ?? BINDER_THEMES[0];

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => router.push(`/${lang}/binders`)}
              className="text-text-secondary hover:text-text-primary inline-flex items-center gap-1.5 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              {isDe ? "Binder" : "Binders"}
            </button>
            <span className="text-text-muted">/</span>
            <h1 className="text-xl font-bold text-text-primary line-clamp-1">
              {binder.name}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary inline-flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              {binder.cardCount} {isDe ? "Karten" : "cards"}
            </span>
            {savingOp && (
              <span className="text-xs text-text-muted inline-flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {isDe ? "Speichert…" : "Saving…"}
              </span>
            )}
          </div>
        </div>

        <BinderSpread
          theme={theme}
          leftPage={binder.pages[leftPageIndex] ?? null}
          rightPage={binder.pages[rightPageIndex] ?? null}
          leftPageIndex={leftPageIndex}
          rightPageIndex={rightPageIndex}
          cardLookup={cardLookup}
        />

        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={goPrev}
            disabled={spreadIndex === 0}
            className="bg-surface border border-border rounded-lg p-2 hover:border-pa-green/30 disabled:opacity-40 transition-colors"
            aria-label={isDe ? "Vorherige Seite" : "Previous page"}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-text-secondary">
            {isDe ? "Seite" : "Page"} {leftPageIndex + 1}
            {rightPageIndex < binder.pages.length
              ? `–${rightPageIndex + 1}`
              : ""}{" "}
            / {binder.pages.length}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={spreadIndex >= totalSpreads - 1}
            className="bg-surface border border-border rounded-lg p-2 hover:border-pa-green/30 disabled:opacity-40 transition-colors"
            aria-label={isDe ? "Nächste Seite" : "Next page"}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <InventoryDrawer
          open={drawerOpen}
          onToggle={() => setDrawerOpen((v) => !v)}
          inventory={inventory}
          loading={inventoryLoading}
          isDe={isDe}
        />
      </div>

      <DragOverlay>
        {activeDrag ? (
          <CardDragOverlay
            card={
              activeDrag.kind === "inventory"
                ? activeDrag.card
                : (cardLookup(activeDrag.packPullId) ?? null)
            }
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
