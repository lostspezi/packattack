"use client";

import Link from "next/link";
import { ShoppingCart, ArrowRight } from "lucide-react";
import type { CartState } from "./use-cart-state";

interface MegaMenuCartProps {
  lang: string;
  dict: Record<string, string>;
  cartState: CartState;
  onClose: () => void;
}

export function MegaMenuCart({ lang, dict, cartState, onClose }: MegaMenuCartProps) {
  const hasItems = cartState.cartCount > 0;

  return (
    <div className="flex items-start gap-6">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-pa-green/10">
        <ShoppingCart className="h-6 w-6 text-pa-green" />
      </div>

      <div className="flex-1">
        {hasItems ? (
          <>
            <p className="text-sm font-medium text-text-primary">
              {cartState.cartCount} {cartState.cartCount === 1
                ? (dict["item_in_cart"] ?? "Artikel im Warenkorb")
                : (dict["items_in_cart"] ?? "Artikel im Warenkorb")}
            </p>
            <div className="mt-1 flex items-center gap-3">
              <span className={`font-mono text-sm ${cartState.timerColor(cartState.cartTimer)}`}>
                {dict["expires_in"] ?? "Läuft ab in"} {cartState.formatTimer(cartState.cartTimer)}
              </span>
            </div>
            <Link
              href={`/${lang}/cart`}
              onClick={onClose}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-pa-green px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-pa-green-hover"
            >
              {dict["view_cart"] ?? "Warenkorb ansehen"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-text-primary">
              {dict["cart_empty"] ?? "Dein Warenkorb ist leer"}
            </p>
            <p className="mt-0.5 text-xs text-text-muted">
              {dict["cart_empty_desc"] ?? "Öffne Packs und füge Karten hinzu"}
            </p>
            <Link
              href={`/${lang}/packs`}
              onClick={onClose}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-white/5"
            >
              {dict["browse_packs"] ?? "Packs entdecken"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
