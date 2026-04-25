"use client";

import { useDroppable, useDraggable } from "@dnd-kit/core";
import { motion } from "motion/react";
import { Layers } from "lucide-react";
import type { CSSProperties } from "react";
import type { InventoryCard } from "@/lib/binders/inventory";

export interface SpreadDragSource {
  packPullId: string;
  pageIndex: number;
  slotPosition: number;
}

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

interface ThemeShape {
  key: string;
  accent: string;
  swatchClass: string;
}

interface BinderSpreadProps {
  theme: ThemeShape;
  leftPage: BinderPageDTO | null;
  rightPage: BinderPageDTO | null;
  leftPageIndex: number;
  rightPageIndex: number;
  cardLookup: (packPullId: string) => InventoryCard | undefined;
}

export function BinderSpread({
  theme,
  leftPage,
  rightPage,
  leftPageIndex,
  rightPageIndex,
  cardLookup,
}: BinderSpreadProps) {
  return (
    <div
      className="bg-surface border border-border rounded-2xl p-4 md:p-6"
      style={{ ["--binder-accent" as never]: theme.accent } as CSSProperties}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {leftPage ? (
          <Page
            page={leftPage}
            pageIndex={leftPageIndex}
            theme={theme}
            cardLookup={cardLookup}
          />
        ) : (
          <div />
        )}
        {rightPage ? (
          <Page
            page={rightPage}
            pageIndex={rightPageIndex}
            theme={theme}
            cardLookup={cardLookup}
          />
        ) : (
          <div className="hidden md:block" />
        )}
      </div>
    </div>
  );
}

function Page({
  page,
  pageIndex,
  theme,
  cardLookup,
}: {
  page: BinderPageDTO;
  pageIndex: number;
  theme: ThemeShape;
  cardLookup: (packPullId: string) => InventoryCard | undefined;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-text-secondary">
          {page.title ?? `—`}
        </h3>
        <span className="text-xs text-text-muted">{pageIndex + 1}</span>
      </div>
      <div
        className={`p-3 rounded-xl ${theme.swatchClass} grid grid-cols-3 gap-2.5`}
      >
        {Array.from({ length: 9 }, (_, i) => {
          const slot = page.slots.find((s) => s.position === i);
          return (
            <Slot
              key={i}
              pageIndex={pageIndex}
              slotPosition={i}
              packPullId={slot?.packPullId ?? null}
              expectedCardId={slot?.expectedCardId ?? null}
              note={slot?.note ?? null}
              cardLookup={cardLookup}
            />
          );
        })}
      </div>
    </div>
  );
}

function Slot({
  pageIndex,
  slotPosition,
  packPullId,
  expectedCardId,
  cardLookup,
}: {
  pageIndex: number;
  slotPosition: number;
  packPullId: string | null;
  expectedCardId: string | null;
  note: string | null;
  cardLookup: (packPullId: string) => InventoryCard | undefined;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot:${pageIndex}:${slotPosition}`,
    data: { kind: "slot", pageIndex, slotPosition },
  });
  const card = packPullId ? cardLookup(packPullId) : undefined;

  return (
    <div
      ref={setNodeRef}
      className={[
        "relative aspect-[5/7] rounded-md transition-all",
        isOver
          ? "ring-2 ring-white/80 scale-[1.02] shadow-lg"
          : "ring-1 ring-white/15",
        packPullId
          ? "bg-black/20"
          : expectedCardId
            ? "bg-black/30"
            : "bg-black/10",
      ].join(" ")}
    >
      {packPullId && card ? (
        <SlotDraggableCard
          packPullId={packPullId}
          pageIndex={pageIndex}
          slotPosition={slotPosition}
          card={card}
        />
      ) : packPullId ? (
        <div className="w-full h-full flex items-center justify-center bg-black/30 rounded-md">
          <Layers className="w-5 h-5 text-white/40" />
        </div>
      ) : expectedCardId ? (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white/40 px-1 text-center">
          ?
        </div>
      ) : null}
    </div>
  );
}

function SlotDraggableCard({
  packPullId,
  pageIndex,
  slotPosition,
  card,
}: {
  packPullId: string;
  pageIndex: number;
  slotPosition: number;
  card: InventoryCard;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `slotcard:${pageIndex}:${slotPosition}`,
    data: {
      kind: "slot",
      packPullId,
      pageIndex,
      slotPosition,
    } as SpreadDragSource & { kind: "slot" },
  });
  return (
    <motion.div
      layoutId={`card-${packPullId}`}
      initial={false}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      className={[
        "absolute inset-0 rounded-md overflow-hidden",
        isDragging ? "opacity-30" : "",
      ].join(" ")}
    >
      <button
        ref={setNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        className="absolute inset-0 rounded-md overflow-hidden cursor-grab active:cursor-grabbing touch-none"
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
          <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-[10px] text-white/60 px-1 text-center">
            {card.name}
          </div>
        )}
      </button>
    </motion.div>
  );
}
