"use client";

import { useDraggable } from "@dnd-kit/core";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import type { InventoryCard } from "@/lib/binders/inventory";

interface InventoryDrawerProps {
  open: boolean;
  onToggle: () => void;
  inventory: InventoryCard[];
  loading: boolean;
  isDe: boolean;
}

export function InventoryDrawer({
  open,
  onToggle,
  inventory,
  loading,
  isDe,
}: InventoryDrawerProps) {
  return (
    <div className="bg-surface border border-border rounded-xl">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/3 transition-colors"
      >
        <span className="text-sm font-semibold text-text-primary">
          {isDe ? "Inventar" : "Inventory"}{" "}
          <span className="text-text-muted font-normal">
            ({inventory.length})
          </span>
        </span>
        {open ? (
          <ChevronDown className="w-4 h-4 text-text-secondary" />
        ) : (
          <ChevronUp className="w-4 h-4 text-text-secondary" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 max-h-[40vh] overflow-y-auto">
          {loading ? (
            <div className="py-8 text-center">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-pa-green" />
            </div>
          ) : inventory.length === 0 ? (
            <p className="text-sm text-text-muted py-6 text-center">
              {isDe
                ? "Keine freien Karten. Alle sind in einem Binder oder du hast noch keine."
                : "No free cards. All in a binder or none yet."}
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-10 gap-2">
              <AnimatePresence initial={false}>
                {inventory.map((c) => (
                  <DraggableInventoryTile key={c.packPullId} card={c} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
