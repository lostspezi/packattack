"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMe } from "@/components/layout/me-provider";

export interface CartState {
  cartCount: number;
  cartTimer: number;
  formatTimer: (seconds: number) => string;
  formatTimerCompact: (seconds: number) => string;
  timerColor: (seconds: number) => string;
  refreshCart: () => void;
}

function formatTimer(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatTimerCompact(seconds: number) {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}:${String(m).padStart(2, "0")}`;
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function timerColor(seconds: number) {
  if (seconds <= 600) return "text-red-400";
  if (seconds <= 1800) return "text-orange-400";
  if (seconds <= 3600) return "text-amber-400";
  return "text-text-muted";
}

export function useCartState(): CartState {
  const me = useMe();
  // Overrides are set by refreshCart() after user actions; until then we
  // derive the displayed values straight from the /api/me snapshot.
  const [override, setOverride] = useState<{ totalItems: number; cartExpiresInSeconds: number } | null>(null);
  const [tickOffset, setTickOffset] = useState(0);

  const source = useMemo(
    () =>
      override ??
      (me
        ? { totalItems: me.cart.totalItems, cartExpiresInSeconds: me.cart.cartExpiresInSeconds }
        : null),
    [override, me],
  );
  const cartCount = source?.totalItems ?? 0;
  const cartTimer = Math.max(0, (source?.cartExpiresInSeconds ?? 0) - tickOffset);

  const refreshCart = useCallback(() => {
    fetch("/api/cart")
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data) => {
        setOverride({
          totalItems: data.totalItems ?? 0,
          cartExpiresInSeconds: data.cartExpiresInSeconds ?? 0,
        });
        setTickOffset(0);
      })
      .catch(() => {});
  }, []);

  // Countdown against the current source (override or me snapshot). We only
  // bump a local offset so the source value stays authoritative and we don't
  // need to mutate it in an effect.
  useEffect(() => {
    if (cartCount <= 0) return;
    const interval = setInterval(() => {
      setTickOffset((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [cartCount]);

  // When the countdown hits zero, refetch fresh state.
  useEffect(() => {
    if (cartCount > 0 && cartTimer === 0 && source && source.cartExpiresInSeconds > 0) {
      refreshCart();
    }
  }, [cartCount, cartTimer, source, refreshCart]);

  return { cartCount, cartTimer, formatTimer, formatTimerCompact, timerColor, refreshCart };
}
