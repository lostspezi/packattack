"use client";

import { Check, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface VotingItem {
  _id: string;
  kind: "card" | "option" | "box";
  label: { de: string; en: string };
  description: { de: string; en: string };
  image: string | null;
  rarity: string | null;
  setName: string | null;
  game: string | null;
  boxSlug: string | null;
  position: number;
}

interface Props {
  item: VotingItem;
  lang: string;
  selected: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

/**
 * Generic tile used in voting and reveal grids. Adapts metadata badges
 * per item kind: cards show set + rarity, boxes show game + Pack icon,
 * options show description (if any).
 */
export function UpvoteItemTile({ item, lang, selected, disabled, onClick }: Props) {
  const isDe = lang === "de";
  const label = isDe ? item.label.de || item.label.en : item.label.en || item.label.de;
  const description = isDe
    ? item.description.de || item.description.en
    : item.description.en || item.description.de;

  const Body = (
    <div
      className={`relative w-full text-left rounded-xl overflow-hidden border-2 transition-all ${
        selected
          ? "border-pa-green ring-2 ring-pa-green/40"
          : "border-border hover:border-pa-green/30"
      }`}
    >
      <div className="aspect-[3/4] bg-surface-2 relative">
        {item.image ? (
          <img src={item.image} alt={label} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-muted">
            {item.kind === "box" ? <Package className="w-12 h-12" /> : "?"}
          </div>
        )}
        {selected && (
          <div className="absolute top-2 right-2 bg-pa-green text-bg rounded-full w-7 h-7 flex items-center justify-center shadow-lg">
            <Check className="w-4 h-4" strokeWidth={3} />
          </div>
        )}
      </div>
      <div className="p-2 bg-surface">
        <div className="text-xs font-medium text-text-primary truncate">{label}</div>
        {item.kind === "card" && item.setName && (
          <div className="text-[10px] text-text-muted truncate flex items-center gap-1">
            {item.setName}
            {item.rarity && <Badge variant="info">{item.rarity}</Badge>}
          </div>
        )}
        {item.kind === "box" && (
          <div className="text-[10px] text-text-muted truncate flex items-center gap-1">
            <Package className="w-3 h-3" />
            {item.game ?? (isDe ? "Box" : "Box")}
          </div>
        )}
        {item.kind === "option" && description && (
          <div className="text-[10px] text-text-muted truncate">{description}</div>
        )}
      </div>
    </div>
  );

  if (!onClick) return Body;
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="w-full">
      {Body}
    </button>
  );
}
