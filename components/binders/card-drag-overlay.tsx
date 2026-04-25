"use client";

import type { InventoryCard } from "@/lib/binders/inventory";

interface CardDragOverlayProps {
  card: InventoryCard | null;
}

export function CardDragOverlay({ card }: CardDragOverlayProps) {
  if (!card) return null;
  return (
    <div className="rounded-md overflow-hidden ring-2 ring-pa-green shadow-2xl rotate-3 w-[120px] aspect-[5/7] pointer-events-none">
      {card.image ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={card.image}
          alt=""
          className="object-cover w-full h-full"
          draggable={false}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-[10px] text-white/80 px-1 text-center">
          {card.name}
        </div>
      )}
    </div>
  );
}
