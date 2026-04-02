"use client";

import { useCallback, useEffect, useState } from "react";

export interface CartState {
  cartCount: number;
  cartTimer: number;
  formatTimer: (seconds: number) => string;
  timerColor: (seconds: number) => string;
  refreshCart: () => void;
}

function formatTimer(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function timerColor(seconds: number) {
  if (seconds <= 600) return "text-red-400";
  if (seconds <= 1800) return "text-orange-400";
  if (seconds <= 3600) return "text-amber-400";
  return "text-text-muted";
}

export function useCartState(): CartState {
  const [cartCount, setCartCount] = useState(0);
  const [cartTimer, setCartTimer] = useState(0);

  const refreshCart = useCallback(() => {
    fetch("/api/cart")
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data) => {
        setCartCount(data.totalItems ?? 0);
        setCartTimer(data.cartExpiresInSeconds ?? 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  // Only run the countdown interval while there are items in the cart.
  // cartCount is the gate: interval is created once when items appear,
  // torn down when cart empties. The setter reads prev to avoid drift.
  useEffect(() => {
    if (cartCount <= 0) return;
    const interval = setInterval(() => {
      setCartTimer((prev) => {
        if (prev <= 0) return 0;
        const next = prev - 1;
        if (next === 0) refreshCart();
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cartCount, refreshCart]);

  return { cartCount, cartTimer, formatTimer, timerColor, refreshCart };
}
