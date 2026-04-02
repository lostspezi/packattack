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
      .then((r) => r.json())
      .then((data) => {
        setCartCount(data.totalItems ?? 0);
        setCartTimer(data.cartExpiresInSeconds ?? 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  // Single interval that ticks while cartTimer > 0.
  // Uses a ref gate so the effect only depends on refreshCart (stable).
  useEffect(() => {
    const interval = setInterval(() => {
      setCartTimer((prev) => {
        if (prev <= 0) return 0;
        const next = prev - 1;
        if (next === 0) refreshCart();
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [refreshCart]);

  return { cartCount, cartTimer, formatTimer, timerColor, refreshCart };
}
