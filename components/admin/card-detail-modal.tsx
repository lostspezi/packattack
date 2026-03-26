"use client";

import React from "react";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { CardPriceChart } from "@/components/admin/card-price-chart";
import type { JustTCGCardVariant } from "@/lib/justtcg";

interface BoxCard {
  _id: string;
  justTcgId: string;
  name: string;
  rarity: string;
  image: string | null;
  marketPrice: number | null;
  internalPrice: number | null;
  set?: string;
  setName?: string;
  tcgplayerId?: string | null;
  variants?: JustTCGCardVariant[];
}

interface CardDetailModalProps {
  card: BoxCard;
  open: boolean;
  onClose: () => void;
  lang: string;
}

function formatUsd(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

function formatChange(change: number | null | undefined): {
  label: string;
  positive: boolean | null;
} {
  if (change === null || change === undefined)
    return { label: "—", positive: null };
  const sign = change > 0 ? "+" : "";
  return { label: `${sign}${change.toFixed(2)}%`, positive: change >= 0 };
}

function ChangeChip({ change }: { change: number | null | undefined }) {
  const { label, positive } = formatChange(change);
  return (
    <span
      className={[
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        positive === true
          ? "bg-green-500/15 text-green-400"
          : positive === false
            ? "bg-red-500/15 text-red-400"
            : "bg-white/5 text-text-muted",
      ].join(" ")}
    >
      {label}
    </span>
  );
}

export function CardDetailModal({
  card,
  open,
  onClose,
  lang,
}: CardDetailModalProps) {
  const isDe = lang === "de";
  const variants = card.variants ?? [];

  // Aggregate 7d/30d/90d changes from first variant with data
  const firstVariantWithChanges = variants.find(
    (v) =>
      v.priceChange7d !== null ||
      v.priceChange30d !== null ||
      v.priceChange90d !== null
  );

  const marketPriceDollars =
    card.marketPrice !== null && card.marketPrice !== undefined
      ? `$${card.marketPrice.toFixed(2)}`
      : "—";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={card.name}
      size="lg"
    >
      <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-1">
        {/* Top section: image + info */}
        <div className="flex gap-5">
          {/* Card image */}
          <div className="flex-shrink-0">
            {card.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.image}
                alt={card.name}
                className="w-28 rounded-lg object-cover shadow-md"
                loading="lazy"
              />
            ) : (
              <div className="w-28 h-40 bg-white/4 rounded-lg flex items-center justify-center">
                <span className="text-text-muted text-xs">
                  {isDe ? "Kein Bild" : "No image"}
                </span>
              </div>
            )}
          </div>

          {/* Card info */}
          <div className="flex-1 space-y-2 min-w-0">
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wide mb-0.5">
                {isDe ? "Set" : "Set"}
              </p>
              <p className="text-sm text-text-primary font-medium truncate">
                {card.setName ?? card.set ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wide mb-0.5">
                {isDe ? "Rarität" : "Rarity"}
              </p>
              <Badge variant="info">{card.rarity}</Badge>
            </div>
            {card.tcgplayerId && (
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wide mb-0.5">
                  TCGPlayer ID
                </p>
                <p className="text-sm text-text-secondary font-mono">
                  {card.tcgplayerId}
                </p>
              </div>
            )}

            {/* Market price */}
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wide mb-0.5">
                {isDe ? "Marktpreis" : "Market Price"}
              </p>
              <p className="text-2xl font-bold text-pa-green">
                {marketPriceDollars}
              </p>
            </div>

            {/* Price changes */}
            {firstVariantWithChanges && (
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs text-text-muted">
                  {isDe ? "Änderung:" : "Change:"}
                </span>
                <div className="flex gap-1.5 flex-wrap">
                  <span className="text-xs text-text-muted">7d</span>
                  <ChangeChip change={firstVariantWithChanges.priceChange7d} />
                  <span className="text-xs text-text-muted">30d</span>
                  <ChangeChip change={firstVariantWithChanges.priceChange30d} />
                  <span className="text-xs text-text-muted">90d</span>
                  <ChangeChip change={firstVariantWithChanges.priceChange90d} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Variant prices table */}
        {variants.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">
              {isDe ? "Varianten" : "Variants"}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-1.5 px-2 text-left text-xs text-text-muted font-medium uppercase tracking-wide">
                      {isDe ? "Zustand" : "Condition"}
                    </th>
                    <th className="py-1.5 px-2 text-left text-xs text-text-muted font-medium uppercase tracking-wide">
                      {isDe ? "Druck" : "Printing"}
                    </th>
                    <th className="py-1.5 px-2 text-right text-xs text-text-muted font-medium uppercase tracking-wide">
                      {isDe ? "Preis" : "Price"}
                    </th>
                    <th className="py-1.5 px-2 text-right text-xs text-text-muted font-medium uppercase tracking-wide">
                      7d
                    </th>
                    <th className="py-1.5 px-2 text-right text-xs text-text-muted font-medium uppercase tracking-wide">
                      30d
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v, i) => (
                    <tr
                      key={i}
                      className="border-b border-border last:border-0"
                    >
                      <td className="py-1.5 px-2 text-text-primary">
                        {v.condition}
                      </td>
                      <td className="py-1.5 px-2 text-text-secondary">
                        {v.printing}
                      </td>
                      <td className="py-1.5 px-2 text-right text-pa-green font-medium">
                        {formatUsd(v.price)}
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        <ChangeChip change={v.priceChange7d} />
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        <ChangeChip change={v.priceChange30d} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Price chart */}
        {variants.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">
              {isDe ? "Preisverlauf" : "Price History"}
            </h3>
            <CardPriceChart variants={variants} cardName={card.name} />
          </div>
        )}
      </div>
    </Modal>
  );
}
