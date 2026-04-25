"use client";

import { useDroppable, useDraggable } from "@dnd-kit/core";
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  useReducedMotion,
} from "motion/react";
import { Layers } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
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
  pages: BinderPageDTO[];
  spreadIndex: number;
  onSpreadChange: (next: number) => void;
  cardLookup: (packPullId: string) => InventoryCard | undefined;
  expectedLookup?: (cardId: string) => ExpectedCardDTO | undefined;
  binderSlug?: string;
  isDe?: boolean;
  ownerView?: boolean;
  onSlotClick?: (pageIndex: number, slotPosition: number) => void;
  onPageTitleSaved?: (pageIndex: number, nextTitle: string | null) => void;
}

type FlipDirection = "forward" | "backward";

const FLIP_THRESHOLD = 0.45;
const FLIP_SPRING = { type: "spring" as const, stiffness: 110, damping: 22 };

export function BinderSpread({
  theme,
  pages,
  spreadIndex,
  onSpreadChange,
  cardLookup,
  expectedLookup,
  binderSlug,
  isDe = false,
  ownerView = false,
  onSlotClick,
  onPageTitleSaved,
}: BinderSpreadProps) {
  const reduced = useReducedMotion();
  const totalSpreads = Math.max(1, Math.ceil(pages.length / 2));
  const leftPageIndex = spreadIndex * 2;
  const rightPageIndex = leftPageIndex + 1;

  const spreadRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState(0);
  useEffect(() => {
    function measure() {
      const el = spreadRef.current;
      if (!el) return;
      setPageWidth(el.clientWidth / 2);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Progress motion value — independent of direction; mapped to rotateY at use site.
  // 0 = idle (no flip), 1 = fully flipped to the other side.
  const progress = useMotionValue(0);
  const [activeFlip, setActiveFlip] = useState<FlipDirection | null>(null);

  const canForward = spreadIndex < totalSpreads - 1;
  const canBackward = spreadIndex > 0;

  const commitFlip = useCallback(
    (direction: FlipDirection) => {
      const delta = direction === "forward" ? 1 : -1;
      onSpreadChange(spreadIndex + delta);
      // Reset progress synchronously so the new spread renders flat.
      progress.set(0);
      setActiveFlip(null);
    },
    [onSpreadChange, spreadIndex, progress],
  );

  const triggerProgrammaticFlip = useCallback(
    (direction: FlipDirection) => {
      if (activeFlip) return;
      if (direction === "forward" && !canForward) return;
      if (direction === "backward" && !canBackward) return;
      if (reduced) {
        commitFlip(direction);
        return;
      }
      setActiveFlip(direction);
      animate(progress, 1, {
        type: "spring",
        stiffness: 90,
        damping: 18,
        onComplete: () => commitFlip(direction),
      });
    },
    [activeFlip, canForward, canBackward, reduced, commitFlip, progress],
  );

  // Expose imperative navigation to the parent via the same callback.
  // Parent's chevron handlers call onSpreadChange directly which we override
  // here by intercepting via ref. Simpler: parent calls our flip via ref API.
  // Since we're not exposing a ref handle, parent uses a state delta. We mirror
  // parent state changes: when spreadIndex prop changes WITHOUT a flip in
  // progress, treat it as a programmatic jump (no animation).
  // (We do not animate here; parent's chevrons should ideally call a ref-based
  // flip; for now they just bump spreadIndex and the spread updates instantly.)

  const handleDragStart = useCallback((direction: FlipDirection) => {
    setActiveFlip(direction);
  }, []);

  const handleDrag = useCallback(
    (direction: FlipDirection, deltaX: number) => {
      if (pageWidth <= 0) return;
      const distance =
        direction === "forward" ? Math.max(0, -deltaX) : Math.max(0, deltaX);
      const next = Math.min(1, distance / pageWidth);
      progress.set(next);
    },
    [pageWidth, progress],
  );

  const handleDragEnd = useCallback(
    (direction: FlipDirection) => {
      const value = progress.get();
      if (value >= FLIP_THRESHOLD) {
        animate(progress, 1, {
          ...FLIP_SPRING,
          onComplete: () => commitFlip(direction),
        });
      } else {
        animate(progress, 0, {
          ...FLIP_SPRING,
          onComplete: () => setActiveFlip(null),
        });
      }
    },
    [progress, commitFlip],
  );

  // The flipping sheet's rotateY: forward goes 0 → -180, backward 0 → 180.
  const flipRotateY = useTransform(progress, (p) =>
    activeFlip === "backward" ? p * 180 : p * -180,
  );

  // Pages currently visible.
  const currentLeft = pages[leftPageIndex] ?? null;
  const currentRight = pages[rightPageIndex] ?? null;
  // Pages on the side we're flipping toward.
  const nextLeftIndex = leftPageIndex + 2;
  const nextRightIndex = leftPageIndex + 3;
  const prevLeftIndex = leftPageIndex - 2;
  const prevRightIndex = leftPageIndex - 1;
  const nextLeft = pages[nextLeftIndex] ?? null;
  const nextRight = pages[nextRightIndex] ?? null;
  const prevLeft = pages[prevLeftIndex] ?? null;
  const prevRight = pages[prevRightIndex] ?? null;

  return (
    <div
      className="bg-surface border border-border rounded-2xl p-4 md:p-6 relative"
      style={{ ["--binder-accent" as never]: theme.accent } as CSSProperties}
    >
      <div
        ref={spreadRef}
        className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 relative"
        style={{
          perspective: reduced ? undefined : 1800,
          minHeight: 320,
        }}
      >
        {/* Bottom layer: the spread we are flipping toward, revealed as the
            top sheet rotates away. We always render BOTH next and prev so the
            destination is ready the moment a drag starts in either direction. */}
        {activeFlip === "forward" && (
          <>
            <div
              className="hidden md:block"
              style={{ gridColumn: "1 / 2", gridRow: "1" }}
            >
              {nextLeft ? (
                <Page
                  page={nextLeft}
                  pageIndex={nextLeftIndex}
                  theme={theme}
                  cardLookup={cardLookup}
                  expectedLookup={expectedLookup}
                  binderSlug={binderSlug}
                  isDe={isDe}
                  ownerView={false}
                />
              ) : (
                <EmptyPagePlaceholder theme={theme} />
              )}
            </div>
            <div style={{ gridColumn: "2 / 3", gridRow: "1" }}>
              {nextRight ? (
                <Page
                  page={nextRight}
                  pageIndex={nextRightIndex}
                  theme={theme}
                  cardLookup={cardLookup}
                  expectedLookup={expectedLookup}
                  binderSlug={binderSlug}
                  isDe={isDe}
                  ownerView={false}
                />
              ) : (
                <EmptyPagePlaceholder theme={theme} />
              )}
            </div>
          </>
        )}
        {activeFlip === "backward" && (
          <>
            <div
              className="hidden md:block"
              style={{ gridColumn: "1 / 2", gridRow: "1" }}
            >
              {prevLeft ? (
                <Page
                  page={prevLeft}
                  pageIndex={prevLeftIndex}
                  theme={theme}
                  cardLookup={cardLookup}
                  expectedLookup={expectedLookup}
                  binderSlug={binderSlug}
                  isDe={isDe}
                  ownerView={false}
                />
              ) : (
                <EmptyPagePlaceholder theme={theme} />
              )}
            </div>
            <div style={{ gridColumn: "2 / 3", gridRow: "1" }}>
              {prevRight ? (
                <Page
                  page={prevRight}
                  pageIndex={prevRightIndex}
                  theme={theme}
                  cardLookup={cardLookup}
                  expectedLookup={expectedLookup}
                  binderSlug={binderSlug}
                  isDe={isDe}
                  ownerView={false}
                />
              ) : (
                <EmptyPagePlaceholder theme={theme} />
              )}
            </div>
          </>
        )}

        {/* Static current spread. The half being flipped is visually replaced
            by the flipping sheet, so we only render the stationary half during
            an active flip to avoid double-painting. */}
        {activeFlip !== "forward" ? (
          <div style={{ gridColumn: "1 / 2", gridRow: "1", zIndex: 1 }}>
            {currentLeft ? (
              <Page
                page={currentLeft}
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
              <EmptyPagePlaceholder theme={theme} />
            )}
          </div>
        ) : (
          <div className="hidden md:block" />
        )}
        {activeFlip !== "backward" ? (
          <div
            className="hidden md:block"
            style={{ gridColumn: "2 / 3", gridRow: "1", zIndex: 1 }}
          >
            {currentRight ? (
              <Page
                page={currentRight}
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
              <EmptyPagePlaceholder theme={theme} />
            )}
          </div>
        ) : (
          <div className="hidden md:block" />
        )}

        {/* Flipping sheet — only mounted during an active flip. */}
        {activeFlip && pageWidth > 0 && (
          <FlipSheet
            direction={activeFlip}
            rotateY={flipRotateY}
            pageWidth={pageWidth}
            front={
              activeFlip === "forward" ? (
                currentRight ? (
                  <Page
                    page={currentRight}
                    pageIndex={rightPageIndex}
                    theme={theme}
                    cardLookup={cardLookup}
                    expectedLookup={expectedLookup}
                    isDe={isDe}
                    ownerView={false}
                  />
                ) : (
                  <EmptyPagePlaceholder theme={theme} />
                )
              ) : currentLeft ? (
                <Page
                  page={currentLeft}
                  pageIndex={leftPageIndex}
                  theme={theme}
                  cardLookup={cardLookup}
                  expectedLookup={expectedLookup}
                  isDe={isDe}
                  ownerView={false}
                />
              ) : (
                <EmptyPagePlaceholder theme={theme} />
              )
            }
            back={
              activeFlip === "forward" ? (
                nextLeft ? (
                  <Page
                    page={nextLeft}
                    pageIndex={nextLeftIndex}
                    theme={theme}
                    cardLookup={cardLookup}
                    expectedLookup={expectedLookup}
                    isDe={isDe}
                    ownerView={false}
                  />
                ) : (
                  <EmptyPagePlaceholder theme={theme} />
                )
              ) : prevRight ? (
                <Page
                  page={prevRight}
                  pageIndex={prevRightIndex}
                  theme={theme}
                  cardLookup={cardLookup}
                  expectedLookup={expectedLookup}
                  isDe={isDe}
                  ownerView={false}
                />
              ) : (
                <EmptyPagePlaceholder theme={theme} />
              )
            }
          />
        )}

        {/* Drag corners. Each is a small invisible overlay you can grab to
            start a flip. They are above the flipping sheet so the cursor stays
            sticky during the whole drag. */}
        {ownerView && canForward && pageWidth > 0 && (
          <FlipCorner
            side="right"
            disabled={activeFlip !== null && activeFlip !== "forward"}
            onStart={() => handleDragStart("forward")}
            onMove={(dx) => handleDrag("forward", dx)}
            onEnd={() => handleDragEnd("forward")}
          />
        )}
        {!ownerView && canForward && pageWidth > 0 && (
          <FlipCorner
            side="right"
            disabled={activeFlip !== null && activeFlip !== "forward"}
            onStart={() => handleDragStart("forward")}
            onMove={(dx) => handleDrag("forward", dx)}
            onEnd={() => handleDragEnd("forward")}
          />
        )}
        {canBackward && pageWidth > 0 && (
          <FlipCorner
            side="left"
            disabled={activeFlip !== null && activeFlip !== "backward"}
            onStart={() => handleDragStart("backward")}
            onMove={(dx) => handleDrag("backward", dx)}
            onEnd={() => handleDragEnd("backward")}
          />
        )}
      </div>

      <div className="flex items-center justify-center gap-4 pt-4">
        <button
          type="button"
          onClick={() => triggerProgrammaticFlip("backward")}
          disabled={!canBackward || activeFlip !== null}
          className="bg-surface border border-border rounded-lg p-2 hover:border-pa-green/30 disabled:opacity-40 transition-colors"
          aria-label={isDe ? "Vorherige Seite" : "Previous page"}
        >
          ‹
        </button>
        <span className="text-sm text-text-secondary">
          {isDe ? "Seite" : "Page"} {leftPageIndex + 1}
          {rightPageIndex < pages.length ? `–${rightPageIndex + 1}` : ""} /{" "}
          {pages.length}
        </span>
        <button
          type="button"
          onClick={() => triggerProgrammaticFlip("forward")}
          disabled={!canForward || activeFlip !== null}
          className="bg-surface border border-border rounded-lg p-2 hover:border-pa-green/30 disabled:opacity-40 transition-colors"
          aria-label={isDe ? "Nächste Seite" : "Next page"}
        >
          ›
        </button>
      </div>
    </div>
  );
}

function FlipSheet({
  direction,
  rotateY,
  front,
  back,
}: {
  direction: FlipDirection;
  rotateY: ReturnType<typeof useMotionValue<number>>;
  pageWidth: number;
  front: React.ReactNode;
  back: React.ReactNode;
}) {
  const isForward = direction === "forward";
  return (
    <motion.div
      className="hidden md:block pointer-events-none"
      style={{
        gridColumn: isForward ? "2 / 3" : "1 / 2",
        gridRow: "1",
        transformStyle: "preserve-3d",
        transformOrigin: isForward ? "left center" : "right center",
        rotateY,
        zIndex: 30,
      }}
    >
      <div
        className="absolute inset-0"
        style={{ backfaceVisibility: "hidden" }}
      >
        {front}
      </div>
      <div
        className="absolute inset-0"
        style={{
          backfaceVisibility: "hidden",
          transform: "rotateY(180deg)",
        }}
      >
        {back}
      </div>
    </motion.div>
  );
}

function FlipCorner({
  side,
  disabled,
  onStart,
  onMove,
  onEnd,
}: {
  side: "left" | "right";
  disabled: boolean;
  onStart: () => void;
  onMove: (deltaX: number) => void;
  onEnd: () => void;
}) {
  const startXRef = useRef<number | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.button !== 0) return;
    startXRef.current = e.clientX;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    onStart();
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (startXRef.current === null) return;
    onMove(e.clientX - startXRef.current);
  };
  const finish = (e: React.PointerEvent<HTMLDivElement>) => {
    if (startXRef.current === null) return;
    startXRef.current = null;
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    onEnd();
  };

  return (
    <div
      role="button"
      aria-label={
        side === "right" ? "Drag to flip forward" : "Drag to flip backward"
      }
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      className={[
        "absolute top-2 z-40 h-12 w-12 select-none touch-none",
        side === "right"
          ? "right-2 cursor-grab active:cursor-grabbing"
          : "left-2 cursor-grab active:cursor-grabbing",
        disabled ? "pointer-events-none opacity-0" : "opacity-100",
      ].join(" ")}
      style={{
        background:
          "radial-gradient(closest-side, rgba(255,255,255,0.18), rgba(255,255,255,0))",
        borderRadius: side === "right" ? "0 0 0 100%" : "0 0 100% 0",
      }}
    />
  );
}

function EmptyPagePlaceholder({ theme }: { theme: ThemeShape }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-text-muted">—</span>
      </div>
      <div
        className={`p-3 rounded-xl ${theme.swatchClass} grid grid-cols-3 gap-2.5 opacity-40`}
      >
        {Array.from({ length: 9 }, (_, i) => (
          <div
            key={i}
            className="aspect-[5/7] rounded-md bg-black/10 ring-1 ring-white/10"
          />
        ))}
      </div>
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
