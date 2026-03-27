"use client";

import React, { useState, useEffect } from "react";
import { Loader2, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface InventoryItem {
  _id: string;
  card: {
    name?: string;
    image?: string | null;
    rarity?: string;
    setName?: string;
    marketPrice?: number | null;
  } | null;
  box: {
    name?: { de: string; en: string };
    game?: string;
  } | null;
  rarity: string;
  claimedAt: string;
}

interface InventoryGridProps {
  lang: string;
  refreshKey: number;
}

export function InventoryGrid({ lang, refreshKey }: InventoryGridProps) {
  const isDe = lang === "de";

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/claimed?page=${page}&limit=30`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json() as { items?: InventoryItem[]; total?: number; totalPages?: number };
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, refreshKey]);

  if (loading) {
    return (
      <div className="py-8 text-center">
        <Loader2 className="w-5 h-5 animate-spin mx-auto text-pa-green" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-12 text-center">
        <Package className="w-10 h-10 mx-auto text-text-muted mb-3" />
        <p className="text-text-muted">
          {isDe ? "Noch keine Karten in deiner Sammlung." : "No cards in your collection yet."}
        </p>
        <p className="text-xs text-text-muted mt-1">
          {isDe ? "Öffne Packs um Karten zu sammeln!" : "Open packs to collect cards!"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        {total.toLocaleString()} {isDe ? "Karten in deiner Sammlung" : "cards in your collection"}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {items.map((item) => {
          const card = item.card;
          const boxName = isDe
            ? (item.box?.name?.de || item.box?.name?.en)
            : (item.box?.name?.en || item.box?.name?.de);

          return (
            <div
              key={item._id}
              className="bg-surface border border-border rounded-xl p-2.5 space-y-2 hover:border-pa-green/20 transition-colors"
            >
              {card?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={card.image} alt={card.name ?? ""} className="w-full rounded-lg" loading="lazy" />
              ) : (
                <div className="w-full aspect-[63/88] bg-white/4 rounded-lg" />
              )}
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-text-primary line-clamp-2">{card?.name ?? "Unknown"}</p>
                <Badge variant="info">{item.rarity}</Badge>
                {boxName && (
                  <p className="text-[10px] text-text-muted truncate">{boxName}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-text-muted">
            {isDe ? "Seite" : "Page"} {page}/{totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {isDe ? "Zurück" : "Previous"}
            </Button>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              {isDe ? "Weiter" : "Next"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
