"use client";

import { useDroppable, useDraggable } from "@dnd-kit/core";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Layers } from "lucide-react";
import type { CSSProperties } from "react";
import type { InventoryCard } from "@/lib/binders/inventory";
import type { ExpectedCardDTO } from "./binder-editor";
import { PageTitleEditor } from "./page-title-editor";

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
  spreadIndex: number;
  flipDirection: number;
  cardLookup: (packPullId: string) => InventoryCard | undefined;
  expectedLookup?: (cardId: string) => ExpectedCardDTO | undefined;
  binderSlug?: string;
  isDe?: boolean;
  ownerView?: boolean;
  onSlotClick?: (pageIndex: number, slotPosition: number) => void;
  onPageTitleSaved?: (pageIndex: number, nextTitle: string | null) => void;
}

const flipVariants = {
  enter: (direction: number) => ({
    rotateY: direction >= 0 ? -90 : 90,
    opacity: 0,
  }),
  center: { rotateY: 0, opacity: 1 },
  exit: (direction: number) => ({
    rotateY: direction >= 0 ? 90 : -90,
    opacity: 0,
  }),
} as const;

export function BinderSpread({
  theme,
  leftPage,
  rightPage,
  leftPageIndex,
  rightPageIndex,
  spreadIndex,
  flipDirection,
  cardLookup,
  expectedLookup,
  binderSlug,
  isDe = false,
  ownerView = false,
  onSlotClick,
  onPageTitleSaved,
}: BinderSpreadProps) {
  const direction = flipDirection;
  const reduced = useReducedMotion();

  const containerStyle: CSSProperties = {
    perspective: reduced ? undefined : 1800,
    ["--binder-accent" as never]: theme.accent,
  };

  return (
    <div
      className="bg-surface border border-border rounded-2xl p-4 md:p-6"
      style={containerStyle}
    >
      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.div
          key={spreadIndex}
          custom={direction}
          variants={reduced ? undefined : flipVariants}
          initial={reduced ? { opacity: 0 } : "enter"}
          animate={reduced ? { opacity: 1 } : "center"}
          exit={reduced ? { opacity: 0 } : "exit"}
          transition={
            reduced
              ? { duration: 0.18 }
              : { type: "spring", stiffness: 110, damping: 18 }
          }
          style={{ transformStyle: reduced ? undefined : "preserve-3d" }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6"
        >
          {leftPage ? (
            <Page
              page={leftPage}
              pageIndex={leftPageIndex}
              theme={theme}
              cardLookup={cardLookup}
              expectedLookup={expectedLookup}
              binderSlug={binderSlug}
              isDe={isDe}
              ownerView={ownerView}
              onSlotClick={onSlotClick}
              onPageTitleSaved={onPageTitleSaved}
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
              expectedLookup={expectedLookup}
              binderSlug={binderSlug}
              isDe={isDe}
              ownerView={ownerView}
              onSlotClick={onSlotClick}
              onPageTitleSaved={onPageTitleSaved}
            />
          ) : (
            <div className="hidden md:block" />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Page({
  page,
  pageIndex,
  theme,
  cardLookup,
  expectedLookup,
  binderSlug,
  isDe,
  ownerView,
  onSlotClick,
  onPageTitleSaved,
}: {
  page: BinderPageDTO;
  pageIndex: number;
  theme: ThemeShape;
  cardLookup: (packPullId: string) => InventoryCard | undefined;
  expectedLookup?: (cardId: string) => ExpectedCardDTO | undefined;
  binderSlug?: string;
  isDe: boolean;
  ownerView: boolean;
  onSlotClick?: (pageIndex: number, slotPosition: number) => void;
  onPageTitleSaved?: (pageIndex: number, nextTitle: string | null) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        {ownerView && binderSlug && onPageTitleSaved ? (
          <PageTitleEditor
            pageIndex={pageIndex}
            initialTitle={page.title}
            binderSlug={binderSlug}
            isDe={isDe}
            onSaved={(next) => onPageTitleSaved(pageIndex, next)}
          />
        ) : (
          <h3 className="text-sm font-semibold text-text-secondary">
            {page.title ?? "—"}
          </h3>
        )}
        <span className="text-xs text-text-muted">{pageIndex + 1}</span>
      </div>
      <div
        className={`p-3 rounded-xl ${theme.swatchClass} grid grid-cols-3 gap-2.5`}
      >
        {Array.from({ length: 9 }, (_, i) => {
          const slot = page.slots.find((s) => s.position === i);
          const expected = slot?.expectedCardId
            ? (expectedLookup?.(slot.expectedCardId) ?? null)
            : null;
          return (
            <Slot
              key={i}
              pageIndex={pageIndex}
              slotPosition={i}
              packPullId={slot?.packPullId ?? null}
              expectedCardId={slot?.expectedCardId ?? null}
              expectedCard={expected}
              note={slot?.note ?? null}
              cardLookup={cardLookup}
              ownerView={ownerView}
              onClick={onSlotClick}
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
  expectedCard,
  cardLookup,
  ownerView,
  onClick,
}: {
  pageIndex: number;
  slotPosition: number;
  packPullId: string | null;
  expectedCardId: string | null;
  expectedCard: ExpectedCardDTO | null;
  note: string | null;
  cardLookup: (packPullId: string) => InventoryCard | undefined;
  ownerView: boolean;
  onClick?: (pageIndex: number, slotPosition: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot:${pageIndex}:${slotPosition}`,
    data: { kind: "slot", pageIndex, slotPosition },
  });
  const card = packPullId ? cardLookup(packPullId) : undefined;

  const slotLabel = packPullId
    ? `Slot ${slotPosition + 1}: ${card?.name ?? "card"}`
    : expectedCardId
      ? `Slot ${slotPosition + 1}: empty (expects ${expectedCard?.name ?? "card"})`
      : `Slot ${slotPosition + 1}: empty`;

  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label={slotLabel}
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
          ownerView={ownerView}
          onClick={onClick}
        />
      ) : packPullId ? (
        <div className="w-full h-full flex items-center justify-center bg-black/30 rounded-md">
          <Layers className="w-5 h-5 text-white/40" />
        </div>
      ) : expectedCardId ? (
        <ExpectedPlaceholder card={expectedCard} />
      ) : null}
    </div>
  );
}

function SlotDraggableCard({
  packPullId,
  pageIndex,
  slotPosition,
  card,
  ownerView,
  onClick,
}: {
  packPullId: string;
  pageIndex: number;
  slotPosition: number;
  card: InventoryCard;
  ownerView: boolean;
  onClick?: (pageIndex: number, slotPosition: number) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `slotcard:${pageIndex}:${slotPosition}`,
    data: {
      kind: "slot",
      packPullId,
      pageIndex,
      slotPosition,
    } as SpreadDragSource & { kind: "slot" },
    disabled: !ownerView,
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
      {ownerView ? (
        <button
          ref={setNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          onClick={() => onClick?.(pageIndex, slotPosition)}
          className="absolute inset-0 rounded-md overflow-hidden cursor-grab active:cursor-grabbing touch-none"
          title={card.name}
        >
          <CardImage card={card} />
        </button>
      ) : (
        <div className="absolute inset-0 rounded-md overflow-hidden">
          <CardImage card={card} />
        </div>
      )}
    </motion.div>
  );
}

function ExpectedPlaceholder({ card }: { card: ExpectedCardDTO | null }) {
  return (
    <div className="absolute inset-0 rounded-md overflow-hidden">
      {card?.image ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={card.image}
          alt={card.name}
          className="object-cover w-full h-full opacity-25 grayscale"
          draggable={false}
        />
      ) : null}
      <div className="absolute inset-0 flex items-end justify-center p-1">
        <span className="text-[9px] text-white/70 bg-black/60 rounded px-1 py-0.5 line-clamp-1">
          {card?.name ?? "?"}
        </span>
      </div>
    </div>
  );
}

function CardImage({ card }: { card: InventoryCard }) {
  if (card.image) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={card.image}
        alt={card.name}
        className="object-cover w-full h-full"
        draggable={false}
      />
    );
  }
  return (
    <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-[10px] text-white/60 px-1 text-center">
      {card.name}
    </div>
  );
}
